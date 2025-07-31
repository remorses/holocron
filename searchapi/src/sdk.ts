import { options } from 'marked'
import { start } from 'repl'
import { string, boolean, number, any } from 'zod'
import {
    isSupportedMarkdownFile,
    parseMarkdownIntoSections,
} from './markdown-parser.js'
import { computeGitBlobSHA } from './sha-utils.js'
import type {
    EyecrestFile,
    DeleteFilesRequest,
    UpsertDatasetRequest,
    GetFileContentsQuery,
    SearchSectionsQuery,
    SearchSectionsResponse,
} from './worker.js'

// Re-export types for convenience
export type { EyecrestFile, SearchSectionsResponse, UpsertDatasetRequest }

export class EyecrestClient {
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
