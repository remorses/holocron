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
import { gitBlobSha } from './git-sha.ts'
import { processMdx, rewriteMdxImages, type ResolvedImage } from './mdx-processor.ts'
import { loadImageCache, saveImageCache, processImage } from './image-processor.ts'
import {
  type HolocronConfig,
  type ConfigNavTab,
  type ConfigNavGroup,
  type ConfigNavPageEntry,
} from '../config.ts'
import {
  type Navigation,
  type NavTab,
  type NavGroup,
  type NavPage,
  type NavPageEntry,
  buildPageIndex,
} from '../navigation.ts'

const CACHE_FILENAME = 'holocron-cache.json'
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'])

export type SyncResult = {
  navigation: Navigation
  parsedCount: number
  cachedCount: number
}

/**
 * Sync MDX files to the enriched navigation tree. All image processing
 * happens here — the returned NavPage.mdx fields are final and ready
 * to render without any I/O.
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
  const oldNav = readCache(cachePath)
  const oldPages = oldNav ? buildPageIndex(oldNav) : new Map<string, NavPage>()
  const imageCache = loadImageCache({ distDir })

  const imageOutputDir = path.join(publicDir, '_holocron', 'images')

  let parsedCount = 0
  let cachedCount = 0

  // 2. Enrich a single page slug
  async function enrichPage(slug: string): Promise<NavPage> {
    const mdxPath = resolveMdxPath(pagesDir, slug)
    if (!mdxPath) {
      throw new Error(`MDX file not found for page "${slug}". Looked in ${pagesDir}`)
    }
    const content = fs.readFileSync(mdxPath, 'utf-8')
    const sha = gitBlobSha(content)

    // Cache hit — MDX unchanged AND has mdx field (not old cache format)
    const cached = oldPages.get(slug)
    if (cached && cached.gitSha === sha && cached.mdx) {
      cachedCount++
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

      // Process image (SHA-cached — skips sharp if unchanged).
      // Per-image try/catch so one bad image doesn't fail the whole build.
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

      // Determine final public src
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

    return {
      slug,
      href: slugToHref(slug),
      title: processed.title,
      description: processed.description,
      gitSha: sha,
      headings: processed.headings,
      mdx: finalMdx,
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
      icon: configGroup.icon,
      pages: await Promise.all(configGroup.pages.map((entry) => {
        return enrichPageEntry(entry)
      })),
    }
  }

  async function enrichTab(configTab: ConfigNavTab): Promise<NavTab> {
    return {
      tab: configTab.tab,
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

  // 5. Write caches
  writeCache(cachePath, navigation)
  saveImageCache({ distDir, cache: imageCache })

  return { navigation, parsedCount, cachedCount }
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

function readCache(cachePath: string): Navigation | null {
  if (!fs.existsSync(cachePath)) {
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as Navigation
  } catch {
    return null
  }
}

function writeCache(cachePath: string, nav: Navigation): void {
  const dir = path.dirname(cachePath)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(cachePath, JSON.stringify(nav, null, 2))
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
