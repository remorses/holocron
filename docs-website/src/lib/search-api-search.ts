import { SortedResult as BaseSortedResult } from 'fumadocs-core/server'
import { client } from './search-api'
import type { SearchSectionsResponse } from 'searchapi/sdk'
import type { FileUpdate } from './edit-tool'
import YAML from 'js-yaml'
import { ProcessorDataFrontmatter } from './mdx-heavy'

export interface SortedResult extends BaseSortedResult {
  line?: number
  basePath?: string // Path without fragment
  fragment?: string
}

export async function searchDocsWithSearchApi({
  query,
  branchId,
  exact,
  filesInDraft,
}: {
  query: string | string[]
  branchId?: string | null
  exact?: boolean
  filesInDraft?: Record<string, FileUpdate>
}): Promise<SortedResult[]> {
  if (!branchId) {
    console.log(`no branchId`)
  }

  if (!query || (Array.isArray(query) && query.length === 0)) {
    return []
  }

  // Convert query array to single string
  const searchQuery = Array.isArray(query) ? query.join(' ') : query

  // Apply exact search wrapping if requested
  const finalQuery =
    exact && !searchQuery.startsWith('"') && !searchQuery.endsWith('"') ? `"${searchQuery}"` : searchQuery

  let searchResults: SortedResult[] = []

  if (branchId) {
    const result = await client.searchSections({
      datasetId: branchId,
      query: finalQuery,
      page: 0,
      perPage: 20,
      maxChunksPerFile: 4,
    })

    searchResults = formatSearchApiResults(result)
  }

  // Search in filesInDraft if provided
  if (filesInDraft && Object.keys(filesInDraft).length > 0) {
    const draftResults = searchFilesInDraft(filesInDraft, searchQuery)
    searchResults = [...searchResults, ...draftResults]
  }

  return searchResults
}

function formatSearchApiResults(response: SearchSectionsResponse): SortedResult[] {
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
    const pageSlug = firstResult.metadata?.slug || '/' + filename.replace(/\.mdx?$/, '')

    grouped.push({
      id: 'page-' + filename,
      type: 'page',
      url: pageSlug,
      content: pageTitle,
    })

    // Add section-level results
    for (const result of results) {
      const basePath = result.metadata?.slug || '/' + result.filename.replace(/\.mdx?$/, '')
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

function searchFilesInDraft(filesInDraft: Record<string, FileUpdate>, searchQuery: string): SortedResult[] {
  const results: SortedResult[] = []
  const queryRegex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')

  for (const [filePath, fileUpdate] of Object.entries(filesInDraft)) {
    if (!fileUpdate.content) continue

    const content = fileUpdate.content
    const matches = [...content.matchAll(queryRegex)]

    if (matches.length === 0) continue

    // Extract title from frontmatter if it exists
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    let title =
      filePath
        .replace(/\.mdx?$/, '')
        .split('/')
        .pop() || 'Untitled'

    if (frontmatterMatch) {
      const yamlContent = frontmatterMatch[1]
      const parsed = YAML.load(yamlContent) as ProcessorDataFrontmatter
      
      if (parsed?.visibility === 'hidden' || parsed?.noindex === true) {
        continue
      }
      
      if (parsed?.title) {
        title = String(parsed.title).trim()
      }
    }

    // Create slug from file path
    const slug = '/' + filePath.replace(/\.mdx?$/, '')

    // Add page-level result
    results.push({
      id: 'draft-page-' + filePath,
      type: 'page',
      url: slug,
      content: `${title} (Draft)`,
    })

    // Add matches as text results
    const lines = content.split('\n')
    for (const match of matches.slice(0, 5)) {
      // Limit to 5 matches per file
      const matchIndex = match.index || 0
      const beforeMatch = content.substring(0, matchIndex)
      const lineNumber = beforeMatch.split('\n').length

      // Get context around the match
      const startLine = Math.max(0, lineNumber - 2)
      const endLine = Math.min(lines.length, lineNumber + 2)
      const contextLines = lines.slice(startLine, endLine)
      const snippet = contextLines.join('\n')

      results.push({
        id: `draft-${filePath}-${matchIndex}`,
        type: 'text',
        url: `${slug}#line-${lineNumber}`,
        content: snippet,
        line: lineNumber,
        basePath: slug,
        fragment: `line-${lineNumber}`,
      })
    }
  }

  return results
}

export function formatSearchApiSearchResults({
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
