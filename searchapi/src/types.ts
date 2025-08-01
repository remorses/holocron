import z from 'zod'

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
        .describe(
            'Optional weight for ranking in search results',
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
        .enum(['lancedb'])
        .optional()
        .default('lancedb')
        .describe(
            'Storage provider for the dataset (default: lancedb). Cannot be changed after creation.',
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

export const BaseDatasetParamsSchema = z.object({
    datasetId: z.string(),
})

export const UpsertDatasetParamsSchema = BaseDatasetParamsSchema.extend({})

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
export type SearchApiFile = z.input<typeof FileSchema>
export type DeleteFilesRequest = z.infer<typeof DeleteFilesSchema>
export type UpsertDatasetRequest = z.infer<typeof UpsertDatasetRequestSchema>
export type GetFileContentsQuery = z.infer<typeof GetFileContentsQuerySchema>
export type SearchSectionsQuery = z.infer<typeof SearchSectionsQuerySchema>
export type SearchSectionsResponse = z.infer<
    typeof SearchSectionsResponseSchema
>

export abstract class DatasetsInterface {
    abstract upsertDataset(
        params: z.infer<typeof UpsertDatasetParamsSchema>,
    ): Promise<void>
    abstract upsertFiles(
        params: z.infer<typeof UpsertFilesParamsSchema>,
    ): Promise<void>
    abstract deleteFiles(
        params: z.infer<typeof DeleteFilesParamsSchema>,
    ): Promise<void>
    abstract deleteDataset(
        params: z.infer<typeof BaseDatasetParamsSchema>,
    ): Promise<void>
    abstract getFileContents(
        params: z.infer<typeof GetFileContentsParamsSchema>,
    ): Promise<z.infer<typeof GetFileContentsResultSchema>>
    abstract searchSections(
        params: z.infer<typeof SearchSectionsParamsSchema>,
    ): Promise<SearchSectionsResponse>
    abstract getDatasetSize(
        params: z.infer<typeof BaseDatasetParamsSchema>,
    ): Promise<z.infer<typeof GetDatasetSizeResponseSchema>>

}
