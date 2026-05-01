/**
 * Shared navigation-tree enrichment for build-time and runtime Holocron paths.
 *
 * The caller supplies page-level enrichment; this module owns the common tree
 * walking for tabs, groups, versions, dropdowns, and icon serialization.
 */

import type {
  HolocronConfig,
  ConfigNavPageEntry,
  ConfigNavGroup,
  ConfigNavTab,
  ConfigVersionItem,
  ConfigDropdownItem,
} from '../config.ts'
import {
  type Navigation,
  type NavPage,
  type NavPageEntry,
  type NavGroup,
  type NavTab,
  type NavVersionItem,
  type NavDropdownItem,
  type NavIcon,
  slugToHref,
} from '../navigation.ts'
import { formatHolocronWarning, logger } from './logger.ts'

const SUPPORTED_ICON_LIBRARIES = new Set(['lucide', 'fontawesome', 'tabler'])

export type EnrichedNavigationData = {
  navigation: Navigation
  switchers: { versions: NavVersionItem[]; dropdowns: NavDropdownItem[] }
}

function serializeIcon({
  icon,
  defaultLibrary,
  context,
}: {
  icon: ConfigNavGroup['icon']
  defaultLibrary: HolocronConfig['icons']['library']
  context?: string
}): NavIcon | undefined {
  if (!icon) return undefined
  if (typeof icon === 'string') return icon
  const library = icon.library ?? defaultLibrary
  if (!SUPPORTED_ICON_LIBRARIES.has(library)) {
    logger.warn(formatHolocronWarning(
      `icon library "${library}" is not supported yet (supported: lucide, fontawesome, tabler). ` +
      `Icon "${icon.name}"${context ? ` in ${context}` : ''} will be ignored.`,
    ))
    return undefined
  }
  return {
    name: icon.name,
    ...(icon.library !== undefined && { library: icon.library }),
    ...(icon.style !== undefined && { style: icon.style }),
  }
}

function rootToHref(root: string | undefined): string | undefined {
  return root ? slugToHref(root) : undefined
}

export async function buildEnrichedNavigation({
  config,
  enrichPage,
}: {
  config: HolocronConfig
  enrichPage(slug: string): Promise<NavPage>
}): Promise<EnrichedNavigationData> {
  async function enrichPageEntry(entry: ConfigNavPageEntry): Promise<NavPageEntry> {
    if (typeof entry === 'string') {
      return enrichPage(entry)
    }
    return enrichGroup(entry)
  }

  async function enrichGroup(configGroup: ConfigNavGroup): Promise<NavGroup> {
    return {
      group: configGroup.group,
      icon: serializeIcon({
        icon: configGroup.icon,
        defaultLibrary: config.icons.library,
        context: `group "${configGroup.group}"`,
      }),
      hidden: configGroup.hidden,
      root: rootToHref(configGroup.root),
      tag: configGroup.tag,
      expanded: configGroup.expanded,
      pages: await Promise.all(configGroup.pages.map(enrichPageEntry)),
    }
  }

  async function enrichTab(configTab: ConfigNavTab): Promise<NavTab> {
    return {
      tab: configTab.tab,
      icon: serializeIcon({
        icon: configTab.icon,
        defaultLibrary: config.icons.library,
        context: `tab "${configTab.tab}"`,
      }),
      hidden: configTab.hidden,
      align: configTab.align,
      groups: await Promise.all(configTab.groups.map(enrichGroup)),
    }
  }

  async function enrichVersionItem(version: ConfigVersionItem): Promise<NavVersionItem> {
    const innerTabs = await Promise.all(version.navigation.tabs.map(enrichTab))
    return {
      version: version.version,
      ...(version.default !== undefined && { default: version.default }),
      ...(version.tag !== undefined && { tag: version.tag }),
      ...(version.hidden !== undefined && { hidden: version.hidden }),
      navigation: { tabs: innerTabs, anchors: version.navigation.anchors },
    }
  }

  async function enrichDropdownItem(dropdown: ConfigDropdownItem): Promise<NavDropdownItem> {
    if (!dropdown.navigation) {
      return {
        dropdown: dropdown.dropdown,
        ...(dropdown.icon !== undefined && {
          icon: serializeIcon({
            icon: dropdown.icon,
            defaultLibrary: config.icons.library,
            context: `dropdown "${dropdown.dropdown}"`,
          }),
        }),
        ...(dropdown.hidden !== undefined && { hidden: dropdown.hidden }),
        ...(dropdown.href !== undefined && { href: dropdown.href }),
      }
    }

    const innerTabs = await Promise.all(dropdown.navigation.tabs.map(enrichTab))
    return {
      dropdown: dropdown.dropdown,
      ...(dropdown.icon !== undefined && {
        icon: serializeIcon({
          icon: dropdown.icon,
          defaultLibrary: config.icons.library,
          context: `dropdown "${dropdown.dropdown}"`,
        }),
      }),
      ...(dropdown.hidden !== undefined && { hidden: dropdown.hidden }),
      ...(dropdown.href !== undefined && { href: dropdown.href }),
      navigation: { tabs: innerTabs, anchors: dropdown.navigation.anchors },
    }
  }

  const navigation = await Promise.all(config.navigation.tabs.map(enrichTab))
  const versions = await Promise.all(config.navigation.versions.map(enrichVersionItem))
  const dropdowns = await Promise.all(config.navigation.dropdowns.map(enrichDropdownItem))

  return {
    navigation,
    switchers: { versions, dropdowns },
  }
}
