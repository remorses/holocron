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
    async upsertDataset(
        params: z.infer<typeof UpsertDatasetParamsSchema>,
    ): Promise<void> {
        // TODO: Implement LanceDB dataset creation
        throw new Error('LanceDB implementation not yet available')
    }

    async upsertFiles(
        params: z.infer<typeof UpsertFilesParamsSchema>,
    ): Promise<void> {
        // TODO: Implement LanceDB file upsert
        throw new Error('LanceDB implementation not yet available')
    }

    async deleteFiles(
        params: z.infer<typeof DeleteFilesParamsSchema>,
    ): Promise<void> {
        // TODO: Implement LanceDB file deletion
        throw new Error('LanceDB implementation not yet available')
    }

    async deleteDataset(
        params: z.infer<typeof BaseDatasetParamsSchema>,
    ): Promise<void> {
        // TODO: Implement LanceDB dataset deletion
        throw new Error('LanceDB implementation not yet available')
    }

    async getFileContents(
        params: z.infer<typeof GetFileContentsParamsSchema>,
    ): Promise<z.infer<typeof GetFileContentsResultSchema>> {
        // TODO: Implement LanceDB file retrieval
        throw new Error('LanceDB implementation not yet available')
    }

    async searchSections(
        params: z.infer<typeof SearchSectionsParamsSchema>,
    ): Promise<SearchSectionsResponse> {
        // TODO: Implement LanceDB search
        throw new Error('LanceDB implementation not yet available')
    }

    async getDatasetSize(
        params: z.infer<typeof BaseDatasetParamsSchema>,
    ): Promise<z.infer<typeof GetDatasetSizeResponseSchema>> {
        // TODO: Implement LanceDB size calculation
        throw new Error('LanceDB implementation not yet available')
    }
}

export class SearchClient implements DatasetsInterface {
    private token: string
    private baseUrl: string
    private datasets: DatasetsInterface

    constructor({ token, provider }: { token: string; provider?: 'lancedb' }) {
        this.token = token
        this.baseUrl = 'https://api.eyecrest.com' // You may want to make this configurable
        if (provider === 'lancedb') {
            this.datasets = new LanceDbImplementation()
        } else {
            throw new Error(`Unsupported provider: ${provider}`)
        }
    }

    private async request(
        path: string,
        options?: RequestInit,
    ): Promise<Response> {
        const url = `${this.baseUrl}${path}`
        const response = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${this.token}`,
                ...options?.headers,
            },
        })

        if (!response.ok) {
            throw new Error(
                `API request failed: ${response.status} ${response.statusText}`,
            )
        }

        return response
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

    async getTokens(params: {
        datasetId: string
    }): Promise<{ tokens: string[]; count: number }> {
        const { datasetId } = params
        const response = await this.request(`/v1/datasets/${datasetId}/tokens`)
        return response.json() as Promise<{ tokens: string[]; count: number }>
    }

    async getDatasetSize(
        params: z.infer<typeof BaseDatasetParamsSchema>,
    ): Promise<z.infer<typeof GetDatasetSizeResponseSchema>> {
        return this.datasets.getDatasetSize(params)
    }

    // Additional SearchClient-specific methods (not part of DatasetsInterface)

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
        return response.json() as Promise<{
            content: string
            sha: string
            metadata?: any
        }>
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
        return returnAsText
            ? response.text()
            : (response.json() as Promise<SearchSectionsResponse>)
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
        return response.json() as Promise<{
            filesImported: number
            totalSizeBytes: number
        }>
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
        return response.json() as Promise<{
            filesImported: number
            totalSizeBytes: number
        }>
    }
}

// Export with old name for backward compatibility
export { SearchClient as EyecrestClient }
