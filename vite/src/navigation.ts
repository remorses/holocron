/**
 * Enriched navigation tree types + utility functions.
 *
 * The enriched tree has the same shape as the normalized config, but page
 * slug strings are replaced with NavPage objects containing parsed metadata
 * (title, headings, gitSha for cache invalidation).
 *
 * Navigation is always NavTab[] — normalization happens in readConfig(),
 * so these functions never deal with union discrimination.
 */

import type {
  ConfigIcon,
  ConfigNavGroup,
  NavTabBase,
} from './config.ts'

/* ── Enriched navigation types ──────────────────────────────────────── */

/** An icon in the enriched tree. Same shape as the config-layer icon —
 *  renderers decide how to display each variant (string path → `<img>` or
 *  library icon; object → library/style aware lookup). */
export type NavIcon = ConfigIcon

/** An enriched tab — reuses the schema-derived base (tab/icon/hidden/align)
 *  and swaps in enriched groups. */
export type NavTab = NavTabBase & {
  groups: NavGroup[]
}

/** An enriched group — reuses the schema-derived group shape and swaps
 *  in `NavPageEntry[]` for the `pages` field (page slugs become NavPage
 *  objects). The `root` slug is resolved to an href at enrich time. */
export type NavGroup = Omit<ConfigNavGroup, 'pages'> & {
  pages: NavPageEntry[]
}

/** Either an enriched page or a nested group */
export type NavPageEntry = NavPage | NavGroup

/** A fully enriched page with parsed metadata + cache SHA.
 *  `icon` is extracted from MDX frontmatter (Mintlify convention:
 *  `icon: rocket` in YAML front matter). */
export type NavPage = {
  slug: string
  href: string
  title: string
  description?: string
  gitSha: string
  headings: NavHeading[]
  icon?: NavIcon
}

/** A heading extracted from the MDX content */
export type NavHeading = {
  depth: number // 2-6
  text: string
  slug: string // anchor id
}

/** The full enriched navigation — always an array of tabs */
export type Navigation = NavTab[]

/* ── Type guards ─────────────────────────────────────────────────────── */

export function isNavPage(entry: NavPageEntry): entry is NavPage {
  return 'slug' in entry && 'href' in entry
}

export function isNavGroup(entry: NavPageEntry): entry is NavGroup {
  return 'group' in entry
}

/** Whether a group should appear in the sidebar after `hidden` filtering.
 *
 *  Rules:
 *  - Hidden groups (`group.hidden === true`) always return `false`.
 *  - Groups with ZERO defined pages return `true` — treat them as
 *    intentional section-label dividers the user wrote explicitly.
 *  - Groups that have defined children but ALL of them are hidden (or
 *    recursively contain no visible pages) return `false`.
 *  - Otherwise `true`. */
export function hasVisibleSidebarEntries(group: NavGroup): boolean {
  if (group.hidden) return false
  if (group.pages.length === 0) return true
  for (const entry of group.pages) {
    if (isNavPage(entry)) return true
    if (isNavGroup(entry) && hasVisibleSidebarEntries(entry)) return true
  }
  return false
}

/* ── Utility functions ──────────────────────────────────────────────── */

/**
 * Find the active tab based on the current URL path.
 * Matches by longest URL prefix.
 */
export function getActiveTab(nav: Navigation, pathname: string): NavTab {
  if (nav.length <= 1) {
    return nav[0] ?? { tab: '', groups: [] }
  }

  const tabsWithPrefix = nav.map((tab) => {
    const firstPage = findFirstPage(tab.groups)
    const prefix = firstPage
      ? firstPage.href.split('/').slice(0, -1).join('/') || '/'
      : '/'
    return { tab, prefix }
  })

  const sorted = tabsWithPrefix.sort((a, b) => {
    return b.prefix.length - a.prefix.length
  })

  for (const { tab, prefix } of sorted) {
    if (prefix === '/' || pathname.startsWith(prefix)) {
      return tab
    }
  }

  return nav[0] ?? { tab: '', groups: [] }
}

/**
 * Get the sidebar groups for the active tab based on current URL path.
 */
export function getActiveGroups(nav: Navigation, pathname: string): NavGroup[] {
  return getActiveTab(nav, pathname).groups
}

/**
 * Find a page by slug anywhere in the navigation tree.
 */
export function findPage(nav: Navigation, slug: string): NavPage | undefined {
  for (const tab of nav) {
    const found = findPageInGroups(tab.groups, slug)
    if (found) {
      return found
    }
  }
  return undefined
}

function findPageInGroups(groups: NavGroup[], slug: string): NavPage | undefined {
  for (const group of groups) {
    for (const entry of group.pages) {
      if (isNavPage(entry)) {
        if (entry.slug === slug) {
          return entry
        }
      } else if (isNavGroup(entry)) {
        const found = findPageInGroups([entry], slug)
        if (found) {
          return found
        }
      }
    }
  }
  return undefined
}

/** Find the first NavPage in a list of groups (DFS) */
function findFirstPage(groups: NavGroup[]): NavPage | undefined {
  for (const group of groups) {
    for (const entry of group.pages) {
      if (isNavPage(entry)) {
        return entry
      }
      if (isNavGroup(entry)) {
        const found = findFirstPage([entry])
        if (found) {
          return found
        }
      }
    }
  }
  return undefined
}

/**
 * Collect all NavPage objects from the navigation tree.
 */
export function collectAllPages(nav: Navigation): NavPage[] {
  const pages: NavPage[] = []
  for (const tab of nav) {
    collectPagesFromGroups(tab.groups, pages)
  }
  return pages
}

function collectPagesFromGroups(groups: NavGroup[], out: NavPage[]): void {
  for (const group of groups) {
    for (const entry of group.pages) {
      if (isNavPage(entry)) {
        out.push(entry)
      } else if (isNavGroup(entry)) {
        collectPagesFromGroups([entry], out)
      }
    }
  }
}

/**
 * Build a Map<slug, NavPage> from the cached navigation tree.
 */
export function buildPageIndex(nav: Navigation): Map<string, NavPage> {
  const pages = collectAllPages(nav)
  return new Map(pages.map((p) => {
    return [p.slug, p]
  }))
}

/* ── Href ↔ slug mapping ─────────────────────────────────────────────── */

/**
 * Canonical slug → href normalization.
 * Same logic as sync.ts `slugToHref()` — duplicated here to avoid
 * importing the sync module (which pulls in heavy build-time deps).
 *
 *   `"index"`           → `"/"`
 *   `"guide/index"`     → `"/guide"`
 *   `"getting-started"` → `"/getting-started"`
 */
export function slugToHref(slug: string): string {
  if (slug === 'index') return '/'
  return `/${slug.replace(/\/index$/, '')}`
}

/**
 * Build a bidirectional href → slug map from mdxContent keys.
 * Uses `slugToHref()` for normalization so the mapping is consistent
 * everywhere (raw markdown middleware, page pipeline, sitemap).
 */
export function buildHrefToSlugMap(mdxContent: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>()
  for (const slug of Object.keys(mdxContent)) {
    map.set(slugToHref(slug), slug)
  }
  return map
}

/* ── Filesystem-aware page lookup ────────────────────────────────────── */

/**
 * Lightweight title extraction from raw MDX — avoids importing the full
 * mdast parser at runtime. Checks frontmatter `title:` first, then
 * falls back to the first `# heading`.
 */
function extractTitleFromMdx(mdx: string): string {
  // Check frontmatter title: line
  const fmMatch = mdx.match(/^---\s*\n([\s\S]*?)\n---/)
  if (fmMatch?.[1]) {
    const titleLine = fmMatch[1].match(/^title:\s*(.+)/m)
    if (titleLine?.[1]) return titleLine[1].replace(/^["']|["']$/g, '').trim()
  }
  // Fall back to first # heading
  const headingMatch = mdx.match(/^#\s+(.+)/m)
  if (headingMatch?.[1]) return headingMatch[1].trim()
  return 'Untitled'
}

/**
 * Find a page by slug, checking both the navigation tree AND mdxContent.
 *
 * 1. First: look up in navigation (enriched NavPage with title, headings, icon)
 * 2. Fallback: if the slug exists in mdxContent but not in navigation,
 *    build a minimal NavPage so the page is still serveable.
 *
 * This ensures pages that exist on disk are always serveable even if
 * not listed in the navigation config.
 */
export function findPageBySlug(
  nav: Navigation,
  slug: string,
  mdxContent: Record<string, string>,
): NavPage | undefined {
  // Prefer navigation — gives us full metadata (title, headings, icon, etc.)
  const navPage = findPage(nav, slug)
  if (navPage) return navPage

  // Fallback: file exists on disk but not in navigation config
  const mdx = mdxContent[slug]
  if (!mdx) return undefined

  return {
    slug,
    href: slugToHref(slug),
    title: extractTitleFromMdx(mdx),
    gitSha: '',
    headings: [],
  }
}


