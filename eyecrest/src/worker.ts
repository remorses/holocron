/* -----------------------------------------------------------------------
   Cloudflare Worker + Durable Object (SQLite) - Generic File API
   -------------------------------------------------------------------- */
import {Response} from "spiceflow";
import { McpAgent } from "agents/mcp";
import { DurableObject } from "cloudflare:workers";
import { Spiceflow } from "spiceflow";
import { cors } from "spiceflow/cors";
import { openapi } from "spiceflow/openapi";
import { mcp, addMcpTools } from "spiceflow/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { importSPKI, jwtVerify } from "jose";
import Slugger from "github-slugger";
import { parseMarkdownIntoSections, isSupportedMarkdownFile, Section } from "./markdown-parser.js";
import { computeGitBlobSHA, verifySHA } from "./sha-utils.js";
import { cleanMarkdownContent } from "./markdown-cleaner.js";

/* ---------- SQLite Table Types ---------------------------- */

type FileRow = {
  filename: string;
  content: string;
  sha: string;
  metadata: string | null;
  weight: number;
  created_at: number;
  updated_at: number;
}

type SectionRow = {
  id: number;
  filename: string;
  content: string;
  level: number;
  order_index: number;
  section_slug: string;
  start_line: number;
  weight: number;
}

type DatasetRow = {
  dataset_id: string;
  org_id: string;
  primary_region: string;
  created_at: number;
  updated_at: number;
}

type SearchResultRow = {
  filename: string;
  content: string;
  section_slug: string;
  start_line: number;
  snippet: string;
  base_score: number;
  section_weight: number;
  file_weight: number;
  metadata: string | null;
  score: number;
}

/* ---------- ENV interface ---------------------------- */

interface Env {
  DATASET_CACHE: DurableObjectNamespace;
  ASSETS: Fetcher;
  EYECREST_PUBLIC_KEY: string; // RSA public key in PEM format
  EYECREST_KV: KVNamespace;
}

/* ======================================================================
   Schemas for API validation
   ==================================================================== */

const DatasetIdSchema = z.string()
  .regex(/^[a-zA-Z0-9_-]+$/, 'Dataset ID must only contain alphanumeric characters, hyphens, and underscores')
  .max(400, 'Dataset ID must not exceed 400 characters');

const FileSchema = z.object({
  filename: z.string()
    .regex(/^[a-zA-Z0-9!_.*'()\-\/]+$/, 'Filename must only contain alphanumeric characters and safe special characters (!_.*\'()-/)')
    .max(500, 'Filename must not exceed 500 characters')
    .describe('Full file path without leading slash, including extension (md or mdx)'),
  content: z.string().describe('Raw file content'),
  metadata: z.any().optional().describe('Optional user-provided metadata for the file (JSON object)'),
  weight: z.number().optional().default(1.0).describe('Optional weight for ranking in search results (default: 1.0)'),
});

type FileSchema = z.infer<typeof FileSchema>;

const UpsertFilesRequestSchema = z.object({
  files: z.array(FileSchema).describe('List of files to ingest and auto-chunk')
});

const DeleteFilesSchema = z.object({
  filenames: z.array(z.string()).describe('List of full file paths to delete'),
});

const GetFileContentsQuerySchema = z.object({
  showLineNumbers: z.string()
    .optional()
    .default('false')
    .describe('Whether to prefix each line with its line number. Values: "true", "false", or empty string (treated as true)'),
  start: z.coerce.number().int().positive().optional().describe('Start line number (1-based)'),
  end: z.coerce.number().int().positive().optional().describe('End line number (inclusive)'),
});

const SearchSectionsQuerySchema = z.object({
  query: z.string().describe('Full-text search query'),
  page: z.coerce.number().int().nonnegative().default(0).describe('Zero-based page number'),
  perPage: z.coerce.number().int().positive().default(20).describe('Number of results per page'),
  maxChunksPerFile: z.coerce.number().int().positive().default(5).describe('Maximum sections returned per file'),
  snippetLength: z.coerce.number().int().positive().max(500).default(300).describe('Maximum length of snippet (max 500)'),
});

const SearchSectionsResponseSchema = z.object({
  results: z.array(
    z.object({
      filename: z.string().describe('Source file path'),
      sectionSlug: z.string().describe('URL-friendly slug of the section heading'),
      snippet: z.string().describe('Raw markdown excerpt'),
      cleanedSnippet: z.string().describe('Cleaned text excerpt without markdown syntax'),
      score: z.number().describe('Relevance score'),
      startLine: z.number().describe('Line number where section starts'),
      metadata: z.any().optional().describe('File metadata if available'),
    })
  ),
  hasNextPage: z.boolean().describe('Whether there are more results on the next page'),
  page: z.number().int().describe('Current page'),
  perPage: z.number().int().describe('Results per page'),
  region: z.string().describe('Durable Object region where search was executed'),
});

// Export types for SDK use
export type EyecrestFile = z.input<typeof FileSchema>;
export type DeleteFilesRequest = z.infer<typeof DeleteFilesSchema>;
export type GetFileContentsQuery = z.infer<typeof GetFileContentsQuerySchema>;
export type SearchSectionsQuery = z.infer<typeof SearchSectionsQuerySchema>;
export type SearchSectionsResponse = z.infer<typeof SearchSectionsResponseSchema>;

/* ======================================================================
   Durable Object: per‑dataset file storage
   ==================================================================== */
export class DatasetCache extends DurableObject {
  private sql: SqlStorage;
  private datasetId?: string;
  private doRegion?: string;

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
        metadata       TEXT,
        weight         REAL DEFAULT 1.0,
        created_at     INTEGER,
        updated_at     INTEGER
      );

      -- Sections table stores parsed sections from MD/MDX files
      CREATE TABLE IF NOT EXISTS sections (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        filename      TEXT NOT NULL,
        content       TEXT NOT NULL,  -- Full markdown content including heading
        level         INTEGER NOT NULL,
        order_index   INTEGER NOT NULL,
        section_slug  TEXT NOT NULL,
        start_line    INTEGER NOT NULL,
        weight        REAL DEFAULT 1.0,
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
        USING fts5(filename, section_slug, content, tokenize = 'porter');

      -- Metadata table
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, val TEXT);

      -- Datasets table to track ownership
      CREATE TABLE IF NOT EXISTS datasets (
        dataset_id    TEXT PRIMARY KEY,
        org_id        TEXT NOT NULL,
        primary_region TEXT NOT NULL,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL
      );
    `);
  }

  /* ---------- API Methods ------------- */

  async upsertFiles({ datasetId, orgId, files, region }: { datasetId: string; orgId: string; files: FileSchema[]; region?: string }): Promise<void> {
    this.datasetId = datasetId;
    if (region) {
      this.doRegion = region;
    }

    // Validate file count limit
    if (files.length > 100) {
      throw new Error(`Too many files: ${files.length}. Maximum 100 files allowed per request.`);
    }

    const startTime = Date.now();

    // Check if dataset exists and verify ownership
    const ownershipStart = Date.now();
    const datasetRows = [...this.sql.exec("SELECT org_id, primary_region FROM datasets WHERE dataset_id = ?", datasetId)] as Pick<DatasetRow, 'org_id' | 'primary_region'>[];
    if (datasetRows.length > 0) {
      const existingOrgId = datasetRows[0].org_id;
      if (existingOrgId !== orgId) {
        throw new Error(`Unauthorized: dataset ${datasetId} belongs to organization ${existingOrgId}, but you are authenticated as ${orgId}`);
      }
    } else {
      // First time creating this dataset - record ownership
      const now = Date.now();
      // Use the region passed in (from KV config) or DEFAULT_REGION
      const regionToStore = this.doRegion || DEFAULT_REGION;
      this.sql.exec("INSERT INTO datasets (dataset_id, org_id, primary_region, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        datasetId, orgId, regionToStore, now, now);
    }
    console.log(`[upsert] Ownership check: ${Date.now() - ownershipStart}ms`);

    // Parallelize SHA computations
    const shaStart = Date.now();
    const shaComputations = await Promise.all(
      files.map(async (file) => ({
        file,
        computedSHA: await computeGitBlobSHA(file.content)
      }))
    );
    console.log(`[upsert] SHA computations (${files.length} files): ${Date.now() - shaStart}ms`);

    // Get all existing files in one query
    const existingCheckStart = Date.now();
    const filenames = files.map(f => f.filename);
    const placeholders = filenames.map(() => '?').join(',');
    const existingFiles = [...this.sql.exec(
      `SELECT filename, sha FROM files WHERE filename IN (${placeholders})`,
      ...filenames
    )] as Pick<FileRow, 'filename' | 'sha'>[];
    const existingMap = new Map(existingFiles.map(row => [row.filename, row.sha]));
    console.log(`[upsert] Existing files check: ${Date.now() - existingCheckStart}ms`);

    // Process each file
    let processedCount = 0;
    let skippedCount = 0;
    const processingStart = Date.now();

    for (const { file, computedSHA } of shaComputations) {
      const now = Date.now();

      // Ignore user-provided SHA - always use computed SHA

      // Check if file exists and needs update based on SHA
      const existingSHA = existingMap.get(file.filename);
      const isUpdate = existingSHA !== undefined;

      // Skip update if SHA hasn't changed
      if (isUpdate && existingSHA === computedSHA) {
        skippedCount++;
        continue;
      }

      processedCount++;

      // Delete existing sections for this file
      this.sql.exec("DELETE FROM sections WHERE filename = ?", file.filename);
      this.sql.exec("DELETE FROM sections_fts WHERE filename = ?", file.filename);

      // Upsert file with SHA, metadata, and weight
      const metadataJson = file.metadata ? JSON.stringify(file.metadata) : null;
      const fileWeight = file.weight ?? 1.0;
      if (isUpdate) {
        this.sql.exec("UPDATE files SET content = ?, sha = ?, metadata = ?, weight = ?, updated_at = ? WHERE filename = ?",
          file.content, computedSHA, metadataJson, fileWeight, now, file.filename);
      } else {
        this.sql.exec("INSERT INTO files (filename, content, sha, metadata, weight, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          file.filename, file.content, computedSHA, metadataJson, fileWeight, now, now);
      }

      // Parse and store sections if it's a markdown file
      if (isSupportedMarkdownFile(file.filename)) {
        const parseStart = Date.now();
        const parsed = parseMarkdownIntoSections(file.content);
        const slugger = new Slugger();

        // Batch insert sections for better performance
        if (parsed.sections.length > 0) {
          // Prepare values for batch insert
          const sectionValues: any[] = [];
          const ftsValues: any[] = [];

          for (const section of parsed.sections) {
            // Use section weight if defined, otherwise inherit file weight
            const sectionWeight = section.weight ?? fileWeight;

            sectionValues.push(file.filename, section.content, section.level, section.orderIndex, section.headingSlug, section.startLine, sectionWeight);
            ftsValues.push(file.filename, section.headingSlug, section.content);
          }

          // Batch insert into sections table
          const sectionPlaceholders = parsed.sections.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
          this.sql.exec(
            `INSERT INTO sections (filename, content, level, order_index, section_slug, start_line, weight) VALUES ${sectionPlaceholders}`,
            ...sectionValues
          );

          // Batch insert into FTS table
          const ftsPlaceholders = parsed.sections.map(() => '(?, ?, ?)').join(', ');
          this.sql.exec(
            `INSERT INTO sections_fts (filename, section_slug, content) VALUES ${ftsPlaceholders}`,
            ...ftsValues
          );
        }

        if (parsed.sections.length > 10) {
          console.log(`[upsert] Parsed ${file.filename} (${parsed.sections.length} sections): ${Date.now() - parseStart}ms`);
        }
      }
    }

    console.log(`[upsert] Processing files (${processedCount} processed, ${skippedCount} skipped): ${Date.now() - processingStart}ms`);
    console.log(`[upsert] Total time: ${Date.now() - startTime}ms`);
  }

  async deleteFiles({ datasetId, orgId, filenames, region }: { datasetId: string; orgId: string; filenames: string[]; region?: string }): Promise<void> {
    this.datasetId = datasetId;
    if (region) {
      this.doRegion = region;
    }

    // Verify ownership
    await this.verifyDatasetOwnership(datasetId, orgId);

    for (const filename of filenames) {
      // Delete file and its sections (CASCADE will handle sections table)
      this.sql.exec("DELETE FROM files WHERE filename = ?", filename);
      this.sql.exec("DELETE FROM sections_fts WHERE filename = ?", filename);
    }
  }

  async getFileContents({
    datasetId,
    orgId,
    filePath,
    showLineNumbers,
    start,
    end,
    region
  }: {
    datasetId: string;
    orgId: string;
    filePath: string;
    showLineNumbers?: boolean;
    start?: number;
    end?: number;
    region: string;
  }): Promise<{ content: string; sha: string; metadata?: any }> {
    this.datasetId = datasetId;
    if (region) {
      this.doRegion = region;
    }

    // Verify ownership
    await this.verifyDatasetOwnership(datasetId, orgId);

    const results = [...this.sql.exec<Pick<FileRow, 'content' | 'sha' | 'metadata'>>("SELECT content, sha, metadata FROM files WHERE filename = ?", filePath)];
    const row = results.length > 0 ? results[0] : null;

    if (!row) {
      throw new Error(`File not found: ${filePath} in dataset ${datasetId}`);
    }

    let content = row.content;
    const sha = row.sha;
    const metadata = row.metadata ? JSON.parse(row.metadata) : undefined;

    // Apply line formatting if any formatting options are specified
    if (showLineNumbers || start !== undefined || end !== undefined) {
      content = formatFileWithLines(content, showLineNumbers || false, start, end);
    }

    return { content, sha, metadata };
  }

  async searchSections({
    datasetId,
    orgId,
    query,
    page = 0,
    perPage = 20,
    maxChunksPerFile = 5,
    snippetLength = 300,
    region
  }: {
    datasetId: string;
    orgId: string;
    query: string;
    page?: number;
    perPage?: number;
    maxChunksPerFile?: number;
    snippetLength?: number;
    region: string;
  }): Promise<{
    results: Array<{
      filename: string;
      sectionSlug: string;
      snippet: string;
      cleanedSnippet: string;
      score: number;
      startLine: number;
      metadata?: any;
    }>;
    hasNextPage: boolean;
    page: number;
    perPage: number;
    region: string;
  }> {
    this.datasetId = datasetId;
    if (region) {
      this.doRegion = region;
    }

    // Verify ownership
    await this.verifyDatasetOwnership(datasetId, orgId);

    const offset = page * perPage;

    // Search in sections using FTS
    const searchQuery = decodeURIComponent(query);

    // Get paginated results with section details
    // Fetch one extra result to determine if there's a next page
    // Join using section_slug for simpler and more performant matching
    // Apply weights to BM25 score for better ranking
    const rows = [...this.sql.exec<SearchResultRow>(
      `SELECT
        sections.filename,
        sections.content,
        sections.section_slug,
        sections.start_line,
        snippet(sections_fts, 2, '', '', '', ?) as snippet,
        bm25(sections_fts) as base_score,
        sections.weight as section_weight,
        files.weight as file_weight,
        files.metadata,
        -- Combined score with logarithmic weight normalization
        -- BM25 is the primary signal, weights provide minor boosts
        (bm25(sections_fts) * (1.0 + LOG(sections.weight) * 0.1) * (1.0 + LOG(files.weight) * 0.1)) as score
      FROM sections_fts
      JOIN sections ON sections.filename = sections_fts.filename
        AND sections.section_slug = sections_fts.section_slug
      JOIN files ON sections.filename = files.filename
      WHERE sections_fts.content MATCH ?
      ORDER BY score
      LIMIT ? OFFSET ?`,
      snippetLength,
      searchQuery,
      perPage + 1, // Fetch one extra to check for next page
      offset
    )];

    // Check if there are more results
    const hasNextPage = rows.length > perPage;

    // Remove the extra result if present
    if (hasNextPage) {
      rows.pop();
    }

    // Group results by filename and limit per file
    const fileGroups: Record<string, any[]> = {};

    for (const row of rows) {
      const filename = row.filename;
      if (!fileGroups[filename]) {
        fileGroups[filename] = [];
      }

      if (fileGroups[filename].length < maxChunksPerFile) {
        const metadata = row.metadata ? JSON.parse(row.metadata) : undefined;
        const rawSnippet = row.snippet;
        fileGroups[filename].push({
          filename,
          sectionSlug: row.section_slug,
          snippet: rawSnippet,
          cleanedSnippet: cleanMarkdownContent(rawSnippet),
          score: row.score,
          startLine: row.start_line,
          metadata,
        });
      }
    }

    // Flatten results
    const results = Object.values(fileGroups).flat();

    return {
      results,
      hasNextPage,
      page,
      perPage,
      region,
    };
  }

  async searchSectionsText({
    datasetId,
    orgId,
    query,
    page = 0,
    perPage = 20,
    maxChunksPerFile = 5,
    snippetLength = 300,
    region
  }: {
    datasetId: string;
    orgId: string;
    query: string;
    page?: number;
    perPage?: number;
    maxChunksPerFile?: number;
    snippetLength?: number;
    region: string;
  }): Promise<string> {
    const data = await this.searchSections({ datasetId, orgId, query, page, perPage, maxChunksPerFile, snippetLength, region });

    // Convert to markdown format with headings and URLs
    let textResult = data.results
      .map((result) => {
        // Extract heading from snippet if present
        const headingMatch = result.snippet.match(/^(#{1,6})\s+(.+)$/m);
        const heading = headingMatch ? headingMatch[2] : '';
        const level = headingMatch ? headingMatch[1].length : 2;
        const headingPrefix = '#'.repeat(Math.min(level + 1, 6)); // Offset by 1 to show hierarchy

        // Build URL to read specific line
        const baseUrl = `/v1/datasets/${datasetId}/files/${result.filename}`;
        const lineUrl = result.startLine ? `${baseUrl}?start=${result.startLine}` : baseUrl;

        return `${headingPrefix} ${heading}\n\n[${result.filename}:${result.startLine || '1'}](${lineUrl})\n\n${result.snippet}\n`;
      })
      .join('\n---\n\n');

    // Add pagination info if there's a next page
    if (data.hasNextPage) {
      textResult += `\n\n---\n\n*More results available on page ${data.page + 1}*`;
    }

    return textResult;
  }

  private async verifyDatasetOwnership(datasetId: string, orgId: string): Promise<void> {
    const datasetRows = [...this.sql.exec<Pick<DatasetRow, 'org_id'>>("SELECT org_id FROM datasets WHERE dataset_id = ?", datasetId)];
    if (datasetRows.length === 0) {
      throw new Error(`Dataset not found: ${datasetId}. This dataset has never been created or all files have been deleted.`);
    }

    const existingOrgId = datasetRows[0].org_id;
    if (existingOrgId !== orgId) {
      throw new Error(`Unauthorized: dataset ${datasetId} belongs to organization ${existingOrgId}, but you are authenticated as ${orgId}`);
    }
  }
}

/* ======================================================================
   JWT Verification
   ==================================================================== */

interface JWTPayload {
  orgId: string;
  exp?: number;
  iat?: number;
  [key: string]: any;
}

async function verifyJWT(token: string, publicKey: string): Promise<JWTPayload> {
  try {
    // Import the public key
    const key = await importSPKI(publicKey, 'RS256');

    // Verify the JWT
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['RS256']
    });

    // Check if orgId is present
    if (!payload.orgId || typeof payload.orgId !== 'string') {
      throw new Error('JWT missing required orgId claim');
    }

    return payload as JWTPayload;
  } catch (error) {
    throw new Error(`JWT verification failed: ${error.message}`);
  }
}

/* ======================================================================
   Main Spiceflow App
   ==================================================================== */

const app = new Spiceflow({disableSuperJsonUnlessRpc: true})
  .state("env", {} as Env)
  .state("ctx", {} as ExecutionContext)
  .state("orgId", null as string | null)
  .use(cors())
  .use(openapi({ path: "/openapi.json" }))

  // JWT Authorization Middleware for API routes
  .use(async (context) => {
    // Skip auth for non-API routes
    const url = new URL(context.request.url);
    if (!url.pathname.startsWith('/v1/')) {
      return;
    }

    // Extract JWT from Authorization header
    const authHeader = context.request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify JWT and extract orgId
      const payload = await verifyJWT(token, context.state.env.EYECREST_PUBLIC_KEY);
      context.state.orgId = payload.orgId;
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  })

  // 1) Batch upsert files (auto-chunk on server based on extension)
  .route({
    method: 'PUT',
    path: '/v1/datasets/:datasetId/files',
    params: z.object({ datasetId: DatasetIdSchema }),
    request: UpsertFilesRequestSchema,
    response: z.void(),
    async handler({ request, params, state }) {
      const { files } = await request.json();
      const { datasetId } = params;
      const orgId = state.orgId!; // Guaranteed by middleware

      // Get dataset config (will create if missing)
      const config = await getDatasetConfig({
        kv: state.env.EYECREST_KV,
        datasetId,
        orgId,
        request: request as Request
      });
      const region = config.primaryRegion;

      // Create DO ID and stub with locationHint
      const doId = getDurableObjectId({ datasetId, region });
      const id = state.env.DATASET_CACHE.idFromName(doId);
      const stub = state.env.DATASET_CACHE.get(id, { locationHint: region }) as any as DatasetCache;

      await stub.upsertFiles({ datasetId, orgId, files, region });
    },
    openapi: { operationId: 'upsertFiles' },
  })

  // 2) Delete specific files
  .route({
    method: 'DELETE',
    path: '/v1/datasets/:datasetId/files',
    params: z.object({ datasetId: DatasetIdSchema }),
    request: DeleteFilesSchema,
    response: z.void(),
    async handler({ request, params, state }) {
      const { filenames } = await request.json();
      const { datasetId } = params;
      const orgId = state.orgId!; // Guaranteed by middleware

      // Get dataset config
      const config = await getDatasetConfig({
        kv: state.env.EYECREST_KV,
        datasetId,
        orgId,
        request: request as Request
      });
      const region = config.primaryRegion;

      // Create DO ID and stub with locationHint
      const doId = getDurableObjectId({ datasetId, region });
      const id = state.env.DATASET_CACHE.idFromName(doId);
      const stub = state.env.DATASET_CACHE.get(id, { locationHint: region }) as any as DatasetCache;

      await stub.deleteFiles({ datasetId, orgId, filenames, region });
    },
    openapi: { operationId: 'deleteFiles' },
  })

  // 3) Get file contents with optional slicing
  .route({
    method: 'GET',
    path: '/v1/datasets/:datasetId/files/*',
    params: z.object({ datasetId: DatasetIdSchema, '*': z.string() }),
    query: GetFileContentsQuerySchema,
    response: z.object({
      content: z.string().describe('Full file content or specified line range'),
      sha: z.string().describe('SHA-1 hash of the original file content using Git blob format'),
      metadata: z.any().optional().describe('User-provided metadata for the file')
    }),
    async handler({ request, params, query, state }) {
      const { datasetId, '*': filePath } = params;
      const { showLineNumbers, start, end } = query;
      const orgId = state.orgId!; // Guaranteed by middleware

      // Get dataset config
      const config = await getDatasetConfig({
        kv: state.env.EYECREST_KV,
        datasetId,
        orgId,
        request: request as Request
      });
      const region = config.primaryRegion;

      // Create DO ID and stub with locationHint
      const doId = getDurableObjectId({ datasetId, region });
      const id = state.env.DATASET_CACHE.idFromName(doId);
      const stub = state.env.DATASET_CACHE.get(id, { locationHint: region }) as any as DatasetCache;

      const result = await stub.getFileContents({
        datasetId,
        orgId,
        filePath,
        showLineNumbers: showLineNumbers === 'true' || showLineNumbers === '',
        start,
        end,
        region,
      });

      return result;
    },
    openapi: { operationId: 'getFileContents' },
  })

  // 4) Search within a dataset (returns section hits as JSON)
  .route({
    method: 'GET',
    path: '/v1/datasets/:datasetId/search',
    params: z.object({ datasetId: DatasetIdSchema }),
    query: SearchSectionsQuerySchema,
    response: SearchSectionsResponseSchema,
    async handler({ request, params, query, state }) {
      const { datasetId } = params;
      const { query: q, page, perPage, maxChunksPerFile, snippetLength } = query;
      const orgId = state.orgId!; // Guaranteed by middleware

      // Get dataset config
      const config = await getDatasetConfig({
        kv: state.env.EYECREST_KV,
        datasetId,
        orgId,
        request: request as Request
      });
      const region = config.primaryRegion;

      // Create DO ID and stub with locationHint
      const doId = getDurableObjectId({ datasetId, region });
      const id = state.env.DATASET_CACHE.idFromName(doId);
      const stub = state.env.DATASET_CACHE.get(id, { locationHint: region as any }) as any as DatasetCache;

      const result = await stub.searchSections({
        datasetId,
        orgId,
        query: q,
        page,
        perPage,
        maxChunksPerFile,
        snippetLength,
        region,
      });

      return result;
    },
    openapi: { operationId: 'searchSections' },
  })

  // 5) Search within a dataset (returns section hits as plain text)
  .route({
    method: 'GET',
    path: '/v1/datasets/:datasetId/search.txt',
    params: z.object({ datasetId: DatasetIdSchema }),
    query: SearchSectionsQuerySchema,
    // response: z.string().describe('Plaintext search results'),
    async handler({ request, params, query, state }) {
      const { datasetId } = params;
      const { query: q, page, perPage, maxChunksPerFile, snippetLength } = query;
      const orgId = state.orgId!; // Guaranteed by middleware

      // Get dataset config
      const config = await getDatasetConfig({
        kv: state.env.EYECREST_KV,
        datasetId,
        orgId,
        request: request as Request
      });
      const region = config.primaryRegion;

      // Create DO ID and stub with locationHint
      const doId = getDurableObjectId({ datasetId, region });
      const id = state.env.DATASET_CACHE.idFromName(doId);
      const stub = state.env.DATASET_CACHE.get(id, { locationHint: region as any }) as any as DatasetCache;

      const result = await stub.searchSectionsText({
        datasetId,
        orgId,
        query: q,
        page,
        perPage,
        maxChunksPerFile,
        snippetLength,
        region,
      });

      return new Response(result, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
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
   Dataset Configuration Types and Helpers
   ==================================================================== */

const DEFAULT_REGION = 'wnam' as const;

// DatasetConfig is eventually consistent. stored in KV. it must only be used for things that are immutable. never updated.
interface DatasetConfig {
  primaryRegion: DurableObjectLocationHint;
  orgId: string;
}

interface GeolocationInfo {
  continent?: string;
  latitude?: number;
  longitude?: number;
}

/* ======================================================================
   Region Hint Calculation
   ==================================================================== */

function getClosestDurableObjectRegion({ continent, latitude, longitude }: GeolocationInfo): DurableObjectLocationHint {
  const lon = longitude;
  const lat = latitude;
  switch (continent) {
    case "NA": // North America
      // Western North America (wnam): Pacific coast, Rockies, Alaska
      // Eastern North America (enam): East of Rockies, down to Florida
      return lon && lon < -100
        ? "wnam" /* Western North America */
        : "enam" /* Eastern North America */;

    case "SA": // South America
      return "sam" /* South America */;

    case "EU": // Europe
      // Western Europe (weur): Ireland, UK, France, Spain, Benelux, etc.
      // Eastern Europe (eeur): Germany eastward, Poland, Balkans, etc.
      return lon && lon < 25
        ? "weur" /* Western Europe */
        : "eeur" /* Eastern Europe */;

    case "AS": // Asia
      // Middle East (me): roughly longitudes 30°E–60°E & latitudes 10°N–48°N
      // Asia-Pacific (apac): the rest of Asia (East, South, SE Asia)
      if (lon && lat && lon >= 30 && lon <= 60 && lat >= 10 && lat <= 48) {
        return "me" /* Middle East */;
      } else {
        return "apac" /* Asia-Pacific */;
      }

    case "OC": // Oceania (Australia, NZ, Pacific Islands)
      return "oc" /* Oceania */;

    case "AF": // Africa
      return "afr" /* Africa */;

    case "AN": // Antarctica (no direct DO region; choose a sensible fallback)
      return "wnam" /* Fallback to Western North America */;

    default:   // Unknown or unsupported continent
      return DEFAULT_REGION /* Fallback to default region */;
  }
}

/* ======================================================================
   Dataset Configuration Helpers
   ==================================================================== */

interface GetDatasetConfigArgs {
  kv: KVNamespace;
  datasetId: string;
  orgId: string;
  request: Request;
}

async function getDatasetConfig({ kv, datasetId, orgId, request }: GetDatasetConfigArgs): Promise<DatasetConfig> {
  const key = `dataset:${datasetId}`;
  const configJson = await kv.get(key);

  if (configJson) {
    return JSON.parse(configJson);
  }

  // Create new config with region based on request location
  const region = getClosestDurableObjectRegion({
    continent: request.cf?.continent as string | undefined,
    latitude: request.cf?.latitude as number | undefined,
    longitude: request.cf?.longitude as number | undefined
  })

  const config: DatasetConfig = { primaryRegion: region, orgId };
  await kv.put(key, JSON.stringify(config));

  return config;
}

interface GetDurableObjectIdArgs {
  datasetId: string;
  region: DurableObjectLocationHint;
  shard?: number;
}

function getDurableObjectId({ datasetId, region, shard = 0 }: GetDurableObjectIdArgs): string {
  return `${region}.${shard}.${datasetId}`;
}

/* ======================================================================
   Export and Utility Functions
   ==================================================================== */

// Export the app for client generation
export { app };

export default {
  fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
    app.handle(req, { state: { env, ctx, orgId: null } }),
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
