import { tool } from 'ai'
import z from 'zod'
import { EditToolParamSchema } from 'docs-website/src/lib/edit-tool'

// Tool input schemas - extracted from docs-website/src/lib/spiceflow-docs-app.ts
export const searchDocsInputSchema = z.object({
    terms: z
        .array(z.string())
        .describe(
            'An array of search terms to find relevant documentation content. Wrap a term in "" to do an exact phrase search.',
        ),
    searchType: z
        .enum(['fulltext', 'bm25', 'semantic'])
        .describe(
            '"fulltext" uses the SPADE engine for classic full-text keyword matching; "bm25" applies the BM25 ranking algorithm; "semantic" uses vector search for semantically similar content.',
        ),
})

export const goToPageInputSchema = z.object({
    slug: z
        .string()
        .describe(
            'The page slug/path to navigate to (e.g., "getting-started" or "api/authentication")',
        ),
})

export const getCurrentPageInputSchema = z
    .object({})
    .describe('Get the current page slug that the user is viewing')

export const fetchUrlInputSchema = z.object({
    url: z
        .string()
        .describe(
            'The URL to fetch. Can be a full URL (https://example.com) or a relative path (/docs/guide). For documentation pages, use .md extension (e.g., "/docs/getting-started.md") to fetch the markdown content.',
        ),
})

export const selectTextInputSchema = z.object({
    slug: z
        .string()
        .describe('The page slug to navigate to and select text on'),
    startLine: z.number().describe('Starting line number to select (1-based)'),
    endLine: z.number().describe('Ending line number to select (1-based)'),
})

// Export types with capitalized names
export type SearchDocsInput = z.infer<typeof searchDocsInputSchema>
export type GoToPageInput = z.infer<typeof goToPageInputSchema>
export type GetCurrentPageInput = z.infer<typeof getCurrentPageInputSchema>
export type FetchUrlInput = z.infer<typeof fetchUrlInputSchema>
export type SelectTextInput = z.infer<typeof selectTextInputSchema>

// Just export the schemas - each project can use the tool() function directly
// This avoids complex type inference issues with tool creator functions

// Types for tool definitions
export type DocsTools = {
    strReplaceEditor: {
        input: EditToolParamSchema
        output: any
    }
    searchDocs: {
        input: SearchDocsInput
        output: any
    }
    goToPage: {
        input: GoToPageInput
        output: {
            slug: string
            error?: string
        }
    }
    getCurrentPage: {
        input: GetCurrentPageInput
        output: any
    }
    fetchUrl: {
        input: FetchUrlInput
        output: any
    }
    selectText: {
        input: SelectTextInput
        output: {
            slug: string
            startLine?: number
            endLine?: number
            error?: string
        }
    }
}
