/* -----------------------------------------------------------------------
   Cloudflare Worker + Durable Object (SQLite) - Generic File API
   -------------------------------------------------------------------- */

import { McpAgent } from "agents/mcp";
import { DurableObject } from "cloudflare:workers";
import { Spiceflow } from "spiceflow";
import { cors } from "spiceflow/cors";
import { openapi } from "spiceflow/openapi";
import { mcp, addMcpTools } from "spiceflow/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseMarkdownIntoSections, isSupportedMarkdownFile, Section } from "./markdown-parser.js";
import { computeGitBlobSHA, verifySHA } from "./sha-utils.js";

/* ---------- ENV interface ---------------------------- */

interface Env {
  DATASET_CACHE: DurableObjectNamespace;
  REPO_CACHE: DurableObjectNamespace;
  ASSETS: Fetcher;
}

/* ======================================================================
   Schemas for API validation
   ==================================================================== */

const FileSchema = z.object({
  filename: z.string().describe('Full file path without leading slash, including extension (md or mdx)'),
  content: z.string().describe('Raw file content'),
  sha: z.string().optional().describe('Optional SHA-1 hash of the file content using Git blob format. If provided, will be validated against computed SHA.'),
});

const DeleteFilesSchema = z.object({
  filenames: z.array(z.string()).describe('List of full file paths to delete'),
});

const GetFileContentsQuerySchema = z.object({
  showLineNumbers: z.enum(['true', 'false'])
    .optional()
    .default('false')
    .describe('Whether to prefix each line with its line number'),
  start: z.coerce.number().int().positive().optional().describe('Start line number (1-based)'),
  end: z.coerce.number().int().positive().optional().describe('End line number (inclusive)'),
});

const SearchSectionsQuerySchema = z.object({
  query: z.string().describe('Full-text search query'),
  page: z.coerce.number().int().nonnegative().default(0).describe('Zero-based page number'),
  perPage: z.coerce.number().int().positive().default(20).describe('Number of results per page'),
  maxChunksPerFile: z.coerce.number().int().positive().default(5).describe('Maximum sections returned per file'),
});

const SearchSectionsResponseSchema = z.object({
  results: z.array(
    z.object({
      filename: z.string().describe('Source file path'),
      section: z.string().describe('Section heading'),
      snippet: z.string().describe('Highlighted excerpt'),
      score: z.number().describe('Relevance score'),
      startLine: z.number().describe('Line number where section starts'),
      metadata: z.any().optional().describe('File metadata if available'),
    })
  ),
  count: z.number().int().describe('Total matching sections'),
  page: z.number().int().describe('Current page'),
  perPage: z.number().int().describe('Results per page'),
});

/* ======================================================================
   Durable Object: per‑dataset file storage
   ==================================================================== */
export class DatasetCache extends DurableObject {
  private sql: SqlStorage;
  private datasetId?: string;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.sql = state.storage.sql;

    /* database schema */
    this.sql.exec(`
      -- Files table stores the raw file content
      CREATE TABLE IF NOT EXISTS files (
        filename       TEXT PRIMARY KEY,
        content        TEXT,
        sha            TEXT,
        created_at     INTEGER,
        updated_at     INTEGER
      );

      -- Sections table stores parsed sections from MD/MDX files
      CREATE TABLE IF NOT EXISTS sections (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        filename      TEXT NOT NULL,
        heading       TEXT NOT NULL,
        content       TEXT NOT NULL,
        level         INTEGER NOT NULL,
        order_index   INTEGER NOT NULL,
        FOREIGN KEY (filename) REFERENCES files(filename) ON DELETE CASCADE
      );

      -- Full-text search index for sections
      -- Using 'porter' tokenizer for better search results:
      -- 1. Stemming: Porter reduces words to their root forms (e.g., "running" → "run", "components" → "component")
      --    This helps match different forms of the same word in MDX/MD documentation
      -- 2. Case-insensitive: Automatically handles case variations common in code/docs
      -- 3. Language-aware: Better than 'unicode61' for English technical documentation
      -- 4. Performance: More efficient than trigram tokenizer for typical search queries
      -- 5. MDX/JSX friendly: Treats JSX tags and code snippets as regular tokens, indexing their content
      CREATE VIRTUAL TABLE IF NOT EXISTS sections_fts
        USING fts5(filename, heading, content, tokenize = 'porter');

      -- Metadata table
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, val TEXT);
    `);

  }

  /* ---------- API Methods ------------- */

  async upsertFiles({ datasetId, files }: { datasetId: string; files: { filename: string; content: string; sha?: string; metadata?: Record<string, any> }[] }): Promise<void> {
    this.datasetId = datasetId;

    for (const file of files) {
      const now = Date.now();

      // Compute SHA for the content
      const computedSHA = await computeGitBlobSHA(file.content);

      // If SHA was provided, validate it matches
      if (file.sha && file.sha !== computedSHA) {
        throw new Error(`SHA mismatch for file ${file.filename}. Expected: ${file.sha}, Computed: ${computedSHA}`);
      }

      // Check if file exists and needs update based on SHA
      const existingFile = [...this.sql.exec("SELECT filename, sha FROM files WHERE filename = ?", file.filename)];
      const isUpdate = existingFile.length > 0;
      const existingSHA = existingFile[0]?.sha as string;

      // Skip update if SHA hasn't changed
      if (isUpdate && existingSHA === computedSHA) {
        continue;
      }

      // Delete existing sections for this file
      this.sql.exec("DELETE FROM sections WHERE filename = ?", file.filename);
      this.sql.exec("DELETE FROM sections_fts WHERE filename = ?", file.filename);

      // Upsert file with SHA
      if (isUpdate) {
        this.sql.exec("UPDATE files SET content = ?, sha = ?, updated_at = ? WHERE filename = ?",
          file.content, computedSHA, now, file.filename);
      } else {
        this.sql.exec("INSERT INTO files (filename, content, sha, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
          file.filename, file.content, computedSHA, now, now);
      }

      // Parse and store sections if it's a markdown file
      if (isSupportedMarkdownFile(file.filename)) {
        const parsed = parseMarkdownIntoSections(file.content);

        for (const section of parsed.sections) {
          this.sql.exec("INSERT INTO sections (filename, heading, content, level, order_index) VALUES (?, ?, ?, ?, ?)",
            file.filename, section.heading, section.content, section.level, section.orderIndex);

          this.sql.exec("INSERT INTO sections_fts (filename, heading, content) VALUES (?, ?, ?)",
            file.filename, section.heading, section.content);
        }
      }
    }
  }

  async deleteFiles({ datasetId, filenames }: { datasetId: string; filenames: string[] }): Promise<void> {
    this.datasetId = datasetId;

    for (const filename of filenames) {
      // Delete file and its sections (CASCADE will handle sections table)
      this.sql.exec("DELETE FROM files WHERE filename = ?", filename);
      this.sql.exec("DELETE FROM sections_fts WHERE filename = ?", filename);
    }
  }

  async getFileContents({
    datasetId,
    filePath,
    showLineNumbers,
    start,
    end
  }: {
    datasetId: string;
    filePath: string;
    showLineNumbers?: boolean;
    start?: number;
    end?: number;
  }): Promise<{ content: string; sha: string; metadata?: any }> {
    this.datasetId = datasetId;

    const results = [...this.sql.exec("SELECT content, sha, metadata FROM files WHERE filename = ?", filePath)];
    const row = results.length > 0 ? results[0] : null;

    if (!row) {
      throw new Error("File not found");
    }

    let content = row.content as string;
    const sha = row.sha as string;
    const metadata = row.metadata ? JSON.parse(row.metadata as string) : undefined;

    // Apply line formatting if any formatting options are specified
    if (showLineNumbers || start !== undefined || end !== undefined) {
      content = formatFileWithLines(content, showLineNumbers || false, start, end);
    }

    return { content, sha, metadata };
  }

  async searchSections({
    datasetId,
    query,
    page = 0,
    perPage = 20,
    maxChunksPerFile = 5
  }: {
    datasetId: string;
    query: string;
    page?: number;
    perPage?: number;
    maxChunksPerFile?: number;
  }): Promise<{
    results: Array<{
      filename: string;
      section: string;
      snippet: string;
      score: number;
      startLine: number;
      metadata?: any;
    }>;
    count: number;
    page: number;
    perPage: number;
  }> {
    this.datasetId = datasetId;

    const offset = page * perPage;

    // Search in sections using FTS
    const searchQuery = decodeURIComponent(query);

    // Get total count
    const countResults = [...this.sql.exec(
      `SELECT COUNT(*) as count FROM sections_fts WHERE sections_fts MATCH ?`,
      searchQuery
    )];
    const totalCount = countResults[0]?.count as number || 0;

    // Get paginated results with section details
    const rows = [...this.sql.exec(
      `SELECT
        sections.filename,
        sections.heading,
        snippet(sections_fts, -1, '<mark>', '</mark>', '...', 64) as snippet,
        bm25(sections_fts) as score
      FROM sections_fts
      JOIN sections ON sections.filename = sections_fts.filename AND sections.heading = sections_fts.heading
      WHERE sections_fts MATCH ?
      ORDER BY score
      LIMIT ? OFFSET ?`,
      searchQuery,
      perPage,
      offset
    )];

    // Group results by filename and limit per file
    const fileGroups: Record<string, any[]> = {};

    for (const row of rows) {
      const filename = row.filename as string;
      if (!fileGroups[filename]) {
        fileGroups[filename] = [];
      }

      if (fileGroups[filename].length < maxChunksPerFile) {
        const metadata = row.metadata ? JSON.parse(row.metadata as string) : undefined;
        fileGroups[filename].push({
          filename,
          section: row.heading as string,
          snippet: (row.snippet as string).replace(/<\/?mark>/g, ''), // Remove HTML marks for JSON response
          score: row.score as number,
          startLine: row.start_line as number,
          metadata,
        });
      }
    }

    // Flatten results
    const results = Object.values(fileGroups).flat();

    return {
      results,
      count: totalCount,
      page,
      perPage,
    };
  }

  async searchSectionsText({
    datasetId,
    query,
    page = 0,
    perPage = 20,
    maxChunksPerFile = 5
  }: {
    datasetId: string;
    query: string;
    page?: number;
    perPage?: number;
    maxChunksPerFile?: number;
  }): Promise<string> {
    const data = await this.searchSections({ datasetId, query, page, perPage, maxChunksPerFile });

    // Convert to markdown format with headings and URLs
    const textResult = data.results
      .map((result: any) => {
        const level = result.section.includes('#') ? result.section.match(/^#+/)?.[0].length || 2 : 2;
        const headingPrefix = '#'.repeat(Math.min(level + 1, 6)); // Offset by 1 to show hierarchy
        
        // Build URL to read specific line
        const baseUrl = `/v1/datasets/${datasetId}/files/${result.filename}`;
        const lineUrl = result.startLine ? `${baseUrl}?start=${result.startLine}` : baseUrl;
        
        return `${headingPrefix} ${result.section}\n\n[${result.filename}:${result.startLine || '1'}](${lineUrl})\n\n${result.snippet}\n`;
      })
      .join('\n---\n\n');

    return textResult;
  }
}

/* ======================================================================
   Main Spiceflow App
   ==================================================================== */

const app = new Spiceflow()
  .state("env", {} as Env)
  .state("ctx", {} as ExecutionContext)
  .use(cors())
  .use(openapi({ path: "/openapi.json" }))

  // 1) Batch upsert files (auto-chunk on server based on extension)
  .route({
    method: 'PUT',
    path: '/v1/datasets/:datasetId/files',
    request: z.object({ files: z.array(FileSchema).describe('List of files to ingest and auto-chunk') }),
    response: z.void(),
    async handler({ request, params, state }) {
      const { files } = await request.json();
      const { datasetId } = params;

      const id = state.env.DATASET_CACHE.idFromName(datasetId);
      const stub = state.env.DATASET_CACHE.get(id) as any as DatasetCache;

      await stub.upsertFiles({ datasetId, files });
    },
    openapi: { operationId: 'upsertFiles' },
  })

  // 2) Delete specific files
  .route({
    method: 'DELETE',
    path: '/v1/datasets/:datasetId/files',
    request: DeleteFilesSchema,
    response: z.void(),
    async handler({ request, params, state }) {
      const { filenames } = await request.json();
      const { datasetId } = params;

      const id = state.env.DATASET_CACHE.idFromName(datasetId);
      const stub = state.env.DATASET_CACHE.get(id) as any as DatasetCache;

      await stub.deleteFiles({ datasetId, filenames });
    },
    openapi: { operationId: 'deleteFiles' },
  })

  // 3) Get file contents with optional slicing
  .route({
    method: 'GET',
    path: '/v1/datasets/:datasetId/files/*',
    query: GetFileContentsQuerySchema,
    response: z.object({ 
      content: z.string().describe('Full file content or specified line range'),
      sha: z.string().describe('SHA-1 hash of the original file content using Git blob format')
    }),
    async handler({ params, query, state }) {
      const { datasetId, '*': filePath } = params;
      const { showLineNumbers, start, end } = query;

      const id = state.env.DATASET_CACHE.idFromName(datasetId);
      const stub = state.env.DATASET_CACHE.get(id) as any as DatasetCache;

      const result = await stub.getFileContents({
        datasetId,
        filePath,
        showLineNumbers: showLineNumbers === 'true',
        start,
        end,
      });

      return result;
    },
    openapi: { operationId: 'getFileContents' },
  })

  // 4) Search within a dataset (returns section hits as JSON)
  .route({
    method: 'GET',
    path: '/v1/datasets/:datasetId/search',
    query: SearchSectionsQuerySchema,
    response: SearchSectionsResponseSchema,
    async handler({ params, query, state }) {
      const { datasetId } = params;
      const { query: q, page, perPage, maxChunksPerFile } = query;

      const id = state.env.DATASET_CACHE.idFromName(datasetId);
      const stub = state.env.DATASET_CACHE.get(id) as any as DatasetCache;

      const result = await stub.searchSections({
        datasetId,
        query: q,
        page,
        perPage,
        maxChunksPerFile,
      });

      return result;
    },
    openapi: { operationId: 'searchSections' },
  })

  // 5) Search within a dataset (returns section hits as plain text)
  .route({
    method: 'GET',
    path: '/v1/datasets/:datasetId/search.txt',
    query: SearchSectionsQuerySchema,
    response: z.string().describe('Plaintext search results'),
    async handler({ params, query, state }) {
      const { datasetId } = params;
      const { query: q, page, perPage, maxChunksPerFile } = query;

      const id = state.env.DATASET_CACHE.idFromName(datasetId);
      const stub = state.env.DATASET_CACHE.get(id) as any as DatasetCache;

      const result = await stub.searchSectionsText({
        datasetId,
        query: q,
        page,
        perPage,
        maxChunksPerFile,
      });

      return result;
    },
    openapi: { operationId: 'searchSectionsText' },
  })

  // Legacy routes for MCP integration
  .route({
    path: "/sse",
    handler: ({ request, state }) =>
      MyMCP.serveSSE("/sse").fetch(request as Request, state.env, state.ctx),
  })
  .route({
    path: "/sse/message",
    handler: ({ request, state }) =>
      MyMCP.serveSSE("/sse").fetch(request as Request, state.env, state.ctx),
  })
  .route({
    path: "/mcp",
    handler: ({ request, state }) =>
      MyMCP.serve("/mcp").fetch(request as Request, state.env, state.ctx),
  });

/* ======================================================================
   MCP Integration (keeping for compatibility)
   ==================================================================== */
// Alias for backward compatibility
export class RepoCache extends DatasetCache {}

export class MyMCP extends McpAgent {
  server = new McpServer(
    {
      name: "Eyecrest File API",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    },
  );

  async init() {
    await addMcpTools({
      mcpServer: this.server,
      app: app,
      ignorePaths: ["/sse", "/sse/message", "/mcp"],
    });
  }
}

/* ======================================================================
   Export and Utility Functions
   ==================================================================== */

// Export the app for client generation
export { app };

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
    app.handle(req, { state: { env, ctx } }),
};

function formatFileWithLines(
  contents: string,
  showLineNumbers: boolean,
  startLine?: number,
  endLine?: number,
): string {
  const lines = contents.split("\n");

  // Filter lines by range if specified
  const filteredLines = (() => {
    if (startLine !== undefined || endLine !== undefined) {
      const start = startLine ? Math.max(0, startLine - 1) : 0;
      const end = endLine ? Math.min(endLine, lines.length) : lines.length;
      return lines.slice(start, end);
    }
    return lines;
  })();

  // Show line numbers if requested or if line ranges are specified
  const shouldShowLineNumbers =
    showLineNumbers || startLine !== undefined || endLine !== undefined;

  if (shouldShowLineNumbers) {
    const startLineNumber = startLine || 1;
    const maxLineNumber = startLineNumber + filteredLines.length - 1;
    const padding = maxLineNumber.toString().length;

    const formattedLines = filteredLines.map((line, index) => {
      const lineNumber = startLineNumber + index;
      const paddedNumber = lineNumber.toString().padStart(padding, " ");
      return `${paddedNumber}  ${line}`;
    });

    return formattedLines.join("\n");
  }

  return filteredLines.join("\n");
}
