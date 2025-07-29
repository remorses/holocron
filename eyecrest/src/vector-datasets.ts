/* -----------------------------------------------------------------------
   Cloudflare Worker + Durable Object - Upstash Vector-based Implementation
   -------------------------------------------------------------------- */
import { DurableObject } from "cloudflare:workers";
import { Index } from "@upstash/vector";
import { z } from "zod";
import Slugger from "github-slugger";
import { 
  parseMarkdownIntoSections, 
  isSupportedMarkdownFile, 
  Section 
} from "./markdown-parser.js";
import { cleanMarkdownContent } from "./markdown-cleaner.js";
import { computeGitBlobSHA } from "./sha-utils.js";

// Types from worker.ts that we need
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

// Map regions to Upstash Vector index URLs
const REGION_INDEX_URLS: Record<string, string> = {
  // All regions use the US index for now (until we have EU token configured)
  wnam: "https://renewing-mullet-58478-us1-vector.upstash.io",
  enam: "https://renewing-mullet-58478-us1-vector.upstash.io",
  weur: "https://renewing-mullet-58478-us1-vector.upstash.io",
  eeur: "https://renewing-mullet-58478-us1-vector.upstash.io",
  apac: "https://renewing-mullet-58478-us1-vector.upstash.io",
  me: "https://renewing-mullet-58478-us1-vector.upstash.io",
  sam: "https://renewing-mullet-58478-us1-vector.upstash.io",
  oc: "https://renewing-mullet-58478-us1-vector.upstash.io",
  afr: "https://renewing-mullet-58478-us1-vector.upstash.io",
};

interface VectorMetadata {
  filename: string;
  sha: string;
  fileMetadata?: any;
  weight: number;
  sectionSlug: string;
  startLine: number;
  level: number;
  orderIndex: number;
  [key: string]: any; // Index signature for Upstash compatibility
}

interface FileMetadata {
  sha: string;
  metadata?: any;
  weight: number;
  contentLength: number;
  sectionCount: number;
  content: string;
}

export class UpstashVectorDatasets extends DurableObject implements DatasetsInterface {
  private datasetId?: string;
  private doRegion?: DurableObjectRegion;
  private replicaRegions: DurableObjectRegion[] = [];
  protected env: Env;
  private state: DurableObjectState;
  private vectorIndex?: Index;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.env = env;
    this.state = state;
  }

  private getVectorIndex(): Index {
    if (!this.vectorIndex) {
      if (!this.doRegion) {
        throw new Error('DO region must be set before accessing vector index');
      }
      
      const indexUrl = REGION_INDEX_URLS[this.doRegion];
      if (!indexUrl) {
        throw new Error(`No index URL configured for region ${this.doRegion}`);
      }

      // Get the token from environment
      const token = this.env.UPSTASH_VECTOR_REST_TOKEN;
      if (!token) {
        throw new Error('UPSTASH_VECTOR_REST_TOKEN not configured');
      }

      this.vectorIndex = new Index({
        url: indexUrl,
        token: token,
      });
    }
    return this.vectorIndex;
  }

  private getNamespace(): string {
    if (!this.datasetId) {
      throw new Error('Dataset ID must be set');
    }
    return this.datasetId;
  }

  /* ---------- Private Methods ------------- */

  private async loadDatasetInfo(datasetId: string): Promise<void> {
    // In the vector implementation, we store dataset info in Durable Object storage
    const info = await this.state.storage.get<{
      datasetId: string;
      doRegion: DurableObjectRegion;
      replicaRegions: DurableObjectRegion[];
      orgId: string;
      primaryRegion: DurableObjectRegion;
    }>(`dataset:${datasetId}`);
    
    if (info) {
      this.datasetId = info.datasetId;
      this.doRegion = info.doRegion;
      this.replicaRegions = info.replicaRegions || [];
    } else {
      throw new Error(`Dataset ${datasetId} not found`);
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

  private async getReplicaStubs(datasetId: string): Promise<Array<{ region: DurableObjectRegion; stub: any }>> {
    if (!(await this.isPrimary()) || this.replicaRegions.length === 0) {
      return [];
    }

    return this.replicaRegions.map(region => {
      const doId = getDurableObjectId({ datasetId, region });
      const id = this.env.UPSTASH_VECTOR_DATASETS.idFromName(doId);
      const stub = this.env.UPSTASH_VECTOR_DATASETS.get(id, { locationHint: region });
      return { region, stub };
    });
  }

  /* ---------- API Methods ------------- */

  async upsertDataset(params: z.infer<typeof UpsertDatasetParamsSchema>): Promise<void> {
    const { datasetId, orgId, region, isPrimary, replicaRegions, waitForReplication = true } = params;
    
    // Set the DO region if not already set
    if (!this.doRegion) {
      this.doRegion = region as DurableObjectRegion;
    } else if (this.doRegion !== region) {
      throw new Error(`Region mismatch: DO is in ${this.doRegion} but request says ${region}`);
    }

    this.datasetId = datasetId;

    // Check if dataset already exists
    const existingInfo = await this.state.storage.get<any>(`dataset:${datasetId}`);
    
    if (!existingInfo) {
      // Create new dataset info
      const datasetInfo = {
        datasetId,
        orgId,
        doRegion: this.doRegion,
        primaryRegion: isPrimary ? this.doRegion : region,
        replicaRegions: replicaRegions || [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      await this.state.storage.put(`dataset:${datasetId}`, datasetInfo);
    } else {
      // Verify ownership
      if (existingInfo.orgId !== orgId) {
        throw new Error(`Dataset ${datasetId} already exists and belongs to organization ${existingInfo.orgId}`);
      }
      
      // Update replica regions if needed
      if (replicaRegions && isPrimary) {
        existingInfo.replicaRegions = replicaRegions;
        existingInfo.updatedAt = Date.now();
        await this.state.storage.put(`dataset:${datasetId}`, existingInfo);
      }
    }

    this.replicaRegions = (replicaRegions || []) as DurableObjectRegion[];

    // If this is the primary and we have replica regions, create/update replica DOs
    if (isPrimary && replicaRegions && replicaRegions.length > 0) {
      const replicaPromise = Promise.all(
        replicaRegions
          .filter(replicaRegion => replicaRegion !== this.doRegion)
          .map(async (replicaRegion: string) => {
            try {
              const replicaDoId = getDurableObjectId({ datasetId, region: replicaRegion as DurableObjectRegion });
              const replicaId = this.env.UPSTASH_VECTOR_DATASETS.idFromName(replicaDoId);
              const replicaStub = this.env.UPSTASH_VECTOR_DATASETS.get(replicaId, { locationHint: replicaRegion as DurableObjectRegion }) as any;

              // Create the replica DO
              await replicaStub.upsertDataset({
                datasetId,
                orgId,
                region: replicaRegion,
                isPrimary: false,
                replicaRegions: []
              });
            } catch (error) {
              console.error(`Failed to create replica in ${replicaRegion}:`, error);
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
    
    console.log(`[vector-upsert] Starting upsertFiles for dataset ${datasetId} with ${files.length} files`);
    
    // Load dataset info if not already loaded
    if (!this.datasetId || this.datasetId !== datasetId) {
      await this.loadDatasetInfo(datasetId);
    }

    // Verify ownership
    await this.verifyDatasetOwnership(datasetId, orgId);

    const index = this.getVectorIndex();
    const namespace = this.getNamespace();
    
    // Process each file
    let processedCount = 0;
    const vectorsToUpsert: Array<{
      id: string;
      data: string;
      metadata: VectorMetadata;
    }> = [];

    for (const file of files) {
      const computedSHA = await computeGitBlobSHA(file.content);
      
      // Store file metadata in DO storage
      const fileKey = `file:${file.filename}`;
      const existingFile = await this.state.storage.get<FileMetadata>(fileKey);
      
      // Skip if SHA hasn't changed
      if (existingFile && existingFile.sha === computedSHA) {
        continue;
      }

      processedCount++;

      // Parse and index sections if it's a markdown file
      let sectionCount = 0;
      if (isSupportedMarkdownFile(file.filename)) {
        const parsed = parseMarkdownIntoSections(file.content);
        sectionCount = parsed.sections.length;
        const slugger = new Slugger();

        for (const section of parsed.sections) {
          const vectorId = `${file.filename}:${section.headingSlug || `section-${section.orderIndex}`}`;
          
          vectorsToUpsert.push({
            id: vectorId,
            data: section.content, // Upstash will handle embedding generation
            metadata: {
              filename: file.filename,
              sha: computedSHA,
              fileMetadata: file.metadata,
              weight: section.weight ?? file.weight ?? 1.0,
              sectionSlug: section.headingSlug,
              startLine: section.startLine,
              level: section.level,
              orderIndex: section.orderIndex
            }
          });
        }
      } else {
        // For non-markdown files, index the entire content
        vectorsToUpsert.push({
          id: file.filename,
          data: file.content,
          metadata: {
            filename: file.filename,
            sha: computedSHA,
            fileMetadata: file.metadata,
            weight: file.weight || 1.0,
            sectionSlug: '',
            startLine: 1,
            level: 0,
            orderIndex: 0
          }
        });
        sectionCount = 1; // Non-markdown files have 1 section
      }
      
      // Update file metadata
      await this.state.storage.put(fileKey, {
        sha: computedSHA,
        metadata: file.metadata,
        weight: file.weight || 1.0,
        contentLength: file.content.length,
        sectionCount,
        content: file.content
      });
    }

    // Batch upsert vectors
    if (vectorsToUpsert.length > 0) {
      const batchSize = 100; // Upstash recommends batches of 100
      for (let i = 0; i < vectorsToUpsert.length; i += batchSize) {
        const batch = vectorsToUpsert.slice(i, i + batchSize);
        await index.namespace(namespace).upsert(batch);
      }
    }

    console.log(`[vector-upsert] Processed ${processedCount} files, created ${vectorsToUpsert.length} vectors`);

    // Forward writes to replicas if this is the primary
    if ((await this.isPrimary()) && processedCount > 0) {
      const replicas = await this.getReplicaStubs(datasetId);
      if (replicas.length > 0) {
        const replicationPromise = Promise.all(
          replicas.map(async ({ region, stub }) => {
            try {
              await stub.upsertFiles({ datasetId, orgId, files, region, waitForReplication: false });
            } catch (error) {
              console.error(`[vector-upsert] Failed to replicate to ${region}:`, error);
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

    const index = this.getVectorIndex();
    const namespace = this.getNamespace();
    
    // Delete vectors for each file
    const vectorIdsToDelete: string[] = [];
    
    for (const filename of filenames) {
      // Delete file metadata
      await this.state.storage.delete(`file:${filename}`);
      
      // For now, we'll need to query to find all vectors for this file
      // This is a limitation of the vector approach - we can't easily delete by prefix
      // In a production system, we might want to maintain an index of vector IDs per file
      const results = await index.namespace(namespace).query({
        data: filename, // This won't be perfect but might help
        topK: 1000,
        includeData: true,
        includeMetadata: true
      });
      
      for (const result of results) {
        if (result.metadata?.filename === filename) {
          vectorIdsToDelete.push(result.id as string);
        }
      }
    }

    // Delete vectors in batches
    if (vectorIdsToDelete.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < vectorIdsToDelete.length; i += batchSize) {
        const batch = vectorIdsToDelete.slice(i, i + batchSize);
        await index.namespace(namespace).delete(batch);
      }
    }

    // Forward deletes to replicas if this is the primary
    if ((await this.isPrimary()) && filenames.length > 0) {
      const replicas = await this.getReplicaStubs(datasetId);
      if (replicas.length > 0) {
        const replicationPromise = Promise.all(
          replicas.map(async ({ region, stub }) => {
            try {
              await stub.deleteFiles({ datasetId, orgId, filenames, region, waitForReplication: false });
            } catch (error) {
              console.error(`[vector-delete] Failed to replicate to ${region}:`, error);
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
    
    // Load dataset info if not already loaded
    if (!this.datasetId || this.datasetId !== datasetId) {
      await this.loadDatasetInfo(datasetId);
    }

    // Verify ownership
    await this.verifyDatasetOwnership(datasetId, orgId);

    const index = this.getVectorIndex();
    const namespace = this.getNamespace();
    
    // Delete the entire namespace
    // Delete all vectors in the namespace - need to query first then delete
    const allVectors = await index.namespace(namespace).query({
      data: "",
      topK: 1000,
      includeMetadata: false
    });
    
    
    if (allVectors.length > 0) {
      const ids = allVectors.map(v => v.id as string);
      await index.namespace(namespace).delete(ids);
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
                console.error(`[vector-delete-dataset] Failed to delete replica in ${region}:`, error);
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

    if (getAllFiles) {
      // Get all file metadata from storage
      const files: Array<{
        filename: string;
        content: string;
        sha?: string;
        metadata?: any;
        weight?: number;
      }> = [];

      const allEntries = await this.state.storage.list<FileMetadata>({ prefix: 'file:' });
      
      for (const [key, fileMetadata] of allEntries) {
        const filename = key.substring(5); // Remove 'file:' prefix
        
        files.push({
          filename,
          content: fileMetadata.content || '',
          sha: fileMetadata.sha,
          metadata: fileMetadata.metadata,
          weight: fileMetadata.weight
        });
      }

      return { files };
    }

    // Single file mode
    if (!filePath) {
      throw new Error('filePath is required when getAllFiles is false');
    }

    const fileMetadata = await this.state.storage.get<FileMetadata>(`file:${filePath}`);
    if (!fileMetadata) {
      throw new Error(`File not found: ${filePath} in dataset ${datasetId}`);
    }

    let content = fileMetadata.content || '';
    
    // Apply line formatting if requested
    if (showLineNumbers || start !== undefined || end !== undefined) {
      content = formatFileWithLines(content, showLineNumbers || false, start, end);
    }

    return {
      files: [{
        filename: filePath,
        content,
        sha: fileMetadata.sha,
        metadata: fileMetadata.metadata,
        weight: fileMetadata.weight
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

    const index = this.getVectorIndex();
    const namespace = this.getNamespace();
    
    // Query vectors
    const topK = perPage * (page + 1) + 1; // Get extra to check for next page
    const results = await index.namespace(namespace).query({
      data: query,
      topK,
      includeMetadata: true
    });

    // Group by file and limit per file
    const fileGroups: Record<string, any[]> = {};
    const startIdx = page * perPage;
    let count = 0;

    for (const result of results) {
      if (count >= startIdx + perPage + 1) break;
      
      const metadata = result.metadata as unknown as VectorMetadata;
      const filename = metadata.filename;
      
      if (!fileGroups[filename]) {
        fileGroups[filename] = [];
      }

      if (fileGroups[filename].length < maxChunksPerFile) {
        if (count >= startIdx) {
          // Create snippet
          const content = result.data || '';
          const snippet = content.substring(0, snippetLength);
          
          fileGroups[filename].push({
            filename,
            sectionSlug: metadata.sectionSlug,
            snippet,
            cleanedSnippet: cleanMarkdownContent(snippet),
            score: result.score,
            startLine: metadata.startLine,
            metadata: metadata.fileMetadata
          });
        }
        count++;
      }
    }

    // Flatten results
    const pageResults = Object.values(fileGroups)
      .flat()
      .slice(0, perPage);

    const hasNextPage = count > startIdx + perPage;

    return {
      results: pageResults,
      hasNextPage,
      page,
      perPage,
      region: this.doRegion!
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

    // Count files and estimate sizes
    const fileEntries = await this.state.storage.list<FileMetadata>({ prefix: 'file:' });
    let fileCount = 0;
    let totalContentSize = 0;
    let totalMetadataSize = 0;

    let sectionCount = 0;
    
    for (const [_, metadata] of fileEntries) {
      fileCount++;
      totalContentSize += metadata.contentLength || 0;
      sectionCount += metadata.sectionCount || 0;
      if (metadata.metadata) {
        totalMetadataSize += JSON.stringify(metadata.metadata).length;
      }
    }
    
    return {
      totalSizeBytes: totalContentSize + totalMetadataSize,
      uploadedContentSizeBytes: totalContentSize,
      fileCount,
      sectionCount,
      breakdown: {
        databaseSizeBytes: totalContentSize + totalMetadataSize,
        contentSizeBytes: totalContentSize,
        metadataSizeBytes: totalMetadataSize
      }
    };
  }

  async syncFromPrimary(params: z.infer<typeof SyncFromPrimaryParamsSchema>): Promise<void> {
    const { datasetId, orgId, primaryRegion } = params;
    
    console.log(`[vector-sync] Starting sync for dataset ${datasetId} in region ${this.doRegion}`);
    
    try {
      // Create primary stub
      const primaryDoId = getDurableObjectId({ datasetId, region: primaryRegion as DurableObjectRegion });
      const primaryId = this.env.UPSTASH_VECTOR_DATASETS.idFromName(primaryDoId);
      const primaryStub = this.env.UPSTASH_VECTOR_DATASETS.get(primaryId, { locationHint: primaryRegion as DurableObjectRegion }) as any;

      // Get all data from primary
      const result = await primaryStub.getFileContents({ datasetId, orgId, getAllFiles: true });
      const files = result.files;
      
      console.log(`[vector-sync] Received ${files.length} files from primary`);

      if (files.length === 0) {
        console.log(`[vector-sync] No files to sync`);
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

      console.log(`[vector-sync] Successfully synced ${files.length} files`);
    } catch (error) {
      console.error(`[vector-sync] Failed to sync data:`, error);
      throw new Error(`Failed to sync data from primary: ${error.message}`);
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
  endLine?: number,
): string {
  const lines = contents.split("\n");

  const filteredLines = (() => {
    if (startLine !== undefined || endLine !== undefined) {
      const start = startLine ? Math.max(0, startLine - 1) : 0;
      const end = endLine ? Math.min(endLine, lines.length) : lines.length;
      return lines.slice(start, end);
    }
    return lines;
  })();

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