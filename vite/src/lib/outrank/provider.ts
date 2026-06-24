/**
 * Outrank runtime virtual tab provider.
 *
 * Fetches articles from the Outrank API at request time (cached) and renders
 * them as MDX pages. Each article becomes a page under the tab's `base` slug
 * prefix (defaults to "blog").
 *
 * Articles are grouped by their first tag. Articles with no tags go into an
 * unnamed group. This produces a sidebar like:
 *   Blog
 *   ├── Getting Started (tag)
 *   │   ├── Article A
 *   │   └── Article B
 *   ├── Advanced (tag)
 *   │   └── Article C
 *   └── Article D (no tag)
 *
 * Config usage:
 *   {
 *     "tab": "Blog",
 *     "outrank": "outr_live_xxx",
 *     "base": "blog"
 *   }
 *
 * The API key can also be an env var reference: `"$OUTRANK_API_KEY"`.
 */

import type { ConfigNavGroup } from '../../config.ts'
import type { CustomTabProvider } from '../runtime-provider.ts'
import type { VirtualTabResult } from '../virtual-tab-provider.ts'
import { buildVirtualPageMdx } from '../virtual-page-mdx.ts'
import { fetchOutrankArticles, type OutrankArticle } from './api.ts'

/** Resolve an API key value. If it starts with `$`, read from env. */
function resolveApiKey(raw: string): string {
  if (raw.startsWith('$')) {
    const envName = raw.slice(1)
    const value = process.env[envName]
    if (!value) {
      throw new Error(
        `Outrank API key env var "${envName}" is not set. ` +
        `Set it in your environment or replace "$${envName}" with the actual key in docs.json.`,
      )
    }
    return value
  }
  return raw
}

export const outrankProvider: CustomTabProvider = {
  name: 'outrank',
  static: false, // runs at request time, cached
  ttlMs: 60 * 60 * 1000, // 1 hour

  async generate({ tab }): Promise<VirtualTabResult> {
    const apiKey = resolveApiKey(tab.outrank!)
    const base = tab.base ?? 'blog'

    const articles = await fetchOutrankArticles(apiKey)

    const mdxContent: Record<string, string> = {}
    const tagGroups = new Map<string, string[]>()

    for (const article of articles) {
      const slug = base ? `${base}/${article.slug}` : article.slug

      mdxContent[slug] = buildArticleMdx(article)

      // Group by first tag, or empty string for untagged
      const tag = article.tags?.[0] ?? ''
      const existing = tagGroups.get(tag)
      if (existing) {
        existing.push(slug)
      } else {
        tagGroups.set(tag, [slug])
      }
    }

    // Build navigation groups from tags. Unnamed group (empty tag) last.
    const groups: ConfigNavGroup[] = []
    for (const [tag, slugs] of tagGroups) {
      if (tag) {
        groups.push({ group: tag, pages: slugs })
      }
    }
    // Add untagged articles
    const untagged = tagGroups.get('')
    if (untagged) {
      groups.push({ group: '', pages: untagged })
    }

    // If no groups were created (no articles), add one empty group
    if (groups.length === 0) {
      groups.push({ group: '', pages: [] })
    }

    return { groups, mdxContent }
  },
}

/** Build MDX string for a single Outrank article. */
function buildArticleMdx(article: OutrankArticle): string {
  const frontmatter: Record<string, string | undefined> = {
    title: article.title,
    description: article.meta_description || undefined,
  }

  // Add image as sidebarIcon or og:image if available
  if (article.image_url) {
    frontmatter['og:image'] = article.image_url
  }

  let body = article.content_markdown || ''

  // If no markdown but HTML exists, wrap it in a raw HTML block
  if (!body && article.content_html) {
    body = article.content_html
  }

  return buildVirtualPageMdx({ frontmatter, body })
}
