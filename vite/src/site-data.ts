import type { HolocronConfig, ConfigIcon } from './config.ts'
import { resolveLogo, type ResolvedLogo } from './lib/generated-logo.tsx'
import type { IconAtlas } from './lib/resolve-icons.ts'
import type { SearchEntry } from './lib/search.ts'
import type {
  Navigation,
  NavPage,
  NavPageEntry,
  NavTab,
  NavGroup,
  NavVersionItem,
  NavDropdownItem,
  NavIcon,
} from './navigation.ts'
import { collectAllPageHrefs, hasVisibleSidebarEntries, isNavPage, isNavGroup, isVisibleNavPage } from './navigation.ts'

export type HolocronSiteData = {
  config: HolocronConfig
  navigation: Navigation
  switchers: {
    versions: NavVersionItem[]
    dropdowns: NavDropdownItem[]
  }
  base: string
  icons: IconAtlas
  /** Request origin (e.g. `https://docs.mysite.com`). Used to detect
   *  same-host absolute URLs so they get client-side navigation instead
   *  of opening in a new tab. */
  origin: string
}

/** A top-level tab rendered in the tab bar. */
export type TabItem = {
  label: string
  href: string
  icon?: NavIcon
  iconColor?: string
  align?: 'start' | 'end'
  /** All page hrefs belonging to this tab (for active tab matching). */
  pageHrefs?: string[]
}

/** An anchor link rendered in the left sidebar (external links like GitHub, Discord, etc.). */
export type SidebarAnchor = {
  label: string
  href: string
  icon?: NavIcon
  iconColor?: string
}

/** A link in the top navbar (icon-only typically). */
export type HeaderLink = {
  label: string
  href: string
  icon?: NavIcon
  iconColor?: string
  type?: string
}

export type VersionSelectItem = {
  label: string
  tag?: string
  href: string
  pageHrefs: string[]
}

export type DropdownSelectItem = {
  label: string
  icon?: ConfigIcon
  iconColor?: string
  href: string
  external?: boolean
  pageHrefs: string[]
}

/** Find the first NavPage inside a NavTab (DFS across nested groups). */
export function findFirstPageInTab(tab: NavTab): NavPage | undefined {
  for (const group of tab.groups) {
    const found = findFirstPageInGroup(group)
    if (found) return found
  }
  return undefined
}

function findFirstPageInGroup(group: NavGroup): NavPage | undefined {
  if (group.rootPage && isVisibleNavPage(group.rootPage)) return group.rootPage
  for (const entry of group.pages) {
    if (isNavPage(entry) && isVisibleNavPage(entry)) return entry
    if (isNavGroup(entry)) {
      const found = findFirstPageInGroup(entry)
      if (found) return found
    }
  }
  return undefined
}

export function findFirstPage(site: HolocronSiteData): NavPage | undefined {
  if (site.switchers.versions.length > 0) {
    const defaultVersion =
      site.switchers.versions.find((v) => v.default) ?? site.switchers.versions[0]
    if (defaultVersion) {
      for (const tab of defaultVersion.navigation.tabs) {
        const page = findFirstPageInTab(tab)
        if (page) return page
      }
    }
  }
  return site.navigation[0] ? findFirstPageInTab(site.navigation[0]) : undefined
}

/** Walk the navigation tree and return the path-based group key for every
 *  ancestor group that contains the given page href. Path segments are joined
 *  by `\0` to guarantee uniqueness even across duplicate group labels. */
export function collectAncestorGroupKeys(site: HolocronSiteData, pageHref: string): string[] {
  const out: string[] = []
  for (const tab of site.navigation) {
    walkGroups(tab.groups, pageHref, '', out)
  }
  return out
}

/** Walk a groups tree and return path-based keys of every group that has
 *  `expanded: true` set in config — these should be pre-opened in the
 *  sidebar on first render. */
export function collectDefaultExpandedKeys(groups: NavGroup[]): string[] {
  return collectExpandedGroups({ groups, parentPath: '', depth: 0 })
}

function collectExpandedGroups({
  groups,
  parentPath,
  depth,
}: {
  groups: NavGroup[]
  parentPath: string
  depth: number
}): string[] {
  return groups.flatMap((group) => {
    const key = parentPath ? `${parentPath}\0${group.group}` : group.group
    const isExpanded = group.expanded === true
      || (depth === 0 && Boolean(group.root) && group.expanded !== false)
    return [
      ...(isExpanded ? [key] : []),
      ...collectExpandedGroups({
        groups: group.pages.filter(isNavGroup),
        parentPath: key,
        depth: depth + 1,
      }),
    ]
  })
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
    const isGroupRoot = group.rootPage?.href === pageHref || group.root === pageHref
    if (groupContainsPage(group, pageHref)) {
      if (!isGroupRoot) out.push(key)
      matchedAny = true
    }
    const nestedGroups = group.pages.filter(isNavGroup)
    if (nestedGroups.length > 0) {
      walkGroups(nestedGroups, pageHref, key, out)
    }
  }
  return matchedAny
}

function groupContainsPage(group: NavGroup, pageHref: string): boolean {
  if (group.rootPage?.href === pageHref || group.root === pageHref) return true
  for (const entry of group.pages) {
    if (isNavPage(entry) && entry.href === pageHref) return true
    if (isNavGroup(entry) && groupContainsPage(entry, pageHref)) return true
  }
  return false
}

/** Collect all page hrefs belonging to a tab (for active tab matching). */
function collectTabPageHrefs(tab: NavTab): string[] {
  const hrefs: string[] = []
  function walkGroup(group: NavGroup) {
    if (group.rootPage) hrefs.push(group.rootPage.href)
    else if (group.root) hrefs.push(group.root)
    for (const entry of group.pages) {
      if (isNavPage(entry)) hrefs.push(entry.href)
      else if (isNavGroup(entry)) walkGroup(entry)
    }
  }
  for (const group of tab.groups) walkGroup(group)
  return hrefs
}

function versionOwnsHref(version: NavVersionItem, pageHref: string): boolean {
  return version.pageHrefs.includes(pageHref)
    || collectAllPageHrefs(version.navigation.tabs).includes(pageHref)
}

export function findActiveVersion(site: HolocronSiteData, pageHref: string | undefined): NavVersionItem | undefined {
  if (pageHref) {
    return site.switchers.versions.find((version) => versionOwnsHref(version, pageHref))
  }
  return site.switchers.versions.find((version) => version.default) ?? site.switchers.versions[0]
}

export function resolveActiveNavigationTabs(site: HolocronSiteData, pageHref: string | undefined): NavTab[] {
  const version = findActiveVersion(site, pageHref)
  if (version) return version.navigation.tabs

  if (pageHref) {
    const dropdown = site.switchers.dropdowns.find((item) =>
      item.navigation && item.navigation.tabs.some((tab) => collectTabPageHrefs(tab).includes(pageHref)),
    )
    if (dropdown?.navigation) return dropdown.navigation.tabs
  }

  return site.navigation
}

export function buildTabItems(site: HolocronSiteData, pageHref?: string): TabItem[] {
  const navTabs: TabItem[] = resolveActiveNavigationTabs(site, pageHref)
    .filter((t) => t.tab !== '' && !t.hidden)
    .map((t) => {
      const firstPage = findFirstPageInTab(t)
      const pageHrefs = collectTabPageHrefs(t)
      return {
        label: t.tab,
        href: firstPage?.href || '/',
        icon: t.icon,
        iconColor: t.iconColor,
        align: t.align,
        pageHrefs,
      }
    })
    // Filter out content tabs with no pages. This happens during deferred
    // provider processing: provider tabs have empty groups until the background
    // task finishes. Without this filter, multiple empty tabs would share
    // href '/' and the active-tab comparison would highlight all of them.
    .filter((t) => t.pageHrefs && t.pageHrefs.length > 0)

  // Only anchors explicitly placed in tabs go into the tab bar
  const tabAnchors: TabItem[] = site.config.navigation.anchors
    .filter((a) => !a.hidden && a.placement === 'tabs')
    .map((a) => ({ label: a.anchor, href: a.href, icon: a.icon, iconColor: a.iconColor }))

  // When tab-placed anchors exist but there are no explicit content tabs,
  // add an implicit "Docs" tab so the user can navigate back to docs content.
  if (tabAnchors.length > 0 && navTabs.length === 0) {
    const implicitTab = site.navigation.find((t) => t.tab === '')
    if (implicitTab) {
      const firstPage = findFirstPageInTab(implicitTab)
      navTabs.push({
        label: 'Docs',
        href: firstPage?.href || '/',
        icon: undefined,
      })
    }
  }

  return [...navTabs, ...tabAnchors]
}

/** Anchors placed in the left sidebar (default, or explicit placement === 'sidebar'). */
export function buildSidebarAnchors(site: HolocronSiteData): SidebarAnchor[] {
  return site.config.navigation.anchors
    .filter((a) => !a.hidden && a.placement !== 'tabs')
    .map((a) => ({ label: a.anchor, href: a.href, icon: a.icon, iconColor: a.iconColor }))
}

export function buildHeaderLinks(site: HolocronSiteData): HeaderLink[] {
  return site.config.navbar.links.map((link) => ({
    href: link.href,
    label: link.label,
    icon: link.icon,
    iconColor: link.iconColor,
    type: link.type,
  }))
}

export function buildSearchEntries(site: HolocronSiteData, pageHref?: string): SearchEntry[] {
  const entries: SearchEntry[] = []
  for (const tab of resolveActiveNavigationTabs(site, pageHref)) {
    collectEntriesFromGroups(tab.groups, '', entries)
  }
  return entries
}

function collectPageSearchEntries({
  page,
  groupPath,
  out,
}: {
  page: NavPage
  groupPath: string
  out: SearchEntry[]
}): void {
  if (!isVisibleNavPage(page)) return
  const frontmatter = page.frontmatter ?? {}
  out.push({
    label: frontmatter.sidebarTitle ?? page.title,
    href: page.href,
    groupPath,
    pageHref: null,
    searchText: [page.title, frontmatter.sidebarTitle, ...(frontmatter.keywords ?? [])]
      .filter(Boolean)
      .join(' '),
  })
  out.push(...page.headings.map((heading) => ({
    label: heading.text,
    href: `${page.href}#${heading.slug}`,
    groupPath,
    pageHref: page.href,
    searchText: heading.text,
  })))
}

function collectEntriesFromGroups(
  groups: NavGroup[],
  parentPath: string,
  out: SearchEntry[],
): void {
  for (const group of groups) {
    const key = parentPath ? `${parentPath}\0${group.group}` : group.group
    if (group.rootPage) {
      collectPageSearchEntries({ page: group.rootPage, groupPath: key, out })
    }
    for (const entry of group.pages) {
      if (isNavPage(entry)) {
        collectPageSearchEntries({ page: entry, groupPath: key, out })
      } else if (isNavGroup(entry)) {
        collectEntriesFromGroups([entry], key, out)
      }
    }
  }
}

function collectPageHrefsFromTabs(tabs: NavTab[], includeHidden: boolean): string[] {
  const hrefs: string[] = []
  for (const tab of tabs) {
    collectPagesFromGroupsFlat(tab.groups, hrefs, includeHidden)
  }
  return hrefs
}

function collectPagesFromGroupsFlat(groups: NavGroup[], out: string[], includeHidden: boolean): void {
  for (const group of groups) {
    if (group.rootPage && (includeHidden || isVisibleNavPage(group.rootPage))) {
      out.push(group.rootPage.href)
    } else if (!group.rootPage && group.root) {
      out.push(group.root)
    }
    for (const entry of group.pages) {
      if (isNavPage(entry)) {
        if (includeHidden || isVisibleNavPage(entry)) out.push(entry.href)
      } else if (isNavGroup(entry)) {
        collectPagesFromGroupsFlat([entry], out, includeHidden)
      }
    }
  }
}

export function buildVersionItems(site: HolocronSiteData): VersionSelectItem[] {
  return site.switchers.versions
    .filter((v) => !v.hidden)
    .map((v) => {
      const pageHrefs = collectPageHrefsFromTabs(v.navigation.tabs, true)
      const visiblePageHrefs = collectPageHrefsFromTabs(v.navigation.tabs, false)
      const firstHref = visiblePageHrefs[0] || pageHrefs[0] || '/'
      return {
        label: v.version,
        ...(v.tag && { tag: v.tag }),
        href: firstHref,
        pageHrefs,
      }
    })
}

function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//.test(href)
}

export function buildDropdownItems(site: HolocronSiteData): DropdownSelectItem[] {
  return site.switchers.dropdowns
    .filter((d) => !d.hidden)
    .map((d) => {
      if (d.href && !d.navigation) {
        return {
          label: d.dropdown,
          ...(d.icon && { icon: d.icon }),
          ...(d.iconColor && { iconColor: d.iconColor }),
          href: d.href,
          ...(isExternalHref(d.href) && { external: true }),
          pageHrefs: [],
        }
      }
      const pageHrefs = d.navigation ? collectPageHrefsFromTabs(d.navigation.tabs, true) : []
      const visiblePageHrefs = d.navigation ? collectPageHrefsFromTabs(d.navigation.tabs, false) : []
      const firstHref = visiblePageHrefs[0] || pageHrefs[0] || d.href || '/'
      return {
        label: d.dropdown,
        ...(d.icon && { icon: d.icon }),
        ...(d.iconColor && { iconColor: d.iconColor }),
        href: firstHref,
        pageHrefs,
      }
    })
}

export function resolveActiveTabHref(site: HolocronSiteData, pageHref: string | undefined): string | undefined {
  const tabs = buildTabItems(site, pageHref)
  if (!pageHref) return tabs[0]?.href
  // Match by page membership first (exact), then fall back to href prefix matching
  const memberMatch = tabs.find((t) => t.pageHrefs?.includes(pageHref))
  if (memberMatch) return memberMatch.href
  return tabs.find((t) => pageHref.startsWith(t.href) && t.href !== '/')?.href ?? tabs[0]?.href
}

export function resolveActiveVersionHref(site: HolocronSiteData, pageHref: string | undefined): string | undefined {
  const versionItems = buildVersionItems(site)
  if (!pageHref || versionItems.length === 0) return undefined
  const owner = site.switchers.versions.find((version) => versionOwnsHref(version, pageHref))
  if (owner) return versionItems.find((item) => item.label === owner.version)?.href
  return undefined
}

export function resolveActiveDropdownHref(site: HolocronSiteData, pageHref: string | undefined): string | undefined {
  const dropdownItems = buildDropdownItems(site)
  if (!pageHref || dropdownItems.length === 0) return undefined
  const match = dropdownItems.find((d) => !d.external && d.pageHrefs.includes(pageHref))
  return match?.href ?? dropdownItems.find((d) => !d.external)?.href
}

export function getResolvedLogo(site: HolocronSiteData): ResolvedLogo {
  return resolveLogo(site.config.logo, site.config.name)
}

function filterVisibleGroup(group: NavGroup): NavGroup | null {
  if (!hasVisibleSidebarEntries(group)) return null
  const pages: NavPageEntry[] = []
  for (const entry of group.pages) {
    if (isNavPage(entry)) {
      if (isVisibleNavPage(entry)) pages.push(entry)
      continue
    }
    const nextGroup = filterVisibleGroup(entry)
    if (nextGroup) pages.push(nextGroup)
  }
  const rootPage = group.rootPage && isVisibleNavPage(group.rootPage)
    ? group.rootPage
    : undefined
  return {
    ...group,
    root: group.rootPage ? (rootPage ? group.root : undefined) : group.root,
    rootPage,
    pages,
  }
}

function filterVisibleNavigation(navigation: Navigation): Navigation {
  return navigation
    .filter((tab) => !tab.hidden)
    .map((tab) => ({
      ...tab,
      groups: tab.groups.flatMap((group) => {
        const nextGroup = filterVisibleGroup(group)
        return nextGroup ? [nextGroup] : []
      }),
    }))
}

function filterVisibleVersion(version: NavVersionItem): NavVersionItem {
  return {
    ...version,
    navigation: {
      ...version.navigation,
      tabs: filterVisibleNavigation(version.navigation.tabs),
      anchors: version.navigation.anchors.filter((anchor) => !anchor.hidden),
    },
  }
}

function filterVisibleDropdown(dropdown: NavDropdownItem): NavDropdownItem {
  if (!dropdown.navigation) return dropdown
  return {
    ...dropdown,
    navigation: {
      ...dropdown.navigation,
      tabs: filterVisibleNavigation(dropdown.navigation.tabs),
      anchors: dropdown.navigation.anchors.filter((anchor) => !anchor.hidden),
    },
  }
}

export function buildVisibleSiteData(site: HolocronSiteData): HolocronSiteData {
  return {
    ...site,
    config: {
      ...site.config,
      navigation: {
        tabs: [],
        anchors: site.config.navigation.anchors.filter((anchor) => !anchor.hidden),
        versions: [],
        dropdowns: [],
      },
    },
    navigation: filterVisibleNavigation(site.navigation),
    switchers: {
      versions: site.switchers.versions.filter((version) => !version.hidden).map(filterVisibleVersion),
      dropdowns: site.switchers.dropdowns.filter((dropdown) => !dropdown.hidden).map(filterVisibleDropdown),
    },
  }
}
