/**
 * @holocron.so/outrank — Outrank blog provider for Holocron.
 *
 * Fetches articles from the Outrank API at request time (cached) and renders
 * them as MDX pages. Each article becomes a page under the configured `base`
 * slug prefix (defaults to "blog").
 *
 * Articles are grouped by their first tag. Articles with no tags go into an
 * unnamed group.
 *
 * Usage in provider file (e.g. ./providers/blog.ts):
 *
 *   import { outrank } from '@holocron.so/outrank'
 *   export default outrank({ apiKey: process.env.OUTRANK_API_KEY! })
 *
 * Then in docs.json:
 *
 *   { "tab": "Blog", "provider": "./providers/blog.ts", "base": "blog" }
 */

import type { CustomTabProvider } from '@holocron.so/vite'

export type OutrankOptions = {
  /** Outrank API key. Required. */
  apiKey: string
  /** Cache TTL in milliseconds. Defaults to 1 hour (3_600_000). */
  ttlMs?: number
}

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

/**
 * Create an Outrank blog provider for Holocron.
 *
 * Returns a `CustomTabProvider` that fetches articles from the Outrank API
 * at request time and caches them. Pass the result as the default export
 * of your provider file.
 */
export function outrank(options: OutrankOptions): CustomTabProvider {
  const { apiKey, ttlMs = 60 * 60 * 1000 } = options

  return {
    name: 'outrank',
    static: false,
    ttlMs,

    async generate({ tab }) {
      const base = tab.base ?? 'blog'
      const articles = await fetchOutrankArticles(apiKey)

      const mdxContent: Record<string, string> = {}
      const tagGroups = new Map<string, string[]>()

      for (const article of articles) {
        const slug = base ? `${base}/${article.slug}` : article.slug
        mdxContent[slug] = buildArticleMdx(article)

        const tag = article.tags?.[0] ?? ''
        const existing = tagGroups.get(tag)
        if (existing) {
          existing.push(slug)
        } else {
          tagGroups.set(tag, [slug])
        }
      }

      // Build navigation groups from tags. Unnamed group (empty tag) last.
      const groups: Array<{ group: string; pages: string[] }> = []
      for (const [tag, slugs] of tagGroups) {
        if (tag) {
          groups.push({ group: tag, pages: slugs })
        }
      }
      const untagged = tagGroups.get('')
      if (untagged) {
        groups.push({ group: '', pages: untagged })
      }
      if (groups.length === 0) {
        groups.push({ group: '', pages: [] })
      }

      return { groups, mdxContent }
    },
  }
}

// ── Outrank API client ──────────────────────────────────────────────────

const DEFAULT_BASE_URL = 'https://outrank.so/api/agent/v1'
const TIMEOUT_MS = 15_000

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

async function apiFetch<T>(path: string, key: string): Promise<T> {
  const url = `${getBaseUrl()}${path}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${key}`,
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

async function fetchOutrankArticles(key: string): Promise<OutrankArticle[]> {
  const listResponse = await apiFetch<
    { data?: ArticleListItem[]; articles?: ArticleListItem[] } | ArticleListItem[]
  >('/articles', key)

  // The API may return { data: [...] }, { articles: [...] }, or a bare array.
  const items: ArticleListItem[] = Array.isArray(listResponse)
    ? listResponse
    : (listResponse as any).data ?? (listResponse as any).articles ?? []

  if (items.length === 0) return []

  // Check if first item already includes content (some API versions do)
  const first = items[0] as any
  if (first?.content_markdown) {
    return items.map((item) => ({
      ...item,
      content_markdown: (item as any).content_markdown ?? '',
      content_html: (item as any).content_html ?? '',
    }))
  }

  // Fetch content for each article in parallel
  return Promise.all(
    items.map(async (item): Promise<OutrankArticle> => {
      try {
        const content = await apiFetch<ArticleContent>(
          `/articles/${item.id}/content`,
          key,
        )
        return { ...item, content_markdown: content.content_markdown, content_html: content.content_html }
      } catch {
        return { ...item, content_markdown: '', content_html: '' }
      }
    }),
  )
}

// ── MDX builder ─────────────────────────────────────────────────────────

function buildArticleMdx(article: OutrankArticle): string {
  const fmLines: string[] = ['---']
  fmLines.push(`title: "${escFm(article.title)}"`)
  if (article.meta_description) {
    fmLines.push(`description: "${escFm(article.meta_description)}"`)
  }
  if (article.image_url) {
    fmLines.push(`"og:image": "${escFm(article.image_url)}"`)
  }
  fmLines.push('---', '')

  let body = article.content_markdown || ''
  if (!body && article.content_html) {
    body = article.content_html
  }

  return fmLines.join('\n') + body
}

function escFm(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')
}
