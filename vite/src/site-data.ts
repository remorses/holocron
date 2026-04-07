/**
 * Pure site-data builders and selectors shared by source resolution and UI.
 */

import type { HolocronConfig } from './config.ts'
import type { SearchEntry } from './lib/search.ts'
import type { IconAtlas } from './lib/resolve-icons.ts'
import type { Navigation, NavGroup, NavIcon, NavPage, NavPageEntry, NavTab } from './navigation.ts'
import { isNavGroup, isNavPage } from './navigation.ts'

export type HolocronFileEntry = {
  slug: string
  sha: string
}

export type TabItem = {
  label: string
  href: string
  icon?: NavIcon
  align?: 'start' | 'end'
}

export type HeaderLink = {
  label: string
  href: string
  icon?: NavIcon
  type?: string
}

export type HolocronSiteData = {
  version: string
  config: HolocronConfig
  navigation: Navigation
  files: HolocronFileEntry[]
  icons: IconAtlas
  configSha: string
  tabs: TabItem[]
  headerLinks: HeaderLink[]
  searchEntries: SearchEntry[]
  firstPage: NavPage | undefined
}

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

export function collectAncestorGroupKeys(navigation: Navigation, pageHref: string): string[] {
  const out: string[] = []
  for (const tab of navigation) {
    walkGroups(tab.groups, pageHref, '', out)
  }
  return out
}

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

export function buildTabItems(config: HolocronConfig, navigation: Navigation): TabItem[] {
  const navTabs: TabItem[] = navigation
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

export function buildHeaderLinks(config: HolocronConfig): HeaderLink[] {
  return config.navbar.links.map((link) => {
    return { href: link.href, label: link.label, icon: link.icon, type: link.type }
  })
}

export function buildSearchEntries(navigation: Navigation): SearchEntry[] {
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

export function resolveActiveTabHref(tabs: TabItem[], pageHref: string | undefined): string | undefined {
  if (!pageHref) return tabs[0]?.href
  return (
    tabs.find((t) => pageHref.startsWith(t.href) && t.href !== '/')?.href ?? tabs[0]?.href
  )
}

export function buildSiteData(input: {
  version: string
  config: HolocronConfig
  navigation: Navigation
  files: HolocronFileEntry[]
  icons: IconAtlas
  configSha: string
}): HolocronSiteData {
  const tabs = buildTabItems(input.config, input.navigation)
  return {
    ...input,
    tabs,
    headerLinks: buildHeaderLinks(input.config),
    searchEntries: buildSearchEntries(input.navigation),
    firstPage: input.navigation[0] ? findFirstPageInTab(input.navigation[0]) : undefined,
  }
}

export function buildHrefToSlugMapFromFiles(files: HolocronFileEntry[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const file of files) {
    map.set(slugToHref(file.slug), file.slug)
  }
  return map
}

export function findFile(files: HolocronFileEntry[], slug: string): HolocronFileEntry | undefined {
  return files.find((file) => file.slug === slug)
}

function slugToHref(slug: string): string {
  if (slug === 'index') return '/'
  return `/${slug.replace(/\/index$/, '')}`
}
