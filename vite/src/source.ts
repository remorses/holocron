/**
 * Holocron source interface and generic site-cache resolution pipeline.
 */

import { createRequire } from 'node:module'
import { normalize } from './lib/normalize-config.ts'
import { processMdx } from './lib/mdx-processor.ts'
import { collectIconRefs } from './lib/collect-icons.ts'
import { resolveIconSvgs } from './lib/resolve-icons.ts'
import type { ConfigNavGroup, ConfigNavPageEntry, ConfigNavTab } from './config.ts'
import { gitBlobSha } from './lib/git-sha.ts'
import {
  buildPageIndex,
  slugToHref,
  type Navigation,
  type NavGroup,
  type NavIcon,
  type NavPage,
  type NavPageEntry,
  type NavTab,
} from './navigation.ts'
import {
  buildSiteData,
  findFile,
  type HolocronFileEntry,
  type HolocronSiteData,
} from './site-data.ts'

const require = createRequire(import.meta.url)
const { version: PACKAGE_VERSION } = require('../package.json') as { version: string }
const SUPPORTED_ICON_LIBRARIES = new Set(['lucide'])

export type HolocronSourceContext = {
  request?: Request
  root?: string
  dev: boolean
}

export type HolocronSource = {
  loadConfig(ctx: HolocronSourceContext): Promise<unknown | null>
  listFiles(ctx: HolocronSourceContext): Promise<HolocronFileEntry[]>
  loadFile(slug: string, ctx: HolocronSourceContext): Promise<string | null>
  loadCache?(ctx: HolocronSourceContext): Promise<HolocronSiteData | null>
  saveCache?(cache: HolocronSiteData, ctx: HolocronSourceContext): Promise<void>
}

export async function resolveSiteData(
  source: HolocronSource,
  ctx: HolocronSourceContext,
): Promise<HolocronSiteData | null> {
  const rawConfig = await source.loadConfig(ctx)
  if (!rawConfig || typeof rawConfig !== 'object') {
    return null
  }
  const config = normalize(rawConfig as Record<string, unknown>)
  const files = await source.listFiles(ctx)
  const configSha = gitBlobSha(JSON.stringify(config))
  const oldSite = await source.loadCache?.(ctx)

  if (oldSite && oldSite.version === PACKAGE_VERSION && oldSite.configSha === configSha && sameFiles(oldSite.files, files)) {
    return oldSite
  }

  const oldPages = oldSite ? buildPageIndex(oldSite.navigation) : new Map<string, NavPage>()
  let parsedCount = 0

  async function enrichPage(slug: string): Promise<NavPage> {
    const file = findFile(files, slug)
    if (!file) {
      throw new Error(`MDX file not found for page "${slug}" in source.listFiles()`)
    }
    const cached = oldPages.get(slug)
    if (cached && cached.gitSha === file.sha) {
      return cached
    }
    const content = await source.loadFile(slug, ctx)
    if (content == null) {
      throw new Error(`MDX content missing for page "${slug}" in source.loadFile()`)
    }
    const processed = processMdx(content)
    parsedCount++
    return {
      slug,
      href: slugToHref(slug),
      title: processed.title,
      description: processed.description,
      gitSha: file.sha,
      headings: processed.headings,
      ...(processed.icon && { icon: processed.icon }),
    }
  }

  async function enrichPageEntry(entry: ConfigNavPageEntry): Promise<NavPageEntry> {
    if (typeof entry === 'string') {
      return enrichPage(entry)
    }
    return enrichGroup(entry)
  }

  async function enrichGroup(configGroup: ConfigNavGroup): Promise<NavGroup> {
    return {
      group: configGroup.group,
      icon: serializeIcon(configGroup.icon, `group "${configGroup.group}"`),
      hidden: configGroup.hidden,
      root: rootToHref(configGroup.root),
      tag: configGroup.tag,
      expanded: configGroup.expanded,
      pages: await Promise.all(configGroup.pages.map((entry) => enrichPageEntry(entry))),
    }
  }

  async function enrichTab(configTab: ConfigNavTab): Promise<NavTab> {
    return {
      tab: configTab.tab,
      icon: serializeIcon(configTab.icon, `tab "${configTab.tab}"`),
      hidden: configTab.hidden,
      align: configTab.align,
      groups: await Promise.all(configTab.groups.map((group) => enrichGroup(group))),
    }
  }

  const navigation: Navigation = await Promise.all(config.navigation.tabs.map((tab) => enrichTab(tab)))
  const icons = resolveIconSvgs(collectIconRefs({ config, navigation }))
  const site = buildSiteData({ version: PACKAGE_VERSION, config, navigation, files, icons, configSha })

  if (!oldSite || oldSite.configSha !== configSha || !sameFiles(oldSite.files, files) || parsedCount > 0) {
    await source.saveCache?.(site, ctx)
  }

  return site
}

function sameFiles(a: HolocronFileEntry[], b: HolocronFileEntry[]): boolean {
  if (a.length !== b.length) return false
  const bMap = new Map(b.map((file) => [file.slug, file.sha]))
  for (const file of a) {
    if (bMap.get(file.slug) !== file.sha) return false
  }
  return true
}

function serializeIcon(icon: ConfigNavGroup['icon'], context?: string): NavIcon | undefined {
  if (!icon) return undefined
  if (typeof icon === 'string') return icon
  const library = icon.library ?? 'lucide'
  if (!SUPPORTED_ICON_LIBRARIES.has(library)) {
    console.warn(
      `[holocron] icon library "${library}" is not supported yet (only lucide). ` +
      `Icon "${icon.name}"${context ? ` in ${context}` : ''} will be ignored.`,
    )
    return undefined
  }
  return {
    name: icon.name,
    ...(icon.library !== undefined && { library: icon.library }),
    ...(icon.style !== undefined && { style: icon.style }),
  }
}

function rootToHref(root: string | undefined): string | undefined {
  if (!root) return undefined
  return slugToHref(root)
}

export { PACKAGE_VERSION }
