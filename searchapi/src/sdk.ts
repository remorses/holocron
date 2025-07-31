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
import { parseMarkdownIntoSections, isSupportedMarkdownFile } from './markdown-parser.js'
import { computeGitBlobSHA } from './sha-utils.js'
import { cleanMarkdownContent } from './markdown-cleaner.js'

// Import types from types.js
import type {
    EyecrestFile,
    DeleteFilesRequest,
    UpsertDatasetRequest,
    GetFileContentsQuery,
    SearchSectionsQuery,
    SearchSectionsResponse,
} from './types.js'

class LanceDbImplementation implements DatasetsInterface {
    private db?: lancedb.Connection
    private dbPath: string = './lancedb' // Default path, can be overridden

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
                this.db = await lancedb.connect(this.dbPath, {
                    apiKey,
                    region,
                } as any)
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

    async upsertDataset(
        params: z.infer<typeof UpsertDatasetParamsSchema>,
    ): Promise<void> {
        const { datasetId } = params
        const db = await this.getConnection()
        const tableName = this.sanitizeTableName(datasetId)
        
        // For LanceDB, the table will be created when files are first added
        // We just verify we can connect and the dataset ID is valid
        
        // Dataset will be created when files are added
    }

    async upsertFiles(
        params: z.infer<typeof UpsertFilesParamsSchema>,
    ): Promise<void> {
        const { datasetId, files, waitForReplication = true } = params
        const db = await this.getConnection()
        const tableName = this.sanitizeTableName(datasetId)
        
        console.log(`[upsert] Starting upsertFiles for dataset ${datasetId} with ${files.length} files`)
        const startTime = Date.now()

        // Check if table exists
        const tables = await db.tableNames()
        let table: lancedb.Table | null = null
        
        if (tables.includes(tableName)) {
            table = await db.openTable(tableName)
        }

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
        const allRows: any[] = []

        for (const { file, computedSHA } of shaComputations) {
            // Check if file exists and has same SHA
            if (table) {
                const existingFiles = await table
                    .query()
                    .where(`filename = '${file.filename}' AND type = 'file'`)
                    .limit(1)
                    .toArray()
                
                if (existingFiles.length > 0 && existingFiles[0].sha === computedSHA) {
                    skippedCount++
                    continue
                }
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
                vector: new Array(1536).fill(0), // Placeholder
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
                        vector: new Array(1536).fill(0), // Placeholder for embeddings
                        cleaned_content: cleanMarkdownContent(section.content),
                    })
                }
            }
        }

        // Create or update table
        if (allRows.length > 0) {
            if (!table) {
                // Create new table with all rows
                await db.createTable(tableName, allRows)
            } else {
                // Delete existing entries for processed files
                for (const filename of shaComputations.map(sc => sc.file.filename)) {
                    await table.delete(`filename = '${filename}'`)
                }
                // Add new rows
                await table.add(allRows)
            }
        }

        console.log(`[upsert] Processing files (${processedCount} processed, ${skippedCount} skipped): ${Date.now() - startTime}ms`)
        console.log(`[upsert] Completed upsertFiles for dataset ${datasetId}`)
    }

    async deleteFiles(
        params: z.infer<typeof DeleteFilesParamsSchema>,
    ): Promise<void> {
        const { datasetId, filenames } = params
        const db = await this.getConnection()
        const tableName = this.sanitizeTableName(datasetId)

        const tables = await db.tableNames()
        if (!tables.includes(tableName)) {
            throw new Error(`Dataset ${datasetId} not found.`)
        }

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
        const db = await this.getConnection()
        const tableName = this.sanitizeTableName(datasetId)

        const tables = await db.tableNames()
        if (!tables.includes(tableName)) {
            throw new Error(`Dataset ${datasetId} not found.`)
        }

        const table = await db.openTable(tableName)

        // Drop the entire table
        await db.dropTable(tableName)
    }

    async getFileContents(
        params: z.infer<typeof GetFileContentsParamsSchema>,
    ): Promise<z.infer<typeof GetFileContentsResultSchema>> {
        const { datasetId, filePath, showLineNumbers, start, end, getAllFiles } = params
        const db = await this.getConnection()
        const tableName = this.sanitizeTableName(datasetId)

        const tables = await db.tableNames()
        if (!tables.includes(tableName)) {
            throw new Error(`Dataset ${datasetId} not found.`)
        }

        const table = await db.openTable(tableName)

        if (getAllFiles) {
            // Get all unique files (type = 'file')
            const allFiles = await table
                .query()
                .where(`type = 'file'`)
                .toArray()
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
            .toArray()
        
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
        const db = await this.getConnection()
        const tableName = this.sanitizeTableName(datasetId)

        const tables = await db.tableNames()
        if (!tables.includes(tableName)) {
            return {
                results: [],
                hasNextPage: false,
                page,
                perPage,
            }
        }

        const table = await db.openTable(tableName)
        
        // Get only sections (type = 'section')
        const searchQuery = query.toLowerCase()
        const allSections = await table
            .query()
            .where(`type = 'section'`)
            .toArray()
        
        // Filter sections that match the query
        const matchingSections = allSections
            .filter(section => section.section_content && section.section_content.toLowerCase().includes(searchQuery))
            .map(section => ({
                ...section,
                score: 1.0, // Placeholder score
            }))
            .sort((a, b) => b.score - a.score)

        // Group by file and limit per file
        const fileGroups: Record<string, any[]> = {}
        for (const section of matchingSections) {
            if (!fileGroups[section.filename]) {
                fileGroups[section.filename] = []
            }
            if (fileGroups[section.filename].length < maxChunksPerFile) {
                fileGroups[section.filename].push(section)
            }
        }

        // Flatten and paginate
        const allResults = Object.values(fileGroups).flat()
        const startIdx = page * perPage
        const endIdx = startIdx + perPage
        const pageResults = allResults.slice(startIdx, endIdx + 1) // Get one extra to check for next page
        const hasNextPage = pageResults.length > perPage
        
        if (hasNextPage) {
            pageResults.pop() // Remove the extra result
        }

        const results = pageResults.map(section => ({
            filename: section.filename,
            sectionSlug: section.section_slug,
            snippet: section.section_content.substring(0, snippetLength),
            cleanedSnippet: (section.cleaned_content || cleanMarkdownContent(section.section_content)).substring(0, snippetLength),
            score: section.score,
            startLine: section.start_line,
            metadata: section.metadata && section.metadata !== '' ? JSON.parse(section.metadata) : undefined,
        }))

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
        const db = await this.getConnection()
        const tableName = this.sanitizeTableName(datasetId)

        const tables = await db.tableNames()
        if (!tables.includes(tableName)) {
            throw new Error(`Dataset ${datasetId} not found.`)
        }

        const table = await db.openTable(tableName)
        
        // Get all rows to calculate sizes
        const allRows = await table.query().toArray()
        
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

export class SearchClient implements DatasetsInterface {
    private datasets: DatasetsInterface

    constructor({ provider, dbPath }: { provider?: 'lancedb'; dbPath?: string }) {
        if (provider === 'lancedb') {
            this.datasets = new LanceDbImplementation(dbPath)
        } else {
            throw new Error(`Unsupported provider: ${provider}`)
        }
    }

    async upsertDataset(
        params: z.infer<typeof UpsertDatasetParamsSchema>,
    ): Promise<void> {
        return this.datasets.upsertDataset(params)
    }

    async upsertFiles(
        params: z.infer<typeof UpsertFilesParamsSchema>,
    ): Promise<void> {
        return this.datasets.upsertFiles(params)
    }

    async deleteFiles(
        params: z.infer<typeof DeleteFilesParamsSchema>,
    ): Promise<void> {
        return this.datasets.deleteFiles(params)
    }

    async deleteDataset(
        params: z.infer<typeof BaseDatasetParamsSchema>,
    ): Promise<void> {
        return this.datasets.deleteDataset(params)
    }

    async getFileContents(
        params: z.infer<typeof GetFileContentsParamsSchema>,
    ): Promise<z.infer<typeof GetFileContentsResultSchema>> {
        return this.datasets.getFileContents(params)
    }

    async searchSections(
        params: z.infer<typeof SearchSectionsParamsSchema>,
    ): Promise<SearchSectionsResponse> {
        return this.datasets.searchSections(params)
    }

    async getDatasetSize(
        params: z.infer<typeof BaseDatasetParamsSchema>,
    ): Promise<z.infer<typeof GetDatasetSizeResponseSchema>> {
        return this.datasets.getDatasetSize(params)
    }
}

// Export with old name for backward compatibility
export { SearchClient as EyecrestClient }
