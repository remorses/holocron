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

import { config, navigation, switchers } from 'virtual:holocron-config'
import type { NavPage, NavTab, NavGroup, NavIcon, NavPageEntry } from './navigation.ts'
import { isNavPage, isNavGroup } from './navigation.ts'
import type { SearchEntry } from './lib/search.ts'
import type { ConfigIcon } from './config.ts'
import { resolveLogo } from './lib/generated-logo.tsx'

export { config, navigation }

/** A top-level tab or anchor rendered in the tab bar. */
export type TabItem = {
  label: string
  href: string
  icon?: NavIcon
  align?: 'start' | 'end'
}

/** A link in the top navbar (icon-only typically). */
export type HeaderLink = {
  label: string
  href: string
  icon?: NavIcon
  type?: string
}

/* ── Derived / compiled data ─────────────────────────────────────────── */

// `data.ts` only exports things that are ACTUALLY derived (tree walks).
// Plain config fields — `config.name`, `config.logo.light`,
// `config.favicon.dark`, `config.description`, `config.redirects`, etc.
// — are NOT re-exported; consumers read them off `config` directly.
// See MEMORY.md "data.ts exports — only if DERIVED, never as pure aliases".

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

/** Walk a groups tree and return path-based keys of every group that has
 *  `expanded: true` set in config — these should be pre-opened in the
 *  sidebar on first render. */
export function collectDefaultExpandedKeys(groups: NavGroup[]): string[] {
  const out: string[] = []
  walkExpandedGroups(groups, '', out)
  return out
}

function walkExpandedGroups(groups: NavGroup[], parentPath: string, out: string[]): void {
  for (const group of groups) {
    const key = parentPath ? `${parentPath}\0${group.group}` : group.group
    if (group.expanded === true) {
      out.push(key)
    }
    const nestedGroups = group.pages.filter(isNavGroup) as NavGroup[]
    if (nestedGroups.length > 0) {
      walkExpandedGroups(nestedGroups, key, out)
    }
  }
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
  // When versions or dropdowns with content are the root organizational
  // pattern, all flattened tabs come from switcher inner navs. The select
  // dropdowns replace the tab bar's role, so skip content tabs entirely
  // and only render anchors (global links like GitHub, Changelog).
  const hasSwitchers = switchers.versions.length > 0 || switchers.dropdowns.some((d) => !!d.navigation)

  const navTabs: TabItem[] = hasSwitchers
    ? []
    : navigation
        .filter((t) => t.tab !== '' && !t.hidden)
        .map((t) => {
          const firstPage = findFirstPageInTab(t)
          return {
            label: t.tab,
            href: firstPage?.href || '/',
            icon: t.icon,
            align: t.align,
          }
        })
  const anchors: TabItem[] = config.navigation.anchors
    .filter((a) => !a.hidden)
    .map((a) => {
      return { label: a.anchor, href: a.href, icon: a.icon }
    })
  return [...navTabs, ...anchors]
}

function buildHeaderLinks(): HeaderLink[] {
  return config.navbar.links.map((link) => {
    return { href: link.href, label: link.label, icon: link.icon, type: link.type }
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

const baseUrl = import.meta.env.BASE_URL || '/'

/** Resolved logo URLs for UI chrome. Falls back to generated images so
 *  header/footer can always render a normal <img> instead of special-casing
 *  a monospace text placeholder. */
export const resolvedLogo = resolveLogo(config.logo, config.name, baseUrl)

/** First tab's first page — used as the default landing destination
 *  (e.g. for the root `/` redirect and 404 fallback home link).
 *  When versions exist, prefer the default version's first page
 *  so `/` redirects to the version marked `default: true`. */
export const firstPage: NavPage | undefined = (() => {
  // When versions exist, use the default version's first page
  if (switchers.versions.length > 0) {
    const defaultVersion =
      switchers.versions.find((v) => v.default) ?? switchers.versions[0]
    if (defaultVersion) {
      for (const tab of defaultVersion.navigation.tabs) {
        const page = findFirstPageInTab(tab)
        if (page) return page
      }
    }
  }
  // Fallback: first tab's first page
  return navigation[0] ? findFirstPageInTab(navigation[0]) : undefined
})()

/* ── Active-state resolvers (pure, per-href) ─────────────────────────── */

/** Resolve which tab href a page belongs to (by longest prefix match). */
export function resolveActiveTabHref(pageHref: string | undefined): string | undefined {
  if (!pageHref) return tabs[0]?.href
  return (
    tabs.find((t) => pageHref.startsWith(t.href) && t.href !== '/')?.href ?? tabs[0]?.href
  )
}

/* ── Version / dropdown switcher data ────────────────────────────────── */

export type VersionSelectItem = {
  label: string
  tag?: string
  href: string
  pageHrefs: string[]
}

export type DropdownSelectItem = {
  label: string
  icon?: ConfigIcon
  href: string
  external?: boolean
  pageHrefs: string[]
}

function collectPageHrefsFromTabs(tabs: NavTab[]): string[] {
  const hrefs: string[] = []
  for (const tab of tabs) {
    collectPagesFromGroupsFlat(tab.groups, hrefs)
  }
  return hrefs
}

function collectPagesFromGroupsFlat(groups: NavGroup[], out: string[]): void {
  for (const group of groups) {
    for (const entry of group.pages) {
      if (isNavPage(entry)) {
        out.push(entry.href)
      } else if (isNavGroup(entry)) {
        collectPagesFromGroupsFlat([entry], out)
      }
    }
  }
}

function buildVersionSelectItems(): VersionSelectItem[] {
  return switchers.versions
    .filter((v) => !v.hidden)
    .map((v) => {
      const pageHrefs = collectPageHrefsFromTabs(v.navigation.tabs)
      const firstHref = pageHrefs[0] || '/'
      return {
        label: v.version,
        ...(v.tag && { tag: v.tag }),
        href: firstHref,
        pageHrefs,
      }
    })
}

/** True if the href looks like an external URL (absolute with protocol). */
function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//.test(href)
}

function buildDropdownSelectItems(): DropdownSelectItem[] {
  return switchers.dropdowns
    .filter((d) => !d.hidden)
    .map((d) => {
      if (d.href && !d.navigation) {
        // Link-only dropdown — external only if the href is a full URL
        return {
          label: d.dropdown,
          ...(d.icon && { icon: d.icon }),
          href: d.href,
          ...(isExternalHref(d.href) && { external: true }),
          pageHrefs: [],
        }
      }
      const pageHrefs = d.navigation ? collectPageHrefsFromTabs(d.navigation.tabs) : []
      const firstHref = pageHrefs[0] || d.href || '/'
      return {
        label: d.dropdown,
        ...(d.icon && { icon: d.icon }),
        href: firstHref,
        pageHrefs,
      }
    })
}

export const versionItems: VersionSelectItem[] = buildVersionSelectItems()
export const dropdownItems: DropdownSelectItem[] = buildDropdownSelectItems()

export function resolveActiveVersionHref(pageHref: string | undefined): string | undefined {
  if (!pageHref || versionItems.length === 0) return undefined
  const match = versionItems.find((v) => v.pageHrefs.includes(pageHref))
  if (match) return match.href
  // Default version fallback
  const defaultVersion = switchers.versions.find((v) => v.default)
  if (defaultVersion) {
    const item = versionItems.find((vi) => vi.label === defaultVersion.version)
    return item?.href
  }
  return versionItems[0]?.href
}

export function resolveActiveDropdownHref(pageHref: string | undefined): string | undefined {
  if (!pageHref || dropdownItems.length === 0) return undefined
  const match = dropdownItems.find((d) => !d.external && d.pageHrefs.includes(pageHref))
  return match?.href ?? dropdownItems.find((d) => !d.external)?.href
}
