import { options } from 'marked'
import { DatasetsInterface } from './types.js'
import Slugger from 'github-slugger'
import { start } from 'repl'
import z, { string, boolean, number, any } from 'zod'
import {
    isSupportedMarkdownFile,
    parseMarkdownIntoSections,
} from './markdown-parser.js'
import { computeGitBlobSHA } from './sha-utils.js'


const DatasetIdSchema = z
    .string()
    .regex(
        /^[a-zA-Z0-9_-]+$/,
        'Dataset ID must only contain alphanumeric characters, hyphens, and underscores',
    )
    .max(400, 'Dataset ID must not exceed 400 characters')

export const FileSchema = z.object({
    filename: z
        .string()
        .regex(
            /^[a-zA-Z0-9!_.*'()\-\/]+$/,
            "Filename must only contain alphanumeric characters and safe special characters (!_.*'()-/)",
        )
        .max(500, 'Filename must not exceed 500 characters')
        .describe(
            'Full file path without leading slash, including extension (md or mdx)',
        ),
    content: z.string().describe('Raw file content'),
    metadata: z
        .any()
        .optional()
        .describe('Optional user-provided metadata for the file (JSON object)'),
    weight: z
        .number()
        .optional()
        .default(1.0)
        .describe(
            'Optional weight for ranking in search results (default: 1.0)',
        ),
})

type FileSchema = z.infer<typeof FileSchema>

const UpsertFilesRequestSchema = z.object({
    files: z
        .array(FileSchema)
        .describe('List of files to ingest and auto-chunk'),
})

const DeleteFilesSchema = z.object({
    filenames: z
        .array(z.string())
        .describe('List of full file paths to delete'),
})

const UpsertDatasetRequestSchema = z.object({
    provider: z
        .enum(['sqlite', 'upstash', 'neon'])
        .optional()
        .default('neon')
        .describe(
            'Storage provider for the dataset (default: neon). Cannot be changed after creation.',
        ),
})

const GetFileContentsQuerySchema = z.object({
    showLineNumbers: z
        .string()
        .optional()
        .default('false')
        .describe(
            'Whether to prefix each line with its line number. Values: "true", "false", or empty string (treated as true)',
        ),
    start: z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .describe('Start line number (1-based)'),
    end: z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .describe('End line number (inclusive)'),
})

const SearchSectionsQuerySchema = z.object({
    query: z.string().describe('Full-text search query'),
    page: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(0)
        .describe('Zero-based page number'),
    perPage: z.coerce
        .number()
        .int()
        .positive()
        .default(20)
        .describe('Number of results per page'),
    maxChunksPerFile: z.coerce
        .number()
        .int()
        .positive()
        .default(5)
        .describe('Maximum sections returned per file'),
    snippetLength: z.coerce
        .number()
        .int()
        .positive()
        .max(500)
        .default(300)
        .describe('Maximum length of snippet (max 500)'),
})

const SearchResultItemSchema = z.object({
    filename: z.string().describe('Source file path'),
    sectionSlug: z
        .string()
        .describe('URL-friendly slug of the section heading'),
    snippet: z.string().describe('Raw markdown excerpt'),
    cleanedSnippet: z
        .string()
        .describe('Cleaned text excerpt without markdown syntax'),
    score: z.number().describe('Relevance score'),
    startLine: z.number().describe('Line number where section starts'),
    metadata: z.any().optional().describe('File metadata if available'),
})

const SearchSectionsResponseSchema = z.object({
    results: z.array(SearchResultItemSchema),
    hasNextPage: z
        .boolean()
        .describe('Whether there are more results on the next page'),
    page: z.number().int().describe('Current page'),
    perPage: z.number().int().describe('Results per page'),
})

const GetFileContentsResponseSchema = z.object({
    content: z.string().describe('Full file content or specified line range'),
    sha: z
        .string()
        .describe(
            'SHA-1 hash of the original file content using Git blob format',
        ),
    metadata: z
        .any()
        .optional()
        .describe('User-provided metadata for the file'),
})

const GetFileContentsExtendedResponseSchema =
    GetFileContentsResponseSchema.extend({
        filename: z.string().optional(),
        weight: z.number().optional(),
    })

export const GetFileContentsResultSchema = z.object({
    files: z.array(
        z.object({
            filename: z.string(),
            content: z.string(),
            sha: z.string().optional(),
            metadata: z.any().optional(),
            weight: z.number().optional(),
        }),
    ),
})

export const GetDatasetSizeResponseSchema = z.object({
    totalSizeBytes: z
        .number()
        .describe(
            'Total size of stored data in bytes (content + metadata + sections)',
        ),
    uploadedContentSizeBytes: z
        .number()
        .describe(
            'Total size of user-uploaded file content in bytes (excluding duplicated sections)',
        ),
    fileCount: z.number().describe('Number of files in the dataset'),
    sectionCount: z
        .number()
        .describe('Number of sections/chunks in the dataset'),
    breakdown: z
        .object({
            databaseSizeBytes: z
                .number()
                .describe(
                    'Estimated total size in bytes (same as totalSizeBytes)',
                ),
            contentSizeBytes: z
                .number()
                .describe('Total size of file contents in bytes'),
            metadataSizeBytes: z
                .number()
                .describe('Total size of metadata in bytes'),
        })
        .describe('Detailed breakdown of storage usage'),
})

const ImportResponseSchema = z.object({
    filesImported: z.number().describe('Number of files imported'),
    totalSizeBytes: z
        .number()
        .describe('Total size of imported files in bytes'),
})

// Parameter schemas for DO methods
export const BaseDatasetParamsSchema = z.object({
    datasetId: z.string(),
    orgId: z.string(),
})

export const UpsertDatasetParamsSchema = BaseDatasetParamsSchema.extend({
    isPrimary: z.boolean(),
})

export const UpsertFilesParamsSchema = BaseDatasetParamsSchema.extend({
    files: z.array(FileSchema),
})

export const DeleteFilesParamsSchema = BaseDatasetParamsSchema.extend({
    filenames: z.array(z.string()),
})

export const GetFileContentsParamsSchema = BaseDatasetParamsSchema.extend({
    filePath: z.string().optional(),
    showLineNumbers: z.boolean().optional(),
    start: z.number().optional(),
    end: z.number().optional(),
    getAllFiles: z.boolean().optional(),
})

export const SearchSectionsParamsSchema = BaseDatasetParamsSchema.extend({
    query: z.string(),
    page: z.number().optional(),
    perPage: z.number().optional(),
    maxChunksPerFile: z.number().optional(),
    snippetLength: z.number().optional(),
})

// Export types for SDK use
export type EyecrestFile = z.input<typeof FileSchema>
export type DeleteFilesRequest = z.infer<typeof DeleteFilesSchema>
export type UpsertDatasetRequest = z.infer<typeof UpsertDatasetRequestSchema>
export type GetFileContentsQuery = z.infer<typeof GetFileContentsQuerySchema>
export type SearchSectionsQuery = z.infer<typeof SearchSectionsQuerySchema>
export type SearchSectionsResponse = z.infer<
    typeof SearchSectionsResponseSchema
>

class LanceDbImplementation implements DatasetsInterface {
    async upsertFiles({
        datasetId,
        orgId,
        files,
        region,
        waitForReplication = true,
    }: {
        datasetId: string
        orgId: string
        files: FileSchema[]
        region?: string
        waitForReplication?: boolean
    }): Promise<void> {
        console.log(
            `[upsert] Starting upsertFiles for dataset ${datasetId} with ${files.length} files`,
        )

        const startTime = Date.now()

        // Check if dataset exists and verify ownership
        const ownershipStart = Date.now()
        const datasetRows = [
            ...this.sql.exec(
                'SELECT org_id, primary_region FROM datasets WHERE dataset_id = ?',
                datasetId,
            ),
        ] as Pick<DatasetRow, 'org_id' | 'primary_region'>[]
        if (datasetRows.length > 0) {
            const existingOrgId = datasetRows[0].org_id
            if (existingOrgId !== orgId) {
                throw new Error(
                    `Unauthorized: dataset ${datasetId} belongs to organization ${existingOrgId}, but you are authenticated as ${orgId}`,
                )
            }
        } else {
            throw new Error(
                `Dataset ${datasetId} not found. Please create it first using POST /v1/datasets/:datasetId`,
            )
        }
        console.log(
            `[upsert] Ownership check: ${Date.now() - ownershipStart}ms`,
        )

        // Log file names being upserted
        console.log(
            `[upsert] Files to upsert: ${files.map((f) => f.filename).join(', ')}`,
        )

        // Parallelize SHA computations
        const shaStart = Date.now()
        const shaComputations = await Promise.all(
            files.map(async (file) => ({
                file,
                computedSHA: await computeGitBlobSHA(file.content),
            })),
        )
        console.log(
            `[upsert] SHA computations (${files.length} files): ${Date.now() - shaStart}ms`,
        )

        // Get all existing files using json_each to avoid SQLite variable limit
        const existingCheckStart = Date.now()
        const filenames = files.map((f) => f.filename)
        const filenamesJson = JSON.stringify(filenames)

        let existingMap: Map<string, string>

        const existingFiles = [
            ...this.sql.exec(
                `SELECT filename, sha FROM files WHERE filename IN (SELECT value FROM json_each(?))`,
                filenamesJson,
            ),
        ] as Pick<FileRow, 'filename' | 'sha'>[]

        existingMap = new Map(
            existingFiles.map((row) => [row.filename, row.sha]),
        )

        console.log(
            `[upsert] Existing files check (${filenames.length} files): ${Date.now() - existingCheckStart}ms`,
        )

        // Process each file
        let processedCount = 0
        let skippedCount = 0

        for (const { file, computedSHA } of shaComputations) {
            // Ignore user-provided SHA - always use computed SHA

            // Check if file exists and needs update based on SHA
            const existingSHA = existingMap.get(file.filename)
            const isUpdate = existingSHA !== undefined

            // Skip update if SHA hasn't changed
            if (isUpdate && existingSHA === computedSHA) {
                skippedCount++
                continue
            }

            processedCount++

            // Upsert file with SHA, metadata, and weight
            const metadataJson = file.metadata
                ? JSON.stringify(file.metadata)
                : null
            const fileWeight = file.weight ?? 1.0

            // Parse and store sections if it's a markdown file
            if (isSupportedMarkdownFile(file.filename)) {
                const parseStart = Date.now()
                const parsed = parseMarkdownIntoSections(file.content)
                const slugger = new Slugger()

                // Log files with many sections
                if (parsed.sections.length > 50) {
                    console.log(
                        `[upsert] File ${file.filename} has ${parsed.sections.length} sections`,
                    )
                }

                // Batch insert sections for better performance
                if (parsed.sections.length > 0) {
                    // Insert all sections using json_each to avoid SQLite variable limit
                    const sectionsData: any[] = []
                    const ftsData: any[] = []

                    for (const section of parsed.sections) {
                        // Use section weight if defined, otherwise inherit file weight
                        const sectionWeight = section.weight ?? fileWeight

                        sectionsData.push({
                            filename: file.filename,
                            content: section.content,
                            level: section.level,
                            order_index: section.orderIndex,
                            section_slug: section.headingSlug,
                            start_line: section.startLine,
                            weight: sectionWeight,
                        })

                        ftsData.push({
                            filename: file.filename,
                            section_slug: section.headingSlug,
                            content: section.content,
                        })
                    }

                    // Insert sections using json_each
                    const sectionsJson = JSON.stringify(sectionsData)

                    if (parsed.sections.length > 10) {
                        console.log(
                            `[upsert] Parsed ${file.filename} (${parsed.sections.length} sections): ${Date.now() - parseStart}ms`,
                        )
                    }
                }
            }
        }
    }
}

export class SearchClient {
    private readonly baseUrl: string
    private readonly token: string

    constructor({
        token,
        baseUrl = 'https://eyecrest.org',
    }: {
        token: string
        baseUrl?: string
    }) {
        this.token = token
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
    }

    async upsertDataset(
        params: { datasetId: string } & UpsertDatasetRequest,
    ): Promise<void> {
        const { datasetId, ...options } = params
        await this.request(`/v1/datasets/${datasetId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(options),
        })
    }

    async upsertFiles(params: {
        datasetId: string
        files: EyecrestFile[]
        waitForReplication?: boolean
    }): Promise<void> {
        const { datasetId, files, waitForReplication } = params
        await this.request(`/v1/datasets/${datasetId}/files`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ files, waitForReplication }),
        })
    }

    async deleteFiles(params: {
        datasetId: string
        filenames: string[]
        waitForReplication?: boolean
    }): Promise<void> {
        const { datasetId, filenames, waitForReplication } = params
        await this.request(`/v1/datasets/${datasetId}/files`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filenames, waitForReplication }),
        })
    }

    async deleteDataset(params: { datasetId: string }): Promise<void> {
        const { datasetId } = params
        await this.request(`/v1/datasets/${datasetId}`, {
            method: 'DELETE',
        })
    }

    async getFile(params: {
        datasetId: string
        filePath: string
        showLineNumbers?: boolean
        start?: number
        end?: number
    }): Promise<{ content: string; sha: string; metadata?: any }> {
        const { datasetId, filePath, showLineNumbers, start, end } = params
        const queryParams = new URLSearchParams()
        if (showLineNumbers !== undefined) {
            queryParams.set(
                'showLineNumbers',
                showLineNumbers ? 'true' : 'false',
            )
        }
        if (start !== undefined) {
            queryParams.set('start', start.toString())
        }
        if (end !== undefined) {
            queryParams.set('end', end.toString())
        }

        const queryString = queryParams.toString()
        const path = `/v1/datasets/${datasetId}/files/${filePath}${queryString ? `?${queryString}` : ''}`

        const response = await this.request(path)
        return response.json()
    }

    // Overload for JSON response (default)
    async search(params: {
        datasetId: string
        query: string
        page?: number
        perPage?: number
        maxChunksPerFile?: number
        snippetLength?: number
        returnAsText?: false
    }): Promise<SearchSectionsResponse>

    // Overload for text response
    async search(params: {
        datasetId: string
        query: string
        page?: number
        perPage?: number
        maxChunksPerFile?: number
        snippetLength?: number
        returnAsText: true
    }): Promise<string>

    // Implementation
    async search(params: {
        datasetId: string
        query: string
        page?: number
        perPage?: number
        maxChunksPerFile?: number
        snippetLength?: number
        returnAsText?: boolean
    }): Promise<SearchSectionsResponse | string> {
        const {
            datasetId,
            query,
            page = 0,
            perPage = 20,
            maxChunksPerFile = 5,
            snippetLength = 300,
            returnAsText = false,
        } = params
        const queryParams = new URLSearchParams({
            query,
            page: page.toString(),
            perPage: perPage.toString(),
            maxChunksPerFile: maxChunksPerFile.toString(),
            snippetLength: snippetLength.toString(),
        })

        const endpoint = returnAsText
            ? `/v1/datasets/${datasetId}/search.txt?${queryParams}`
            : `/v1/datasets/${datasetId}/search?${queryParams}`

        const response = await this.request(endpoint)
        return returnAsText ? response.text() : response.json()
    }

    async getTokens(params: {
        datasetId: string
    }): Promise<{ tokens: string[]; count: number }> {
        const { datasetId } = params
        const response = await this.request(`/v1/datasets/${datasetId}/tokens`)
        return response.json()
    }

    async getDatasetSize(params: { datasetId: string }): Promise<{
        totalSizeBytes: number
        uploadedContentSizeBytes: number
        fileCount: number
        sectionCount: number
        breakdown: {
            databaseSizeBytes: number
            contentSizeBytes: number
            metadataSizeBytes: number
        }
    }> {
        const { datasetId } = params
        const response = await this.request(`/v1/datasets/${datasetId}/size`)
        return response.json()
    }

    async importFromTarUrl(params: {
        datasetId: string
        url: string
        path?: string
        metadata?: any
        waitForReplication?: boolean
    }): Promise<{ filesImported: number; totalSizeBytes: number }> {
        const {
            datasetId,
            url,
            path,
            metadata,
            waitForReplication = true,
        } = params
        const response = await this.request(
            `/v1/datasets/${datasetId}/import/tar`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url,
                    path,
                    metadata,
                    waitForReplication,
                }),
            },
        )
        return response.json()
    }

    async importFromGitHub(params: {
        datasetId: string
        owner: string
        repo: string
        branch?: string
        path?: string
        waitForReplication?: boolean
    }): Promise<{ filesImported: number; totalSizeBytes: number }> {
        const {
            datasetId,
            owner,
            repo,
            branch = 'main',
            path,
            waitForReplication = true,
        } = params
        const response = await this.request(
            `/v1/datasets/${datasetId}/import/github`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    owner,
                    repo,
                    branch,
                    path,
                    waitForReplication,
                }),
            },
        )
        return response.json()
    }
}
