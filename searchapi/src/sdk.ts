import { DatasetsInterface } from './types.js'
import z from 'zod'
import {
    BaseDatasetParamsSchema,
    UpsertDatasetParamsSchema,
    UpsertFilesParamsSchema,
    DeleteFilesParamsSchema,
    GetFileContentsParamsSchema,
    SearchSectionsParamsSchema,
    GetFileContentsResultSchema,
    GetDatasetSizeResponseSchema,
} from './types.js'
import * as lancedb from '@lancedb/lancedb'
import type { ConnectionOptions } from '@lancedb/lancedb'
import { parseMarkdownIntoSections, isSupportedMarkdownFile } from './markdown-parser.js'
import { computeGitBlobSHA } from './sha-utils.js'
import { cleanMarkdownContent } from './markdown-cleaner.js'
import { Schema, Field, Utf8, Float64, Int32, Struct } from 'apache-arrow'

// Import types from types.js
import type {
    SearchApiFile,
    DeleteFilesRequest,
    UpsertDatasetRequest,
    GetFileContentsQuery,
    SearchSectionsQuery,
    SearchSectionsResponse,
} from './types.js'

// Internal types for LanceDB table records
interface SectionRecord {
    type: 'section' | 'file'
    filename: string
    content: string
    sha: string
    metadata: string
    weight: number
    created_at: number
    updated_at: number
    section_slug: string
    section_content: string
    level: number
    order_index: number
    start_line: number
    cleaned_content: string
    _score?: number // Added by FTS search
}

interface SectionWithScore extends SectionRecord {
    score: number
}

export class SearchClient implements DatasetsInterface {
    private db?: lancedb.Connection
    private dbPath: string = 'db://holocron-co7ad3' // Default to cloud database
    private pendingIndexCreation: Set<string> = new Set()
    private totalRowsInserted: Map<string, number> = new Map()
    // Cache for table references and index status
    private tableCache: Map<string, lancedb.Table> = new Map()
    private ftsIndexCache: Map<string, boolean> = new Map()
    
    // Table schema for all datasets
    private readonly tableSchema = new Schema([
        new Field('type', new Utf8()),
        new Field('filename', new Utf8()),
        new Field('content', new Utf8()),
        new Field('sha', new Utf8()),
        new Field('metadata', new Utf8()),
        new Field('weight', new Float64()),
        new Field('created_at', new Float64()),
        new Field('updated_at', new Float64()),
        // Section-specific fields
        new Field('section_slug', new Utf8()),
        new Field('section_content', new Utf8()),
        new Field('level', new Int32()),
        new Field('order_index', new Int32()),
        new Field('start_line', new Int32()),
        new Field('cleaned_content', new Utf8()),
    ])

    constructor(dbPath?: string) {
        if (dbPath) {
            this.dbPath = dbPath
        }
    }

    private async getConnection(): Promise<lancedb.Connection> {
        if (!this.db) {
            const apiKey = process.env.LANCEDB_API_KEY
            const region = process.env.LANCEDB_REGION || 'us-east-1'

            if (this.dbPath.startsWith('db://')) {
                // LanceDB Cloud connection
                if (!apiKey) {
                    throw new Error('LANCEDB_API_KEY environment variable is required for cloud connections')
                }
                const connectionOptions: Partial<ConnectionOptions> = {
                    apiKey,
                    region: 'us-east-1',
                    // Performance optimizations for cloud connections
                    clientConfig: {
                        timeoutConfig: {
                            connectTimeout: 300, // 5 minutes for large uploads
                            readTimeout: 600,    // 10 minutes for large operations
                        },
                        retryConfig: {
                            retries: 5,
                            connectRetries: 3,
                            readRetries: 3,
                            backoffFactor: 0.5,
                        },
                    },
                }
                this.db = await lancedb.connect(this.dbPath, connectionOptions)
            } else {
                // Local connection
                this.db = await lancedb.connect(this.dbPath)
            }
        }
        return this.db
    }

    private sanitizeTableName(datasetId: string): string {
        // LanceDB table names need to be valid identifiers
        return datasetId.replace(/[^a-zA-Z0-9_]/g, '_')
    }

    private async getOrCreateTable(tableName: string): Promise<lancedb.Table> {
        // Check cache first
        let table = this.tableCache.get(tableName)
        if (table) {
            console.log(`[table] Using cached table reference for ${tableName}`)
            return table
        }

        // Not in cache, check if table exists
        const db = await this.getConnection()
        const tables = await db.tableNames()

        if (!tables.includes(tableName)) {
            // Table doesn't exist, create it with schema
            console.log(`[table] Creating new table ${tableName} with schema`)
            try {
                table = await db.createEmptyTable(tableName, this.tableSchema)
                
                // Create btree index on filename column for faster lookups
                console.log('[table] Creating btree index on filename column...')
                try {
                    await table.createIndex('filename', {
                        config: lancedb.Index.btree(),
                        replace: true,
                    })
                } catch (indexError) {
                    console.warn('[table] Failed to create filename index:', indexError)
                }
            } catch (createError: any) {
                // Table might have been created by another concurrent request
                if (createError.message?.includes('already exists')) {
                    console.log(`[table] Table ${tableName} was created by another request, opening it instead`)
                    table = await db.openTable(tableName)
                } else {
                    throw createError
                }
            }
        } else {
            // Table exists but not cached, open it
            console.log(`[table] Opening table ${tableName} (not cached)`)
            table = await db.openTable(tableName)
        }
        
        // Cache the table reference
        this.tableCache.set(tableName, table)
        return table
    }

    async getExistingFiles(table: lancedb.Table, filenames: string[]): Promise<Map<string, string>> {
        const existingFilesMap: Map<string, string> = new Map()

        if (filenames.length === 0) {
            return existingFilesMap
        }

        // Escape single quotes in filenames for SQL
        const filenameList = filenames
            .map(f => `'${f.replace(/'/g, "''")}'`)
            .join(',')

        try {
            const existingFilesQuery = await table
                .query()
                .where(`filename IN (${filenameList}) AND type = 'file'`)
                .select(['filename', 'sha'])
                .toArray() as Pick<SectionRecord, 'filename' | 'sha'>[]

            // Build a map for O(1) lookups
            for (const file of existingFilesQuery) {
                existingFilesMap.set(file.filename, file.sha)
            }
        } catch (error) {
            console.error('[upsert] Error querying existing files:', error)
        }

        return existingFilesMap
    }

    async upsertDataset(
        params: z.infer<typeof UpsertDatasetParamsSchema>,
    ): Promise<void> {
        const { datasetId } = params
        const tableName = this.sanitizeTableName(datasetId)

        // Table will be automatically created by getOrCreateTable when needed
        // This method just validates the dataset ID
        console.log(`[upsert] Dataset ${datasetId} will be created when files are added`)
    }

    async upsertFiles(
        params: z.infer<typeof UpsertFilesParamsSchema>,
    ): Promise<void> {
        const { datasetId, files,  } = params
        const tableName = this.sanitizeTableName(datasetId)

        console.log(`[upsert] Starting upsertFiles for dataset ${datasetId} with ${files.length} files`)
        const startTime = Date.now()

        // Get or create table
        const table = await this.getOrCreateTable(tableName)

        // Optimization: Only query for the specific files we're uploading
        const filenames = files.map(f => f.filename)
        const existingFilesMap = await this.getExistingFiles(table, filenames)
        console.log(`[upsert] Found ${existingFilesMap.size} existing files (out of ${files.length} to check)`)

        // Compute SHAs in parallel
        const shaStart = Date.now()
        const shaComputations = await Promise.all(
            files.map(async (file) => ({
                file,
                computedSHA: await computeGitBlobSHA(file.content),
            }))
        )
        console.log(`[upsert] SHA computations (${files.length} files): ${Date.now() - shaStart}ms`)

        // Process files and prepare all rows (files + sections in same table)
        let processedCount = 0
        let skippedCount = 0
        const allRows: Partial<SectionRecord>[] = []

        for (const { file, computedSHA } of shaComputations) {
            // Check if file exists and has same SHA using the map
            const existingSHA = existingFilesMap.get(file.filename)
            if (existingSHA === computedSHA) {
                skippedCount++
                continue
            }

            processedCount++

            // Add file row
            allRows.push({
                type: 'file',
                filename: file.filename,
                content: file.content,
                sha: computedSHA,
                metadata: file.metadata ? JSON.stringify(file.metadata) : '',
                weight: file.weight ?? 1.0,
                created_at: Date.now(),
                updated_at: Date.now(),
                // Section-specific fields (empty strings for files)
                section_slug: '',
                section_content: '',
                level: 0,
                order_index: 0,
                start_line: 0,
                cleaned_content: '',
            })

            // Parse sections if it's a markdown file
            if (isSupportedMarkdownFile(file.filename)) {
                const parsed = parseMarkdownIntoSections(file.content)

                for (const section of parsed.sections) {
                    const sectionWeight = section.weight ?? file.weight ?? 1.0

                    allRows.push({
                        type: 'section',
                        filename: file.filename,
                        content: '', // Don't duplicate file content
                        sha: '',
                        metadata: file.metadata ? JSON.stringify(file.metadata) : '',
                        weight: sectionWeight,
                        created_at: Date.now(),
                        updated_at: Date.now(),
                        // Section-specific fields
                        section_slug: section.headingSlug,
                        section_content: section.content,
                        level: section.level,
                        order_index: section.orderIndex,
                        start_line: section.startLine,
                        cleaned_content: cleanMarkdownContent(section.content),
                    })
                }
            }
        }

        // Add rows to table
        if (allRows.length === 0) {
            console.log('[upsert] No files to process after SHA check')
        } else {
            // Delete all rows for changed files and add fresh ones
            const changedFilenames = shaComputations
                .filter(sc => existingFilesMap.get(sc.file.filename) !== sc.computedSHA)
                .map(sc => sc.file.filename)
            if (changedFilenames.length > 0) {
                const deleteQuery = changedFilenames
                    .map(f => `filename = '${f.replace(/'/g, "''")}'`)
                    .join(' OR ')
                console.log(`[upsert] Deleting existing rows for ${changedFilenames.length} files...`)
                await table.delete(deleteQuery)
            }
            await table.add(allRows, { mode: 'append' })
        }

        console.log(`[upsert] Processing files (${processedCount} processed, ${skippedCount} skipped): ${Date.now() - startTime}ms`)
        console.log(`[upsert] Completed upsertFiles for dataset ${datasetId}`)

        // Track total rows inserted and mark index as pending
        if (processedCount > 0) {
            const currentTotal = this.totalRowsInserted.get(datasetId) || 0
            this.totalRowsInserted.set(datasetId, currentTotal + processedCount)
            this.pendingIndexCreation.add(datasetId)
        }
    }

    async createPendingIndexes(datasetId: string): Promise<void> {
        if (!this.pendingIndexCreation.has(datasetId)) {
            console.log(`[index] No pending indexes for dataset ${datasetId}`)
            return
        }

        const tableName = this.sanitizeTableName(datasetId)
        // Get or create table
        const table = await this.getOrCreateTable(tableName)

        console.log(`[index] Creating FTS indexes for dataset ${datasetId}...`)
        try {
            const ftsOptions: lancedb.IndexOptions = {
                config: lancedb.Index.fts({
                    withPosition: true,
                    baseTokenizer: 'simple',
                    lowercase: true,
                    maxTokenLength: 40,
                    language: 'English',
                    stem: true,
                    removeStopWords: true,
                }),
                replace: true,
            }

            await table.createIndex('section_content', ftsOptions)
            console.log(`[index] FTS index created successfully`)
            this.pendingIndexCreation.delete(datasetId)
            // Update FTS cache
            this.ftsIndexCache.set(tableName, true)
        } catch (error) {
            console.warn(`[index] Failed to create FTS indexes:`, error)
        }
    }

    async optimizeTable(datasetId: string): Promise<void> {
        const tableName = this.sanitizeTableName(datasetId)
        // Get or create table
        const table = await this.getOrCreateTable(tableName)

        console.log(`[optimize] Optimizing table for dataset ${datasetId}...`)
        const startTime = Date.now()

        try {
            const stats = await table.optimize()
            console.log(`[optimize] Table optimized in ${Date.now() - startTime}ms`)
            console.log(`[optimize] Fragments removed: ${stats.compaction.fragmentsRemoved}, added: ${stats.compaction.fragmentsAdded}`)
            console.log(`[optimize] Files removed: ${stats.compaction.filesRemoved}, added: ${stats.compaction.filesAdded}`)
        } catch (error) {
            console.warn(`[optimize] Failed to optimize table:`, error)
        }
    }

    async deleteFiles(
        params: z.infer<typeof DeleteFilesParamsSchema>,
    ): Promise<void> {
        const { datasetId, filenames } = params
        const tableName = this.sanitizeTableName(datasetId)

        // Check if table exists first
        const db = await this.getConnection()
        const tables = await db.tableNames()
        
        if (!tables.includes(tableName)) {
            // Table doesn't exist, nothing to delete
            console.log(`[deleteFiles] Table ${tableName} doesn't exist, skipping deletion`)
            return
        }

        // Table exists, open it and delete files
        const table = await db.openTable(tableName)
        
        // Delete all rows (files and sections) for the given filenames
        for (const filename of filenames) {
            await table.delete(`filename = '${filename}'`)
        }
    }

    async deleteDataset(
        params: z.infer<typeof BaseDatasetParamsSchema>,
    ): Promise<void> {
        const { datasetId } = params
        const tableName = this.sanitizeTableName(datasetId)

        // Check if table exists first
        const db = await this.getConnection()
        const tables = await db.tableNames()
        
        if (!tables.includes(tableName)) {
            // Table doesn't exist, nothing to delete
            console.log(`[deleteDataset] Table ${tableName} doesn't exist, skipping deletion`)
            // Still clear caches just in case
            this.tableCache.delete(tableName)
            this.ftsIndexCache.delete(tableName)
            return
        }

        // Drop the entire table
        await db.dropTable(tableName)

        // Clear caches for this table
        this.tableCache.delete(tableName)
        this.ftsIndexCache.delete(tableName)
    }

    async getFileContents(
        params: z.infer<typeof GetFileContentsParamsSchema>,
    ): Promise<z.infer<typeof GetFileContentsResultSchema>> {
        const { datasetId, filePath, showLineNumbers, start, end, getAllFiles } = params
        const tableName = this.sanitizeTableName(datasetId)

        // Get or create table
        const table = await this.getOrCreateTable(tableName)

        if (getAllFiles) {
            // Get all unique files (type = 'file')
            const allFiles = await table
                .query()
                .where(`type = 'file'`)
                .toArray() as SectionRecord[]
            return {
                files: allFiles.map(file => ({
                    filename: file.filename,
                    content: file.content,
                    sha: file.sha,
                    metadata: file.metadata && file.metadata !== '' ? JSON.parse(file.metadata) : undefined,
                    weight: file.weight,
                }))
            }
        }

        if (!filePath) {
            throw new Error('filePath is required when getAllFiles is false')
        }

        const files = await table
            .query()
            .where(`filename = '${filePath}' AND type = 'file'`)
            .limit(1)
            .toArray() as SectionRecord[]

        if (files.length === 0) {
            throw new Error(`File not found: ${filePath}`)
        }

        const file = files[0]
        let content = file.content

        // Apply line formatting if requested
        if (showLineNumbers || start !== undefined || end !== undefined) {
            const lines = content.split('\n')
            const startLine = start || 1
            const endLine = end || lines.length
            const selectedLines = lines.slice(startLine - 1, endLine)

            if (showLineNumbers) {
                const maxLineNum = startLine + selectedLines.length - 1
                const padding = maxLineNum.toString().length
                content = selectedLines.map((line, idx) => {
                    const lineNum = (startLine + idx).toString().padStart(padding, ' ')
                    return `${lineNum}  ${line}`
                }).join('\n')
            } else {
                content = selectedLines.join('\n')
            }
        }

        return {
            files: [{
                filename: file.filename,
                content,
                sha: file.sha,
                metadata: file.metadata ? JSON.parse(file.metadata) : undefined,
                weight: file.weight,
            }]
        }
    }

    async searchSections(
        params: z.infer<typeof SearchSectionsParamsSchema>,
    ): Promise<SearchSectionsResponse> {
        const { datasetId, query, page = 0, perPage = 20, maxChunksPerFile = 5, snippetLength = 300 } = params
        console.log(`[search] Starting search for query "${query}" in dataset ${datasetId}`)
        const searchStartTime = Date.now()

        const tableName = this.sanitizeTableName(datasetId)

        // Get or create table
        const table = await this.getOrCreateTable(tableName)

        // Use FTS search if available, otherwise fall back to manual search
        let matchingSections: SectionWithScore[]

        // Check if FTS index exists (cached)
        let hasFtsIndex = this.ftsIndexCache.get(tableName)
        if (hasFtsIndex === undefined) {
            const indicesStart = Date.now()
            const indices = await table.listIndices()
            console.log(`[search] listIndices() took ${Date.now() - indicesStart}ms, found ${indices.length} indices`)

            hasFtsIndex = indices.some(index =>
                index.columns.includes('section_content') &&
                (index.indexType === 'INVERTED' || index.indexType === 'FTS' || index.indexType.toLowerCase().includes('text'))
            )
            this.ftsIndexCache.set(tableName, hasFtsIndex)
            console.log(`[search] FTS index exists: ${hasFtsIndex} (cached for future)`)
        } else {
            console.log(`[search] FTS index exists: ${hasFtsIndex} (from cache)`)
        }

        if (hasFtsIndex) {
            try {
                // Use FTS search on section_content
                const ftsStart = Date.now()
                const searchResults = await table
                    .search(query,)
                    .where(`type = 'section'`)
                    .limit(perPage * (page + 1) + 1) // Get extra for pagination check
                    .toArray() as SectionRecord[]
                console.log(`[search] FTS search took ${Date.now() - ftsStart}ms, found ${searchResults.length} results`)

                matchingSections = searchResults.map(section => ({
                    ...section,
                    // Multiply FTS score by section weight
                    score: (section._score || 1.0) * (section.weight || 1.0),
                }))
            } catch (error) {
                // If FTS still fails, fall back to manual search
                console.warn('[search] FTS search failed despite index, falling back to manual search:', error)
                const manualStart = Date.now()
                const searchQuery = query.toLowerCase()
                const allSections = await table
                    .query()
                    .where(`type = 'section'`)
                    .toArray() as SectionRecord[]
                console.log(`[search] Manual query took ${Date.now() - manualStart}ms, loaded ${allSections.length} sections`)

                // Filter sections that match the query
                const filterStart = Date.now()
                matchingSections = allSections
                    .filter(section => section.section_content && section.section_content.toLowerCase().includes(searchQuery))
                    .map(section => ({
                        ...section,
                        // Use weight as score for manual search
                        score: section.weight || 1.0,
                    }))
                    .sort((a, b) => b.score - a.score)
                console.log(`[search] Filtering took ${Date.now() - filterStart}ms, matched ${matchingSections.length} sections`)
            }
        } else {
            // No FTS index, use manual search
            const manualStart = Date.now()
            const searchQuery = query.toLowerCase()
            const allSections = await table
                .query()
                .where(`type = 'section'`)
                .toArray() as SectionRecord[]
            console.log(`[search] Manual query took ${Date.now() - manualStart}ms, loaded ${allSections.length} sections`)

            // Filter sections that match the query
            const filterStart = Date.now()
            matchingSections = allSections
                .filter(section => section.section_content && section.section_content.toLowerCase().includes(searchQuery))
                .map(section => ({
                    ...section,
                    // Use weight as score for manual search
                    score: section.weight || 1.0,
                }))
                .sort((a, b) => b.score - a.score)
            console.log(`[search] Filtering took ${Date.now() - filterStart}ms, matched ${matchingSections.length} sections`)
        }

        // Sort all matching sections by score (already includes weight)
        matchingSections.sort((a, b) => b.score - a.score)

        // Group by file and limit per file
        const groupStart = Date.now()
        const fileGroups: Record<string, SectionWithScore[]> = {}
        for (const section of matchingSections) {
            if (!fileGroups[section.filename]) {
                fileGroups[section.filename] = []
            }
            if (fileGroups[section.filename].length < maxChunksPerFile) {
                fileGroups[section.filename].push(section)
            }
        }
        console.log(`[search] Grouping by file took ${Date.now() - groupStart}ms`)

        // Flatten and paginate
        const paginateStart = Date.now()
        const allResults = Object.values(fileGroups).flat()
        const startIdx = page * perPage
        const endIdx = startIdx + perPage
        const pageResults = allResults.slice(startIdx, endIdx + 1) // Get one extra to check for next page
        const hasNextPage = pageResults.length > perPage

        if (hasNextPage) {
            pageResults.pop() // Remove the extra result
        }
        console.log(`[search] Pagination took ${Date.now() - paginateStart}ms`)

        const mapStart = Date.now()
        const results = pageResults.map(section => ({
            filename: section.filename,
            sectionSlug: section.section_slug,
            snippet: section.section_content.substring(0, snippetLength),
            cleanedSnippet: section.cleaned_content ? section.cleaned_content.substring(0, snippetLength) : '',
            score: section.score,
            startLine: section.start_line,
            metadata: section.metadata && section.metadata !== '' ? JSON.parse(section.metadata) : undefined,
        }))
        console.log(`[search] Result mapping took ${Date.now() - mapStart}ms`)

        console.log(`[search] Total search time: ${Date.now() - searchStartTime}ms`)

        return {
            results,
            hasNextPage,
            page,
            perPage,
        }
    }

    async getDatasetSize(
        params: z.infer<typeof BaseDatasetParamsSchema>,
    ): Promise<z.infer<typeof GetDatasetSizeResponseSchema>> {
        const { datasetId } = params
        const tableName = this.sanitizeTableName(datasetId)

        // Get or create table
        const table = await this.getOrCreateTable(tableName)

        // Get all rows to calculate sizes
        const allRows = await table.query().toArray() as SectionRecord[]

        let fileCount = 0
        let sectionCount = 0
        let contentSizeBytes = 0
        let metadataSizeBytes = 0

        for (const row of allRows) {
            if (row.type === 'file') {
                fileCount++
                contentSizeBytes += new TextEncoder().encode(row.content || '').length
                if (row.metadata) {
                    metadataSizeBytes += new TextEncoder().encode(row.metadata).length
                }
            } else if (row.type === 'section') {
                sectionCount++
                // Add section content size
                contentSizeBytes += new TextEncoder().encode(row.section_content || '').length
            }
        }

        const totalSizeBytes = contentSizeBytes + metadataSizeBytes

        return {
            totalSizeBytes,
            uploadedContentSizeBytes: contentSizeBytes,
            fileCount,
            sectionCount,
            breakdown: {
                databaseSizeBytes: totalSizeBytes,
                contentSizeBytes,
                metadataSizeBytes,
            },
        }
    }
}



// Re-export types that might be needed
export type { SearchSectionsResponse, SearchApiFile } from './types.js'
