/**
 * Cache sync engine — builds the enriched navigation tree from config + MDX files.
 *
 * All processing (MDX parsing, image resolution, sharp placeholders) happens
 * here at build time. The resulting NavPage.mdx field is the final content —
 * request-time rendering is just parse + render with zero I/O.
 *
 * Build flow:
 * 1. Read dist/holocron-cache.json + dist/holocron-images.json (previous build)
 * 2. Walk config navigation tree
 * 3. For each page: check MDX git SHA → cache hit skips everything
 * 4. Cache miss: parse MDX, resolve images, process with sharp, rewrite content
 * 5. Write updated caches
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { gitBlobSha } from './git-sha.ts'
import { processMdx, rewriteMdxImages, type ResolvedImage } from './mdx-processor.ts'
import { loadImageCache, saveImageCache, processImage } from './image-processor.ts'
import {
  type HolocronConfig,
  type ConfigNavTab,
  type ConfigNavGroup,
  type ConfigNavPageEntry,
  type ConfigVersionItem,
  type ConfigDropdownItem,
} from '../config.ts'
import {
  type Navigation,
  type NavigationWithSwitchers,
  type NavTab,
  type NavGroup,
  type NavIcon,
  type NavPage,
  type NavPageEntry,
  type NavVersionItem,
  type NavDropdownItem,
  isNavPage,
  isNavGroup,
  buildPageIndex,
} from '../navigation.ts'

/** Collect all NavPage objects from a single enriched tab (for validation). */
function collectAllPagesFromTab(tab: NavTab): NavPage[] {
  const pages: NavPage[] = []
  function walk(groups: NavGroup[]) {
    for (const g of groups) {
      for (const entry of g.pages) {
        if (isNavPage(entry)) pages.push(entry)
        else if (isNavGroup(entry)) walk([entry])
      }
    }
  }
  walk(tab.groups)
  return pages
}

const CACHE_FILENAME = 'holocron-cache.json'
const MDX_CACHE_FILENAME = 'holocron-mdx.json'

const require = createRequire(import.meta.url)
const { version: PACKAGE_VERSION } = require('../../package.json') as { version: string }
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'])

/** Libraries we can actually resolve at build time. */
const SUPPORTED_ICON_LIBRARIES = new Set(['lucide'])

/** Serialize a config icon into the enriched-tree shape. Preserves the
 *  structured form (`{ name, library, style }`) when users pass it so
 *  renderers can route to the correct icon library. Undefined fields
 *  are omitted to keep cache files + test snapshots clean.
 *  Object icons with unsupported libraries are stripped so they fall
 *  through to label rendering instead of silently rendering nothing. */
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

/** Resolve a group's `root` slug to an href using the same rule as pages. */
function rootToHref(root: string | undefined): string | undefined {
  if (!root) return undefined
  return slugToHref(root)
}

export type SyncResult = {
  navigation: Navigation
  /** Version/dropdown metadata with enriched inner navigation. */
  switchers: { versions: NavVersionItem[]; dropdowns: NavDropdownItem[] }
  /** Pre-processed MDX content keyed by page slug. Kept separate from the
   *  navigation tree so only the server bundle includes it — the client
   *  only receives the lightweight nav tree (titles, headings, slugs). */
  mdxContent: Record<string, string>
  parsedCount: number
  cachedCount: number
}

/**
 * Sync MDX files to the enriched navigation tree + MDX content map.
 * Image processing happens here at build time. The navigation tree is
 * lightweight (no MDX). MDX content is returned separately for server-only use.
 */
export async function syncNavigation({
  config,
  pagesDir,
  publicDir,
  projectRoot,
  distDir,
}: {
  config: HolocronConfig
  pagesDir: string
  publicDir: string
  projectRoot: string
  distDir: string
}): Promise<SyncResult> {
  // 1. Load caches from previous build
  const cachePath = path.join(distDir, CACHE_FILENAME)
  const mdxCachePath = path.join(distDir, MDX_CACHE_FILENAME)
  const oldNav = readCache(cachePath)
  const oldPages = oldNav ? buildPageIndex(oldNav) : new Map<string, NavPage>()
  const oldMdxContent = readMdxCache(mdxCachePath)
  const imageCache = loadImageCache({ distDir })

  const imageOutputDir = path.join(publicDir, '_holocron', 'images')

  let parsedCount = 0
  let cachedCount = 0
  const mdxContent: Record<string, string> = {}

  // 2. Enrich a single page slug
  async function enrichPage(slug: string): Promise<NavPage> {
    const mdxPath = resolveMdxPath(pagesDir, slug)
    if (!mdxPath) {
      throw new Error(`MDX file not found for page "${slug}". Looked in ${pagesDir}`)
    }
    const content = fs.readFileSync(mdxPath, 'utf-8')
    const sha = gitBlobSha(content)

    // Cache hit — MDX unchanged and we have cached MDX content
    const cached = oldPages.get(slug)
    const cachedMdx = oldMdxContent[slug]
    if (cached && cached.gitSha === sha && cachedMdx) {
      cachedCount++
      mdxContent[slug] = cachedMdx
      return cached
    }

    // Cache miss — full processing
    const processed = processMdx(content)
    parsedCount++

    const mdxDir = path.dirname(mdxPath)
    const resolvedImages = new Map<string, ResolvedImage>()

    // Resolve and process each image
    for (const src of processed.imageSrcs) {
      const resolved = resolveImagePath({ src, mdxDir, publicDir, projectRoot })
      if (!resolved) {
        continue
      }

      let meta
      try {
        meta = await processImage({ filePath: resolved.filePath, cache: imageCache })
      } catch (e) {
        console.error(`[holocron] warning: failed to process image ${src}`, e)
        continue
      }
      if (!meta) {
        continue
      }

      const publicSrc = (() => {
        if (resolved.needsCopy) {
          const destName = copyToPublic({ filePath: resolved.filePath, imageOutputDir })
          return `/_holocron/images/${destName}`
        }
        return src
      })()

      resolvedImages.set(src, { publicSrc, meta })
    }

    // Mutate mdast tree: rewrite image paths + inject dimensions, serialize back
    const finalMdx = resolvedImages.size > 0
      ? rewriteMdxImages(processed.mdast, resolvedImages)
      : content

    // Store MDX content separately from the nav tree
    mdxContent[slug] = finalMdx

    return {
      slug,
      href: slugToHref(slug),
      title: processed.title,
      description: processed.description,
      gitSha: sha,
      headings: processed.headings,
      // Icon comes from MDX frontmatter (Mintlify convention: `icon: rocket`)
      ...(processed.icon && { icon: processed.icon }),
    }
  }

  // 3. Walk config and enrich
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
      pages: await Promise.all(configGroup.pages.map((entry) => {
        return enrichPageEntry(entry)
      })),
    }
  }

  async function enrichTab(configTab: ConfigNavTab): Promise<NavTab> {
    return {
      tab: configTab.tab,
      icon: serializeIcon(configTab.icon, `tab "${configTab.tab}"`),
      hidden: configTab.hidden,
      align: configTab.align,
      groups: await Promise.all(configTab.groups.map((g) => {
        return enrichGroup(g)
      })),
    }
  }

  // 4. Build enriched navigation
  const navigation: Navigation = await Promise.all(
    config.navigation.tabs.map((tab) => {
      return enrichTab(tab)
    }),
  )

  async function enrichVersionItem(v: ConfigVersionItem): Promise<NavVersionItem> {
    const innerTabs = await Promise.all(v.navigation.tabs.map(enrichTab))
    return {
      version: v.version,
      ...(v.default !== undefined && { default: v.default }),
      ...(v.tag !== undefined && { tag: v.tag }),
      ...(v.hidden !== undefined && { hidden: v.hidden }),
      navigation: { tabs: innerTabs, anchors: v.navigation.anchors },
    }
  }

  async function enrichDropdownItem(d: ConfigDropdownItem): Promise<NavDropdownItem> {
    if (!d.navigation) {
      return {
        dropdown: d.dropdown,
        ...(d.icon !== undefined && { icon: serializeIcon(d.icon, `dropdown "${d.dropdown}"`) }),
        ...(d.hidden !== undefined && { hidden: d.hidden }),
        ...(d.href !== undefined && { href: d.href }),
      }
    }
    const innerTabs = await Promise.all(d.navigation.tabs.map(enrichTab))
    return {
      dropdown: d.dropdown,
      ...(d.icon !== undefined && { icon: serializeIcon(d.icon, `dropdown "${d.dropdown}"`) }),
      ...(d.hidden !== undefined && { hidden: d.hidden }),
      ...(d.href !== undefined && { href: d.href }),
      navigation: { tabs: innerTabs, anchors: d.navigation.anchors },
    }
  }

  const versions = await Promise.all(config.navigation.versions.map(enrichVersionItem))
  const dropdowns = await Promise.all(config.navigation.dropdowns.map(enrichDropdownItem))
  const switchers = { versions, dropdowns }

  // 4c. Validate no duplicate page hrefs across versions/dropdowns
  if (versions.length > 0 || dropdowns.length > 0) {
    const hrefOwners = new Map<string, string>()

    for (const v of versions) {
      for (const tab of v.navigation.tabs) {
        for (const page of collectAllPagesFromTab(tab)) {
          const existing = hrefOwners.get(page.href)
          if (existing) {
            throw new Error(
              `[holocron] duplicate page href "${page.href}" in version "${v.version}" and ${existing}. ` +
              `Each version/dropdown must use unique page paths (e.g. /v1/... and /v2/...).`,
            )
          }
          hrefOwners.set(page.href, `version "${v.version}"`)
        }
      }
    }
    for (const d of dropdowns) {
      if (!d.navigation) continue
      for (const tab of d.navigation.tabs) {
        for (const page of collectAllPagesFromTab(tab)) {
          const existing = hrefOwners.get(page.href)
          if (existing) {
            throw new Error(
              `[holocron] duplicate page href "${page.href}" in dropdown "${d.dropdown}" and ${existing}. ` +
              `Each version/dropdown must use unique page paths.`,
            )
          }
          hrefOwners.set(page.href, `dropdown "${d.dropdown}"`)
        }
      }
    }
  }

  // 5. Write caches
  writeCache(cachePath, navigation)
  writeMdxCache(mdxCachePath, mdxContent)
  saveImageCache({ distDir, cache: imageCache })

  return { navigation, switchers, mdxContent, parsedCount, cachedCount }
}

/* ── Image path resolution ───────────────────────────────────────────── */

type ResolvedImagePath = {
  filePath: string
  /** Whether the file needs to be copied to public/_holocron/images/ */
  needsCopy: boolean
}

/**
 * Resolve an image src to a filesystem path.
 *
 * - Relative (./img.png, ../x.jpg): resolve from MDX dir → needs copy
 * - Absolute (/images/x.png): try publicDir first (no copy), then projectRoot (needs copy)
 * - External (https://...): already filtered out by mdx-processor
 */
function resolveImagePath({
  src,
  mdxDir,
  publicDir,
  projectRoot,
}: {
  src: string
  mdxDir: string
  publicDir: string
  projectRoot: string
}): ResolvedImagePath | undefined {
  const isAbsolute = src.startsWith('/')

  if (!isAbsolute) {
    // Relative path — resolve from MDX file's directory
    const filePath = path.resolve(mdxDir, src)
    if (fs.existsSync(filePath) && isImageFile(filePath)) {
      return { filePath, needsCopy: true }
    }
    return undefined
  }

  // Absolute path — try publicDir first (no copy needed)
  const publicPath = path.join(publicDir, src)
  if (fs.existsSync(publicPath) && isImageFile(publicPath)) {
    return { filePath: publicPath, needsCopy: false }
  }

  // Fallback: try project root (some users use / to mean project root)
  const rootPath = path.join(projectRoot, src)
  if (fs.existsSync(rootPath) && isImageFile(rootPath)) {
    return { filePath: rootPath, needsCopy: true }
  }

  return undefined
}

function isImageFile(filePath: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

/** Copy image to public/_holocron/images/<hash>-<name>.ext, returns dest filename */
function copyToPublic({ filePath, imageOutputDir }: { filePath: string; imageOutputDir: string }): string {
  const buf = fs.readFileSync(filePath)
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 8)
  const ext = path.extname(filePath)
  const basename = path.basename(filePath, ext)
  const destName = `${hash}-${basename}${ext}`
  const destPath = path.join(imageOutputDir, destName)

  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(imageOutputDir, { recursive: true })
    fs.copyFileSync(filePath, destPath)
  }

  return destName
}

/* ── Cache I/O ──────────────────────────────────────────────────────── */

type NavCacheEnvelope = {
  version: string
  navigation: Navigation
}

function readCache(cachePath: string): Navigation | null {
  if (!fs.existsSync(cachePath)) {
    return null
  }
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    // Package-version envelope — reject caches from older versions so new
    // fields (e.g. page `icon`) aren't silently missing from cached NavPage
    // objects. Every publish naturally invalidates stale caches.
    if (raw && typeof raw === 'object' && raw.version === PACKAGE_VERSION) {
      return raw.navigation as Navigation
    }
    // Old format (bare array) or different version → discard.
    return null
  } catch {
    return null
  }
}

function writeCache(cachePath: string, nav: Navigation): void {
  const dir = path.dirname(cachePath)
  fs.mkdirSync(dir, { recursive: true })
  const envelope: NavCacheEnvelope = { version: PACKAGE_VERSION, navigation: nav }
  fs.writeFileSync(cachePath, JSON.stringify(envelope, null, 2))
}

function readMdxCache(cachePath: string): Record<string, string> {
  if (!fs.existsSync(cachePath)) {
    return {}
  }
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as Record<string, string>
  } catch {
    return {}
  }
}

function writeMdxCache(cachePath: string, content: Record<string, string>): void {
  const dir = path.dirname(cachePath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(cachePath, JSON.stringify(content))
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function resolveMdxPath(pagesDir: string, slug: string): string | undefined {
  for (const ext of ['.mdx', '.md']) {
    const filePath = path.join(pagesDir, slug + ext)
    if (fs.existsSync(filePath)) {
      return filePath
    }
  }
  return undefined
}

function slugToHref(slug: string): string {
  if (slug === 'index') {
    return '/'
  }
  const cleaned = slug.replace(/\/index$/, '')
  return `/${cleaned}`
}
