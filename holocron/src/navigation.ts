/**
 * Enriched navigation tree types + utility functions.
 *
 * The enriched tree has the same shape as the docs.json config, but page
 * slug strings are replaced with NavPage objects containing parsed metadata
 * (title, headings, gitSha for cache invalidation).
 *
 * Utility functions operate on this tree directly — no intermediate types.
 * Functions like getTabs(), getActiveGroups(), findPage() take the tree as
 * input and extract what's needed for rendering.
 */

import type { FlatTocItem, TocTreeNode, VisualLevel } from './components/toc-tree.ts'

/* ── Enriched navigation types ──────────────────────────────────────── */

/** An enriched tab — same as ConfigNavTab but groups are enriched */
export type NavTab = {
  tab: string
  groups: NavGroup[]
}

/** An enriched group — pages are NavPage objects or nested NavGroup */
export type NavGroup = {
  group: string
  icon?: string
  pages: NavPageEntry[]
}

/** Either an enriched page or a nested group */
export type NavPageEntry = NavPage | NavGroup

/** A fully enriched page with parsed metadata + cache SHA */
export type NavPage = {
  slug: string
  href: string
  title: string
  description?: string
  gitSha: string
  headings: NavHeading[]
}

/** A heading extracted from the MDX content */
export type NavHeading = {
  depth: number // 2-6
  text: string
  slug: string // anchor id
}

/** The full enriched navigation — either tabs or groups */
export type Navigation = NavTab[] | NavGroup[]

/* ── Type guards ─────────────────────────────────────────────────────── */

export function isNavPage(entry: NavPageEntry): entry is NavPage {
  return 'slug' in entry && 'href' in entry
}

export function isNavGroup(entry: NavPageEntry): entry is NavGroup {
  return 'group' in entry
}

export function isNavTabArray(nav: Navigation): nav is NavTab[] {
  const first = nav[0]
  return nav.length > 0 && first !== undefined && 'tab' in first
}

/* ── Utility functions ──────────────────────────────────────────────── */

/**
 * Get all tabs from the navigation. If the navigation is a flat array of
 * groups (no tabs), wraps them in a single implicit tab.
 */
export function getTabs(nav: Navigation): NavTab[] {
  if (isNavTabArray(nav)) {
    return nav
  }
  // No explicit tabs — wrap all groups in a single implicit tab
  return [{ tab: '', groups: nav }]
}

/**
 * Find the active tab based on the current URL path.
 * Matches by longest URL prefix — e.g. path "/api/overview" matches tab
 * with first page href "/api/..." over tab with href "/".
 */
export function getActiveTab(nav: Navigation, pathname: string): NavTab {
  const tabs = getTabs(nav)
  if (tabs.length <= 1) {
    return tabs[0] ?? { tab: '', groups: [] }
  }

  // For each tab, find the first page's href prefix
  const tabsWithPrefix = tabs.map((tab) => {
    const firstPage = findFirstPage(tab.groups)
    const prefix = firstPage
      ? firstPage.href.split('/').slice(0, -1).join('/') || '/'
      : '/'
    return { tab, prefix }
  })

  // Sort by prefix length descending (longest match first)
  const sorted = tabsWithPrefix.sort((a, b) => {
    return b.prefix.length - a.prefix.length
  })

  for (const { tab, prefix } of sorted) {
    if (prefix === '/' || pathname.startsWith(prefix)) {
      return tab
    }
  }

  return tabs[0] ?? { tab: '', groups: [] }
}

/**
 * Get the sidebar groups for the active tab based on current URL path.
 */
export function getActiveGroups(nav: Navigation, pathname: string): NavGroup[] {
  return getActiveTab(nav, pathname).groups
}

/**
 * Find a page by slug anywhere in the navigation tree. BFS traversal.
 */
export function findPage(nav: Navigation, slug: string): NavPage | undefined {
  const tabs = getTabs(nav)
  for (const tab of tabs) {
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
 * Useful for building search index, sitemap, etc.
 */
export function collectAllPages(nav: Navigation): NavPage[] {
  const pages: NavPage[] = []
  const tabs = getTabs(nav)
  for (const tab of tabs) {
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
 * Used during sync to look up existing pages by slug for SHA comparison.
 */
export function buildPageIndex(nav: Navigation): Map<string, NavPage> {
  const pages = collectAllPages(nav)
  return new Map(pages.map((p) => {
    return [p.slug, p]
  }))
}

/* ── Bridge to sidebar rendering ────────────────────────────────────── */

/**
 * Flatten NavGroup[] into FlatTocItem[] for the sidebar component.
 *
 * Maps our docs.json-shaped types into the existing flat list format
 * used by TableOfContents. Groups become visual level 0, pages level 1
 * (or 0 if top-level), headings h2→level 1, h3→level 2, etc.
 */
export function flattenForSidebar(groups: NavGroup[]): FlatTocItem[] {
  const result: FlatTocItem[] = []

  function walkGroups({
    groups,
    depth,
    parentHref,
  }: {
    groups: NavGroup[]
    depth: number
    parentHref: string | null
  }) {
    for (const group of groups) {
      const groupHref = `#group-${slugifyGroup(group.group)}`
      const visualLevel = Math.min(depth, 3) as VisualLevel

      // Add group node
      result.push({
        label: group.group,
        href: groupHref,
        type: 'page', // groups render like page-level items in the TOC
        visualLevel,
        prefix: '',
        parentHref,
        pageHref: groupHref,
      })

      // Walk entries inside this group
      for (const entry of group.pages) {
        if (isNavPage(entry)) {
          walkPage({ page: entry, depth: depth + 1, parentHref: groupHref })
        } else if (isNavGroup(entry)) {
          walkGroups({ groups: [entry], depth: depth + 1, parentHref: groupHref })
        }
      }
    }
  }

  function walkPage({
    page,
    depth,
    parentHref,
  }: {
    page: NavPage
    depth: number
    parentHref: string | null
  }) {
    const visualLevel = Math.min(depth, 3) as VisualLevel

    result.push({
      label: page.title,
      href: page.href,
      type: 'page',
      visualLevel,
      prefix: '',
      parentHref,
      pageHref: page.href,
    })

    // Add headings as children
    for (const heading of page.headings) {
      const headingLevel = Math.min(depth + (heading.depth - 1), 3) as VisualLevel
      result.push({
        label: heading.text,
        href: `${page.href}#${heading.slug}`,
        type: `h${heading.depth}` as FlatTocItem['type'],
        visualLevel: headingLevel,
        prefix: '',
        parentHref: page.href,
        pageHref: page.href,
      })
    }
  }

  walkGroups({ groups, depth: 0, parentHref: null })
  return result
}

function slugifyGroup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
