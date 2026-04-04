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

/** The full enriched navigation — always an array of tabs */
export type Navigation = NavTab[]

/* ── Type guards ─────────────────────────────────────────────────────── */

export function isNavPage(entry: NavPageEntry): entry is NavPage {
  return 'slug' in entry && 'href' in entry
}

export function isNavGroup(entry: NavPageEntry): entry is NavGroup {
  return 'group' in entry
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


