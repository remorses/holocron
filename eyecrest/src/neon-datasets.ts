import { DurableObject } from "cloudflare:workers";
import { createApiClient, EndpointType } from '@neondatabase/api-client';
import { neon } from '@neondatabase/serverless';
import { z } from "zod";
import Slugger from "github-slugger";
import {
  parseMarkdownIntoSections,
  isSupportedMarkdownFile,
  Section
} from "./markdown-parser.js";
import { cleanMarkdownContent } from "./markdown-cleaner.js";
import { computeGitBlobSHA } from "./sha-utils.js";

// Import types and interfaces from worker.ts
import { DatasetsInterface } from "./worker.js";
import type {
  FileSchema,
  SearchSectionsResponse,
  BaseDatasetParamsSchema,
  UpsertDatasetParamsSchema,
  UpsertFilesParamsSchema,
  DeleteFilesParamsSchema,
  GetFileContentsParamsSchema,
  SearchSectionsParamsSchema,
  SyncFromPrimaryParamsSchema,
  GetFileContentsResultSchema,
  GetDatasetSizeResponseSchema,
  DurableObjectRegion,
  Env
} from "./worker.js";

// Map Cloudflare regions to Neon regions
const REGION_TO_NEON: Record<DurableObjectRegion, string> = {
  wnam: "aws-us-west-2",      // Western North America -> US West
  enam: "aws-us-east-1",       // Eastern North America -> US East
  weur: "aws-eu-central-1",    // Western Europe -> EU Central
  eeur: "aws-eu-central-1",    // Eastern Europe -> EU Central (no east region)
  apac: "aws-ap-southeast-1",  // Asia Pacific -> Singapore
  me: "aws-eu-central-1",      // Middle East -> EU Central (closest)
  sam: "aws-us-east-1",        // South America -> US East (closest)
  oc: "aws-ap-southeast-1",    // Oceania -> Singapore (closest)
  afr: "aws-eu-central-1",     // Africa -> EU Central (closest)
};

interface NeonProjectInfo {
  projectId: string;
  connectionUri: string;
  branchId: string;
}

export class NeonDatasets extends DurableObject implements DatasetsInterface {
  private datasetId?: string;
  private doRegion?: DurableObjectRegion;
  private replicaRegions: DurableObjectRegion[] = [];
  protected env: Env;
  protected state: DurableObjectState;
  private sql?: ReturnType<typeof neon>;
  private neonApi?: ReturnType<typeof createApiClient>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.env = env;
    this.state = state;
  }

  private getNeonApi() {
    if (!this.neonApi) {
      if (!this.env.NEON_API_KEY) {
        throw new Error('NEON_API_KEY not configured');
      }
      this.neonApi = createApiClient({ apiKey: this.env.NEON_API_KEY });
    }
    return this.neonApi;
  }

  private async getOrCreateNeonProject(): Promise<NeonProjectInfo> {
    if (!this.datasetId) {
      throw new Error('Dataset ID not set');
    }

    // Check if we already have a project
    const stored = await this.state.storage.get<NeonProjectInfo>('neon:project');
    if (stored) {
      return stored;
    }

    // Create a new project
    const api = this.getNeonApi();
    const neonRegion = REGION_TO_NEON[this.doRegion || 'wnam'];
    
    const { data } = await api.createProject({
      project: { 
        name: `eyecrest-${this.datasetId}`, 
        region_id: neonRegion,
        pg_version: 17
      }
    });

    const project = data.project;
    const branch = data.branch;
    const roles = data.roles;
    const databases = data.databases;
    const connectionUris = data.connection_uris;

    // The branch is created with the default database, so we might not need to create another one
    let connectionUri = '';
    if (connectionUris && connectionUris.length > 0) {
      connectionUri = connectionUris[0].connection_uri;
    }

    // If we need an endpoint, we can create one
    if (!connectionUri && branch) {
      const { data: endpointData } = await api.createProjectEndpoint(project.id, {
        endpoint: {
          branch_id: branch.id,
          type: EndpointType.ReadWrite,
          region_id: project.region_id,
          autoscaling_limit_min_cu: 0.25,
          autoscaling_limit_max_cu: 0.25
        }
      });
      
      if (endpointData.endpoint) {
        connectionUri = endpointData.endpoint.host;
        // Build connection URI with the first role
        if (roles && roles.length > 0) {
          connectionUri = `postgresql://${roles[0].name}:****@${endpointData.endpoint.host}/neondb?sslmode=require`;
        }
      }
    }

    const projectInfo: NeonProjectInfo = {
      projectId: project.id,
      connectionUri: connectionUri,
      branchId: branch?.id || ''
    };

    // Store project info
    await this.state.storage.put('neon:project', projectInfo);

    // Initialize schema
    await this.initializeSchema(connectionUri);

    return projectInfo;
  }

  private async initializeSchema(connectionUri: string) {
    const sql = neon(connectionUri);

    // Create extensions
    // Note: Neon might not have pg_search or pgvector extensions
    // We'll use PostgreSQL's built-in full text search instead

    // Create files table
    await sql`CREATE TABLE IF NOT EXISTS files (
      filename TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      sha TEXT NOT NULL,
      metadata JSONB,
      weight REAL DEFAULT 1.0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    // Create sections table  
    await sql`CREATE TABLE IF NOT EXISTS sections (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL REFERENCES files(filename) ON DELETE CASCADE,
      section_slug TEXT,
      content TEXT NOT NULL,
      level INTEGER NOT NULL,
      order_index INTEGER NOT NULL,
      start_line INTEGER NOT NULL,
      weight REAL DEFAULT 1.0,
      UNIQUE(filename, order_index)
    )`;

    // Create GIN index for full text search
    await sql`CREATE INDEX IF NOT EXISTS sections_content_idx 
      ON sections USING GIN (to_tsvector('english', content))`;
  }

  private async getSql() {
    if (!this.sql) {
      const projectInfo = await this.getOrCreateNeonProject();
      this.sql = neon(projectInfo.connectionUri);
    }
    return this.sql;
  }

  private async loadDatasetInfo(datasetId: string): Promise<void> {
    this.datasetId = datasetId;
    const doIdParts = this.state.id.toString().split('.');
    this.doRegion = doIdParts[0] as DurableObjectRegion;
    
    const datasetInfo = await this.state.storage.get<{
      orgId: string;
      primaryRegion: DurableObjectRegion;
      replicaRegions?: DurableObjectRegion[];
    }>(`dataset:${datasetId}`);
    
    if (datasetInfo) {
      this.replicaRegions = datasetInfo.replicaRegions || [];
    }
  }

  private async verifyDatasetOwnership(datasetId: string, orgId: string): Promise<void> {
    const info = await this.state.storage.get<{ orgId: string }>(`dataset:${datasetId}`);
    if (!info) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }
    
    if (info.orgId !== orgId) {
      throw new Error(`Unauthorized: dataset ${datasetId} belongs to organization ${info.orgId}, but you are authenticated as ${orgId}`);
    }
  }

  async upsertDataset(params: z.infer<typeof UpsertDatasetParamsSchema>): Promise<void> {
    const { datasetId, orgId, region, isPrimary, replicaRegions, waitForReplication = true } = params;
    
    console.log(`[neon-upsert-dataset] Creating/updating dataset ${datasetId} in region ${region}`);
    
    // Load dataset info
    await this.loadDatasetInfo(datasetId);
    
    // Check if dataset already exists
    const existingInfo = await this.state.storage.get<{
      orgId: string;
      primaryRegion: DurableObjectRegion;
      createdAt: number;
    }>(`dataset:${datasetId}`);
    
    if (existingInfo) {
      // Verify ownership
      if (existingInfo.orgId !== orgId) {
        throw new Error(`Dataset ${datasetId} already exists and belongs to organization ${existingInfo.orgId}`);
      }
      
      // Update replica regions if needed
      if (isPrimary && replicaRegions) {
        await this.state.storage.put(`dataset:${datasetId}`, {
          ...existingInfo,
          replicaRegions
        });
      }
    } else {
      // New dataset
      const info = {
        orgId,
        primaryRegion: isPrimary ? region : this.doRegion!,
        createdAt: Date.now(),
        replicaRegions: isPrimary ? replicaRegions : undefined
      };
      
      await this.state.storage.put(`dataset:${datasetId}`, info);
      
      // Ensure Neon project is created
      await this.getOrCreateNeonProject();
    }
    
    this.replicaRegions = (replicaRegions || []) as DurableObjectRegion[];
    
    // Handle replica creation
    if (isPrimary && replicaRegions && replicaRegions.length > 0) {
      const replicaPromise = Promise.all(
        replicaRegions
          .filter(replicaRegion => replicaRegion !== this.doRegion)
          .map(async (replicaRegion: string) => {
            try {
              const replicaDoId = getDurableObjectId({ datasetId, region: replicaRegion as DurableObjectRegion });
              const replicaId = this.env.NEON_DATASETS.idFromName(replicaDoId);
              const replicaStub = this.env.NEON_DATASETS.get(replicaId, { locationHint: replicaRegion as DurableObjectRegion }) as unknown as DatasetsInterface;
              
              await replicaStub.upsertDataset({
                datasetId,
                orgId,
                region: replicaRegion,
                isPrimary: false
              });
              
              await replicaStub.syncFromPrimary({ datasetId, orgId, primaryRegion: region });
            } catch (error) {
              console.error(`[neon-replica] Failed to create replica in ${replicaRegion}:`, error);
            }
          })
      );
      
      if (waitForReplication) {
        await replicaPromise;
      } else {
        this.state.waitUntil(replicaPromise);
      }
    }
  }

  async upsertFiles(params: z.infer<typeof UpsertFilesParamsSchema>): Promise<void> {
    const { datasetId, orgId, files, region, waitForReplication = true } = params;
    
    console.log(`[neon-upsert] Starting upsertFiles for dataset ${datasetId} with ${files.length} files`);
    
    // Load dataset info if not already loaded
    if (!this.datasetId || this.datasetId !== datasetId) {
      await this.loadDatasetInfo(datasetId);
    }
    
    // Verify ownership
    await this.verifyDatasetOwnership(datasetId, orgId);
    
    const sql = await this.getSql();
    
    // Process each file
    let processedCount = 0;
    
    for (const file of files) {
      const computedSHA = await computeGitBlobSHA(file.content);
      
      // Check if file exists and SHA matches
      const existing = await sql`
        SELECT sha FROM files WHERE filename = ${file.filename}
      ` as { sha: string }[];
      
      if (existing.length > 0 && existing[0].sha === computedSHA) {
        continue; // Skip unchanged files
      }
      
      processedCount++;
      
      // Upsert file
      await sql`
        INSERT INTO files (filename, content, sha, metadata, weight, updated_at)
        VALUES (${file.filename}, ${file.content}, ${computedSHA}, ${JSON.stringify(file.metadata)}, ${file.weight || 1.0}, NOW())
        ON CONFLICT (filename) 
        DO UPDATE SET 
          content = EXCLUDED.content,
          sha = EXCLUDED.sha,
          metadata = EXCLUDED.metadata,
          weight = EXCLUDED.weight,
          updated_at = NOW()
      `;
      
      // Delete existing sections
      await sql`DELETE FROM sections WHERE filename = ${file.filename}`;
      
      // Process sections if markdown
      if (isSupportedMarkdownFile(file.filename)) {
        const parsed = parseMarkdownIntoSections(file.content);
        const slugger = new Slugger();
        
        // Insert sections
        for (const section of parsed.sections) {
          await sql`
            INSERT INTO sections (filename, section_slug, content, level, order_index, start_line, weight)
            VALUES (
              ${file.filename},
              ${section.headingSlug || ''},
              ${section.content},
              ${section.level},
              ${section.orderIndex},
              ${section.startLine},
              ${section.weight ?? file.weight ?? 1.0}
            )
          `;
        }
      }
    }
    
    console.log(`[neon-upsert] Processed ${processedCount} files`);
    
    // Forward writes to replicas if this is the primary
    if ((await this.isPrimary()) && processedCount > 0) {
      const replicas = await this.getReplicaStubs(datasetId);
      if (replicas.length > 0) {
        const replicationPromise = Promise.all(
          replicas.map(async ({ region, stub }) => {
            try {
              await stub.upsertFiles({
                datasetId,
                orgId,
                files,
                region,
                waitForReplication: false
              });
            } catch (error) {
              console.error(`[neon-replica] Failed to replicate to ${region}:`, error);
            }
          })
        );
        
        if (waitForReplication) {
          await replicationPromise;
        } else {
          this.state.waitUntil(replicationPromise);
        }
      }
    }
  }

  async deleteFiles(params: z.infer<typeof DeleteFilesParamsSchema>): Promise<void> {
    const { datasetId, orgId, filenames, region, waitForReplication = true } = params;
    
    // Load dataset info if not already loaded
    if (!this.datasetId || this.datasetId !== datasetId) {
      await this.loadDatasetInfo(datasetId);
    }
    
    // Verify ownership
    await this.verifyDatasetOwnership(datasetId, orgId);
    
    const sql = await this.getSql();
    
    // Delete files (sections will cascade)
    await sql`
      DELETE FROM files 
      WHERE filename = ANY(${filenames})
    `;
    
    // Forward deletes to replicas if this is the primary
    if ((await this.isPrimary()) && filenames.length > 0) {
      const replicas = await this.getReplicaStubs(datasetId);
      if (replicas.length > 0) {
        const replicationPromise = Promise.all(
          replicas.map(async ({ region, stub }) => {
            try {
              await stub.deleteFiles({
                datasetId,
                orgId,
                filenames,
                region,
                waitForReplication: false
              });
            } catch (error) {
              console.error(`[neon-replica] Failed to replicate delete to ${region}:`, error);
            }
          })
        );
        
        if (waitForReplication) {
          await replicationPromise;
        } else {
          this.state.waitUntil(replicationPromise);
        }
      }
    }
  }

  async deleteDataset(params: z.infer<typeof BaseDatasetParamsSchema>): Promise<void> {
    const { datasetId, orgId } = params;
    
    console.log(`[neon-delete] Deleting dataset ${datasetId}`);
    
    // Load dataset info if not already loaded
    if (!this.datasetId || this.datasetId !== datasetId) {
      await this.loadDatasetInfo(datasetId);
    }
    
    // Verify ownership
    await this.verifyDatasetOwnership(datasetId, orgId);
    
    // Delete Neon project
    const projectInfo = await this.state.storage.get<NeonProjectInfo>('neon:project');
    if (projectInfo) {
      const api = this.getNeonApi();
      try {
        await api.deleteProject(projectInfo.projectId);
      } catch (error) {
        console.error('[neon-delete] Failed to delete Neon project:', error);
      }
    }
    
    // Delete all stored metadata
    await this.state.storage.deleteAll();
    
    // If this is the primary, notify replicas to delete themselves
    if (await this.isPrimary()) {
      const replicas = await this.getReplicaStubs(datasetId);
      if (replicas.length > 0) {
        this.state.waitUntil(
          Promise.all(
            replicas.map(async ({ region, stub }) => {
              try {
                await stub.deleteDataset({ datasetId, orgId });
              } catch (error) {
                console.error(`[neon-replica] Failed to delete replica in ${region}:`, error);
              }
            })
          )
        );
      }
    }
  }

  async getFileContents(params: z.infer<typeof GetFileContentsParamsSchema>): Promise<
    z.infer<typeof GetFileContentsResultSchema>
  > {
    const { datasetId, orgId, filePath, showLineNumbers, start, end, region, getAllFiles = false } = params;
    
    // Load dataset info if not already loaded
    if (!this.datasetId || this.datasetId !== datasetId) {
      await this.loadDatasetInfo(datasetId);
    }
    
    // Verify ownership
    await this.verifyDatasetOwnership(datasetId, orgId);
    
    const sql = await this.getSql();
    
    if (getAllFiles) {
      // Get all files
      const files = await sql`
        SELECT filename, content, sha, metadata, weight
        FROM files
        ORDER BY filename
      ` as { filename: string; content: string; sha: string; metadata: any; weight: number }[];
      
      return {
        files: files.map(f => ({
          filename: f.filename,
          content: f.content,
          sha: f.sha,
          metadata: f.metadata,
          weight: f.weight
        }))
      };
    }
    
    // Single file mode
    if (!filePath) {
      throw new Error('filePath is required when getAllFiles is false');
    }
    
    const result = await sql`
      SELECT filename, content, sha, metadata, weight
      FROM files
      WHERE filename = ${filePath}
    ` as { filename: string; content: string; sha: string; metadata: any; weight: number }[];
    
    if (!result || result.length === 0) {
      throw new Error(`File not found: ${filePath} in dataset ${datasetId}`);
    }
    
    let content = result[0].content;
    
    // Apply line formatting if requested
    if (showLineNumbers || start !== undefined || end !== undefined) {
      content = formatFileWithLines(content, showLineNumbers || false, start, end);
    }
    
    return {
      files: [{
        filename: result[0].filename,
        content,
        sha: result[0].sha,
        metadata: result[0].metadata,
        weight: result[0].weight
      }]
    };
  }

  async searchSections(params: z.infer<typeof SearchSectionsParamsSchema>): Promise<SearchSectionsResponse> {
    const { datasetId, orgId, query, page = 0, perPage = 20, maxChunksPerFile = 5, snippetLength = 300, region } = params;
    
    // Load dataset info if not already loaded
    if (!this.datasetId || this.datasetId !== datasetId) {
      await this.loadDatasetInfo(datasetId);
    }
    
    // Verify ownership
    await this.verifyDatasetOwnership(datasetId, orgId);
    
    const sql = await this.getSql();
    
    // Use PostgreSQL's built-in full text search
    const offset = page * perPage;
    const limit = perPage + 1; // Get one extra to check for next page
    
    const results = await sql`
      WITH search_results AS (
        SELECT 
          s.id,
          s.filename,
          s.section_slug,
          s.content,
          s.start_line,
          s.weight as section_weight,
          f.weight as file_weight,
          f.metadata as file_metadata,
          ts_rank(to_tsvector('english', s.content), plainto_tsquery('english', ${query})) as score,
          ROW_NUMBER() OVER (PARTITION BY s.filename ORDER BY ts_rank(to_tsvector('english', s.content), plainto_tsquery('english', ${query})) DESC) as rn
        FROM sections s
        JOIN files f ON s.filename = f.filename
        WHERE to_tsvector('english', s.content) @@ plainto_tsquery('english', ${query})
        ORDER BY score DESC
      )
      SELECT *
      FROM search_results
      WHERE rn <= ${maxChunksPerFile}
      ORDER BY score DESC
      LIMIT ${limit}
      OFFSET ${offset}
    ` as {
      filename: string;
      section_slug: string;
      content: string;
      start_line: number;
      section_weight: number;
      file_weight: number;
      file_metadata: any;
      score: number;
    }[];
    
    const hasNext = results.length > perPage;
    const items = results.slice(0, perPage);
    
    const formattedResults = items.map(r => ({
      filename: r.filename,
      sectionSlug: r.section_slug,
      snippet: r.content.substring(0, snippetLength),
      cleanedSnippet: cleanMarkdownContent(r.content.substring(0, snippetLength)),
      score: r.score,
      startLine: r.start_line,
      metadata: r.file_metadata
    }));
    
    return {
      results: formattedResults,
      hasNextPage: hasNext,
      page,
      perPage,
      region: this.doRegion || 'unknown'
    };
  }

  async getDatasetSize(params: z.infer<typeof BaseDatasetParamsSchema>): Promise<
    z.infer<typeof GetDatasetSizeResponseSchema>
  > {
    const { datasetId, orgId } = params;
    
    // Load dataset info if not already loaded
    if (!this.datasetId || this.datasetId !== datasetId) {
      await this.loadDatasetInfo(datasetId);
    }
    
    // Verify ownership
    await this.verifyDatasetOwnership(datasetId, orgId);
    
    const sql = await this.getSql();
    
    const stats = await sql`
      SELECT 
        COUNT(DISTINCT f.filename)::text as file_count,
        COUNT(s.id)::text as section_count,
        COALESCE(SUM(LENGTH(f.content)), 0)::text as content_size,
        COALESCE(SUM(LENGTH(f.metadata::text)), 0)::text as metadata_size
      FROM files f
      LEFT JOIN sections s ON f.filename = s.filename
    ` as {
      file_count: string;
      section_count: string;
      content_size: string;
      metadata_size: string;
    }[];
    
    const result = stats[0] || { file_count: '0', section_count: '0', content_size: '0', metadata_size: '0' };
    const totalSize = Number(result.content_size) + Number(result.metadata_size);
    
    return {
      totalSizeBytes: totalSize,
      uploadedContentSizeBytes: Number(result.content_size),
      fileCount: Number(result.file_count),
      sectionCount: Number(result.section_count),
      breakdown: {
        databaseSizeBytes: totalSize,
        contentSizeBytes: Number(result.content_size),
        metadataSizeBytes: Number(result.metadata_size)
      }
    };
  }

  async syncFromPrimary(params: z.infer<typeof SyncFromPrimaryParamsSchema>): Promise<void> {
    const { datasetId, orgId, primaryRegion } = params;
    
    console.log(`[neon-sync] Starting sync for dataset ${datasetId} in region ${this.doRegion}`);
    
    try {
      // Create primary stub
      const primaryDoId = getDurableObjectId({ datasetId, region: primaryRegion as DurableObjectRegion });
      const primaryId = this.env.NEON_DATASETS.idFromName(primaryDoId);
      const primaryStub = this.env.NEON_DATASETS.get(primaryId, { locationHint: primaryRegion as DurableObjectRegion }) as unknown as DatasetsInterface;
      
      // Get all data from primary
      const result = await primaryStub.getFileContents({ datasetId, orgId, getAllFiles: true });
      const files = result.files;
      
      console.log(`[neon-sync] Received ${files.length} files from primary`);
      
      if (files.length === 0) {
        console.log(`[neon-sync] No files to sync`);
        return;
      }
      
      // Use upsertFiles to import all data
      await this.upsertFiles({
        datasetId,
        orgId,
        files: files.map(f => ({
          filename: f.filename,
          content: f.content,
          metadata: f.metadata,
          weight: f.weight || 1.0
        })),
        region: this.doRegion,
        waitForReplication: false
      });
      
      console.log(`[neon-sync] Successfully synced ${files.length} files`);
    } catch (error) {
      console.error(`[neon-sync] Failed to sync data:`, error);
      throw new Error(`Failed to sync data from primary: ${error.message}`);
    }
  }

  private async isPrimary(): Promise<boolean> {
    if (!this.doRegion || !this.datasetId) {
      throw new Error('DO region and datasetId must be set before checking primary status');
    }
    
    const info = await this.state.storage.get<{
      primaryRegion: DurableObjectRegion;
    }>(`dataset:${this.datasetId}`);
    
    return info?.primaryRegion === this.doRegion;
  }

  private async getReplicaStubs(datasetId: string): Promise<Array<{ region: DurableObjectRegion; stub: DatasetsInterface }>> {
    if (!(await this.isPrimary()) || this.replicaRegions.length === 0) {
      return [];
    }
    
    return this.replicaRegions.map(region => {
      const doId = getDurableObjectId({ datasetId, region });
      const id = this.env.NEON_DATASETS.idFromName(doId);
      const stub = this.env.NEON_DATASETS.get(id, { locationHint: region }) as unknown as DatasetsInterface;
      return { region, stub };
    });
  }
}

// Helper function from worker.ts
function getDurableObjectId({ datasetId, region, shard = 0 }: {
  datasetId: string;
  region: DurableObjectRegion;
  shard?: number;
}): string {
  return `${region}.${shard}.${datasetId}`;
}

// Helper function for formatting file content with line numbers
function formatFileWithLines(
  contents: string,
  showLineNumbers: boolean,
  startLine?: number,
  endLine?: number
): string {
  const lines = contents.split('\n');
  
  // Apply line range filter if specified
  const filteredLines = startLine !== undefined || endLine !== undefined
    ? lines.slice((startLine || 1) - 1, endLine || lines.length)
    : lines;
  
  // Show line numbers if requested or if line ranges are specified
  const shouldShowLineNumbers = showLineNumbers || startLine !== undefined || endLine !== undefined;
  
  if (shouldShowLineNumbers) {
    const startLineNumber = startLine || 1;
    const maxLineNumber = startLineNumber + filteredLines.length - 1;
    const padding = maxLineNumber.toString().length;
    
    const formattedLines = filteredLines.map((line, index) => {
      const lineNumber = startLineNumber + index;
      const paddedNumber = lineNumber.toString().padStart(padding, ' ');
      return `${paddedNumber}  ${line}`;
    });
    
    return formattedLines.join('\n');
  }
  
  return filteredLines.join('\n');
}