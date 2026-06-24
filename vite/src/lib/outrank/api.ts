/**
 * Outrank REST API client.
 *
 * Minimal client for fetching articles from the Outrank API. Only uses
 * the endpoints needed by the runtime provider:
 *   - GET /articles  — list published articles with metadata
 *   - GET /articles/{id}/content — get full article markdown + HTML
 *
 * API docs: https://www.outrank.so/docs/api
 *
 * The base URL defaults to `https://outrank.so/api/agent/v1` but can be
 * overridden via `HOLOCRON_OUTRANK_API_URL` for testing with a mock server.
 */

const DEFAULT_BASE_URL = 'https://outrank.so/api/agent/v1'
const TIMEOUT_MS = 15_000

export type OutrankArticle = {
  id: string
  title: string
  slug: string
  meta_description: string
  content_markdown: string
  content_html: string
  image_url: string | null
  tags: string[]
  created_at: string
  updated_at?: string
}

type ArticleListItem = {
  id: string
  title: string
  slug: string
  meta_description: string
  image_url: string | null
  tags: string[]
  created_at: string
  updated_at?: string
}

type ArticleContent = {
  content_markdown: string
  content_html: string
}

function getBaseUrl(): string {
  return process.env.HOLOCRON_OUTRANK_API_URL || DEFAULT_BASE_URL
}

async function apiFetch<T>(path: string, apiKey: string): Promise<T> {
  const url = `${getBaseUrl()}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Outrank API ${res.status}: ${text.slice(0, 200)}`)
    }

    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch all published articles with their full content.
 *
 * Strategy: fetch the article list first, then fetch each article's content
 * in parallel. The list endpoint returns metadata; the content endpoint
 * returns the full markdown + HTML.
 */
export async function fetchOutrankArticles(apiKey: string): Promise<OutrankArticle[]> {
  // The list endpoint returns article metadata (no content body).
  // We need to check if the list response already includes content_markdown.
  // If it does, we can skip the per-article content fetch.
  const listResponse = await apiFetch<{ data?: ArticleListItem[]; articles?: ArticleListItem[] } | ArticleListItem[]>(
    '/articles',
    apiKey,
  )

  // The API may return { data: [...] } or { articles: [...] } or a bare array.
  const items: ArticleListItem[] = Array.isArray(listResponse)
    ? listResponse
    : (listResponse as any).data ?? (listResponse as any).articles ?? []

  if (items.length === 0) return []

  // Check if first item already has content (some API versions include it)
  const firstItem = items[0] as any
  if (firstItem?.content_markdown) {
    return items.map((item) => ({
      ...item,
      content_markdown: (item as any).content_markdown ?? '',
      content_html: (item as any).content_html ?? '',
    }))
  }

  // Fetch content for each article in parallel
  const articles = await Promise.all(
    items.map(async (item): Promise<OutrankArticle> => {
      try {
        const content = await apiFetch<ArticleContent>(
          `/articles/${item.id}/content`,
          apiKey,
        )
        return {
          ...item,
          content_markdown: content.content_markdown,
          content_html: content.content_html,
        }
      } catch {
        // If content fetch fails for one article, include it with empty body
        return {
          ...item,
          content_markdown: '',
          content_html: '',
        }
      }
    }),
  )

  return articles
}
