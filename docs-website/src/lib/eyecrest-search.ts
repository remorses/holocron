import { SortedResult as BaseSortedResult } from 'fumadocs-core/server'
import { client } from './eyecrest'
import type { SearchSectionsResponse } from 'searchapi/sdk'

export interface SortedResult extends BaseSortedResult {
    line?: number
    basePath?: string  // Path without fragment
    fragment?: string
}

export async function searchDocsWithEyecrest({
    query,
    branchId,
    exact,
}: {
    query: string | string[]
    branchId?: string | null
    exact?: boolean
}): Promise<SortedResult[]> {
    if (!branchId) {
        console.log(`no branchId`)
        return []
    }

    if (!query || (Array.isArray(query) && query.length === 0)) {
        return []
    }

    // Convert query array to single string
    const searchQuery = Array.isArray(query) ? query.join(' ') : query

    // Apply exact search wrapping if requested
    const finalQuery = exact && !searchQuery.startsWith('"') && !searchQuery.endsWith('"')
        ? `"${searchQuery}"`
        : searchQuery

    try {
        const result = await client.searchSections({
            datasetId: branchId,
            query: finalQuery,
            page: 0,
            perPage: 20,
            maxChunksPerFile: 4,
        })

        return formatEyecrestResults(result)
    } catch (error) {
        console.error('Error searching with Eyecrest:', error)
        return []
    }
}

function formatEyecrestResults(response: SearchSectionsResponse): SortedResult[] {
    const grouped: SortedResult[] = []
    const pageGroups = new Map<string, typeof response.results>()

    // Group results by filename
    for (const result of response.results) {
        const existing = pageGroups.get(result.filename) || []
        existing.push(result)
        pageGroups.set(result.filename, existing)
    }

    // Process each page group
    for (const [filename, results] of pageGroups) {
        // Add page-level result
        const firstResult = results[0]
        const pageTitle = firstResult.metadata?.title || filename
        const pageSlug = firstResult.metadata?.slug || ('/' + filename.replace(/\.mdx?$/, ''))

        grouped.push({
            id: 'page-' + filename,
            type: 'page',
            url: pageSlug,
            content: pageTitle,
        })

        // Add section-level results
        for (const result of results) {
            const basePath = result.metadata?.slug || ('/' + result.filename.replace(/\.mdx?$/, ''))
            const fragment = result.sectionSlug && result.sectionSlug !== 'frontmatter-0' ? result.sectionSlug : undefined
            const sectionUrl = fragment ? `${basePath}#${fragment}` : basePath

            grouped.push({
                id: `${result.filename}-${result.sectionSlug}`,
                type: 'text',
                url: sectionUrl,
                content: result.cleanedSnippet || result.snippet,
                line: result.startLine,
                basePath,
                fragment,
            })
        }
    }

    return grouped
}

export function formatEyecrestSearchResults({
    results,
    baseUrl,
}: {
    results: SortedResult[]
    baseUrl: string
}): string {
    let output = ''

    for (const result of results) {
        if (result.content && result.type !== 'page' && result.basePath) {
            const lineParam = result.line ? `?startLine=${result.line}` : ''
            const fragmentPart = result.fragment ? `#${result.fragment}` : ''
            const sourceUrl = `${baseUrl}${result.basePath}.md${lineParam}${fragmentPart}`

            output += `**Source:** ${sourceUrl}\n\n${result.content}\n\n━━━\n\n`
        }
    }

    return output
}
