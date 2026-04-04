/**
 * Enriched navigation tree types + utility functions.
 *
 * The enriched tree has the same shape as the normalized config, but page
 * slug strings are replaced with NavPage objects containing parsed metadata.
 *
 * Sidebar rendering now adapts this navigation into a Fumadocs-style page tree,
 * keeping top-level groups as separators and injecting the current page TOC as
 * a synthetic subtree under the active page.
 */

import type * as PageTree from './page-tree/index.ts'

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

/* ── Bridge to sidebar rendering ────────────────────────────────────── */

export function buildSidebarTree({
  groups,
  currentPage,
}: {
  groups: NavGroup[]
  currentPage?: NavPage
}): PageTree.Root {
  return {
    $id: 'root',
    name: 'Documentation',
    children: groups.flatMap((group, index) => {
      const children: PageTree.Node[] = []
      if (group.group) {
        children.push({
          $id: `separator:${index}:${slugifyGroup(group.group)}`,
          type: 'separator',
          name: group.group,
        })
      }
      children.push(...group.pages.map((entry, entryIndex) => {
        return buildSidebarNode({
          entry,
          currentPageHref: currentPage?.href,
          idPrefix: `${index}:${entryIndex}`,
        })
      }))
      return children
    }),
  }
}

function buildSidebarNode({
  entry,
  currentPageHref,
  idPrefix,
}: {
  entry: NavPageEntry
  currentPageHref?: string
  idPrefix: string
}): PageTree.Node {
  if (isNavPage(entry)) {
    return buildSidebarPageNode({ page: entry, currentPageHref, idPrefix })
  }

  return {
    $id: `group:${idPrefix}:${slugifyGroup(entry.group)}`,
    type: 'folder',
    name: entry.group,
    collapsible: true,
    children: entry.pages.map((child, index) => {
      return buildSidebarNode({
        entry: child,
        currentPageHref,
        idPrefix: `${idPrefix}:${index}`,
      })
    }),
  }
}

function buildSidebarPageNode({
  page,
  currentPageHref,
  idPrefix,
}: {
  page: NavPage
  currentPageHref?: string
  idPrefix: string
}): PageTree.Node {
  const item: PageTree.Item = {
    $id: `page:${page.href}`,
    type: 'page',
    name: page.title,
    url: page.href,
  }

  if (page.href !== currentPageHref || page.headings.length === 0) {
    return item
  }

  return {
    $id: `page-folder:${page.href}`,
    type: 'folder',
    name: page.title,
    index: item,
    collapsible: true,
    defaultOpen: true,
    children: buildHeadingNodes({ page, idPrefix }),
  }
}

function buildHeadingNodes({ page, idPrefix }: { page: NavPage; idPrefix: string }): PageTree.Node[] {
  const roots: Array<{ heading: NavHeading; children: Array<{ heading: NavHeading; children: any[] }> }> = []
  const stack: Array<{ heading: NavHeading; children: Array<{ heading: NavHeading; children: any[] }> }> = []

  for (const heading of page.headings) {
    const node = { heading, children: [] as Array<{ heading: NavHeading; children: any[] }> }
    while (stack.length > 0 && (stack.at(-1)?.heading.depth ?? 0) >= heading.depth) {
      stack.pop()
    }

    const parent = stack.at(-1)
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
    stack.push(node)
  }

  function toPageTreeNode(node: { heading: NavHeading; children: Array<{ heading: NavHeading; children: any[] }> }, path: string): PageTree.Node {
    const item: PageTree.Item = {
      $id: `heading:${page.href}#${node.heading.slug}`,
      type: 'page',
      name: node.heading.text,
      url: `${page.href}#${node.heading.slug}`,
    }

    if (node.children.length === 0) {
      return item
    }

    return {
      $id: `heading-folder:${page.href}#${node.heading.slug}`,
      type: 'folder',
      name: node.heading.text,
      index: item,
      collapsible: false,
      defaultOpen: true,
      children: node.children.map((child, index) => {
        return toPageTreeNode(child, `${path}:${index}`)
      }),
    }
  }

  return roots.map((node, index) => {
    return toPageTreeNode(node, `${idPrefix}:${index}`)
  })
}

function slugifyGroup(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
