/**
 * Shared static site data.
 *
 * Imports raw config + navigation tree from `virtual:holocron-config` and
 * derives the values needed across both the server handler and the client
 * chrome components (tabs, header links, search entries, etc.).
 *
 * All exports are COMPUTED ONCE at module load. No per-request work happens
 * here. Client components importing from this module get the derived data
 * bundled into the client chunk once — browsers cache the bundle, so the
 * navigation tree is not re-shipped on every page navigation.
 *
 * This module is client-safe: it does NOT import the server-only
 * `virtual:holocron-mdx` module. Only the app factory imports MDX content.
 */

import { config, navigation } from 'virtual:holocron-config'
import type { NavPage, NavTab, NavGroup, NavPageEntry } from './navigation.ts'
import { isNavPage, isNavGroup } from './navigation.ts'
import type { SearchEntry } from './components/search.ts'

export { config, navigation }

export type TabItem = { label: string; href: string }
export type HeaderLink = { label: string; href: string; icon?: React.ReactNode }

/* ── Site identity ───────────────────────────────────────────────────── */

export const siteName: string = config.name
export const logoSrc: string | undefined = config.logo.light || undefined
export const faviconLight: string | undefined = config.favicon.light || undefined

/* ── Navigation helpers (also exported for server use) ───────────────── */

/** Find the first NavPage inside a NavTab (DFS across nested groups). */
export function findFirstPageInTab(tab: NavTab): NavPage | undefined {
  for (const group of tab.groups) {
    const found = findFirstPageInGroup(group)
    if (found) return found
  }
  return undefined
}

function findFirstPageInGroup(group: NavGroup): NavPage | undefined {
  for (const entry of group.pages) {
    if (isNavPage(entry)) return entry
    if (isNavGroup(entry)) {
      const found = findFirstPageInGroup(entry)
      if (found) return found
    }
  }
  return undefined
}

/** Walk the navigation tree and return the path-based group key for every
 *  ancestor group that contains the given page href. Path segments are joined
 *  by `\0` to guarantee uniqueness even across duplicate group labels. */
export function collectAncestorGroupKeys(pageHref: string): string[] {
  const out: string[] = []
  for (const tab of navigation) {
    walkGroups(tab.groups, pageHref, '', out)
  }
  return out
}

function walkGroups(
  groups: NavGroup[],
  pageHref: string,
  parentPath: string,
  out: string[],
): boolean {
  let matchedAny = false
  for (const group of groups) {
    const key = parentPath ? `${parentPath}\0${group.group}` : group.group
    if (groupContainsPage(group, pageHref)) {
      out.push(key)
      matchedAny = true
    }
    const nestedGroups = group.pages.filter(isNavGroup) as NavGroup[]
    if (nestedGroups.length > 0) {
      walkGroups(nestedGroups, pageHref, key, out)
    }
  }
  return matchedAny
}

function groupContainsPage(group: NavGroup, pageHref: string): boolean {
  for (const entry of group.pages) {
    if (isNavPage(entry) && entry.href === pageHref) return true
    if (isNavGroup(entry) && groupContainsPage(entry, pageHref)) return true
  }
  return false
}

/* ── Static derived data ─────────────────────────────────────────────── */

function buildTabItems(): TabItem[] {
  const navTabs: TabItem[] = navigation
    .filter((t) => t.tab !== '')
    .map((t) => {
      const firstPage = findFirstPageInTab(t)
      return { label: t.tab, href: firstPage?.href || '/' }
    })
  const anchors: TabItem[] = config.navigation.anchors.map((a) => {
    return { label: a.anchor, href: a.href }
  })
  return [...navTabs, ...anchors]
}

function buildHeaderLinks(): HeaderLink[] {
  return config.navbar.links.map((link) => {
    return { href: link.href, label: link.label }
  })
}

function buildSearchEntries(): SearchEntry[] {
  const entries: SearchEntry[] = []
  for (const tab of navigation) {
    collectEntriesFromGroups(tab.groups, '', entries)
  }
  return entries
}

function collectEntriesFromGroups(
  groups: NavGroup[],
  parentPath: string,
  out: SearchEntry[],
): void {
  for (const group of groups) {
    const key = parentPath ? `${parentPath}\0${group.group}` : group.group
    for (const entry of group.pages) {
      if (isNavPage(entry)) {
        out.push({ label: entry.title, href: entry.href, groupPath: key, pageHref: null })
        for (const h of entry.headings) {
          out.push({
            label: h.text,
            href: `${entry.href}#${h.slug}`,
            groupPath: key,
            pageHref: entry.href,
          })
        }
      } else if (isNavGroup(entry)) {
        collectEntriesFromGroups([entry], key, out)
      }
    }
  }
}

/** Site-wide tabs, derived from navigation tabs + anchors. */
export const tabs: TabItem[] = buildTabItems()

/** Header navbar links from config.navbar.links. */
export const headerLinks: HeaderLink[] = buildHeaderLinks()

/** Flat search entry list for Orama. Pages + headings, with ancestor keys. */
export const searchEntries: SearchEntry[] = buildSearchEntries()

/** First tab's first page — used as the default landing destination
 *  (e.g. for the root `/` redirect and 404 fallback home link). */
export const firstPage: NavPage | undefined = navigation[0]
  ? findFirstPageInTab(navigation[0])
  : undefined

/* ── Active-state resolvers (pure, per-href) ─────────────────────────── */

/** Resolve which tab href a page belongs to (by longest prefix match). */
export function resolveActiveTabHref(pageHref: string | undefined): string | undefined {
  if (!pageHref) return tabs[0]?.href
  return (
    tabs.find((t) => pageHref.startsWith(t.href) && t.href !== '/')?.href ?? tabs[0]?.href
  )
}
