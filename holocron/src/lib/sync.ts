/**
 * Cache sync engine — builds the enriched navigation tree from config + MDX files.
 *
 * Build flow:
 * 1. Read dist/holocron-cache.json (previous enriched tree, if exists)
 * 2. Build a Map<slug, NavPage> from the old cache for SHA lookups
 * 3. Walk the config navigation tree
 * 4. For each page slug: read MDX file, compute git SHA
 *    - SHA matches cached → reuse NavPage (skip parsing)
 *    - SHA differs or new → parse MDX, create new NavPage
 * 5. Assemble enriched tree (same shape as config, strings → NavPage)
 * 6. Write to dist/holocron-cache.json
 *
 * The config defines structure (tabs, groups, ordering).
 * The cache only provides per-page metadata (title, headings, SHA).
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { gitBlobSha } from './git-sha.ts'
import { processMdx, rewriteImagePaths } from './mdx-processor.ts'
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

export type SyncResult = {
  navigation: Navigation
  /** Number of pages that were re-parsed (not cached) */
  parsedCount: number
  /** Number of pages reused from cache */
  cachedCount: number
}

/**
 * Sync MDX files to the enriched navigation tree.
 *
 * @param config - The parsed holocron config
 * @param pagesDir - Absolute path to the pages directory
 * @param distDir - Absolute path to the dist directory (for cache read/write)
 */
export function syncNavigation({
  config,
  pagesDir,
  publicDir,
  distDir,
}: {
  config: HolocronConfig
  pagesDir: string
  /** Absolute path to the public directory (for copying relative images) */
  publicDir: string
  distDir: string
}): SyncResult {
  // 1. Read existing cache
  const cachePath = path.join(distDir, CACHE_FILENAME)
  const oldNav = readCache(cachePath)
  const oldPages = oldNav ? buildPageIndex(oldNav) : new Map<string, NavPage>()

  let parsedCount = 0
  let cachedCount = 0

  // Image output dir inside public — namespaced to avoid collisions
  const imageOutputDir = path.join(publicDir, '_holocron', 'images')

  // 2. Enrich a single page slug
  function enrichPage(slug: string): NavPage {
    const mdxPath = resolveMdxPath(pagesDir, slug)
    if (!mdxPath) {
      throw new Error(`MDX file not found for page "${slug}". Looked in ${pagesDir}`)
    }
    const content = fs.readFileSync(mdxPath, 'utf-8')
    const sha = gitBlobSha(content)

    // Check cache
    const cached = oldPages.get(slug)
    if (cached && cached.gitSha === sha) {
      cachedCount++
      return cached
    }

    // Parse MDX
    const processed = processMdx(content)
    parsedCount++

    // Resolve relative images: copy to public/_holocron/images/, store
    // rewrites map on the NavPage. At render time, app-factory applies
    // the rewrites to the raw MDX before parsing so image srcs point to
    // their public copies. Uses content hash for dedup + cache busting.
    const imageRewrites: Record<string, string> = {}
    if (processed.relativeImages.length > 0) {
      const mdxDir = path.dirname(mdxPath)

      for (const relativeSrc of processed.relativeImages) {
        const sourcePath = path.resolve(mdxDir, relativeSrc)
        if (!fs.existsSync(sourcePath)) {
          continue
        }

        const imgBuf = fs.readFileSync(sourcePath)
        const hash = crypto.createHash('sha1').update(imgBuf).digest('hex').slice(0, 8)
        const ext = path.extname(relativeSrc)
        const basename = path.basename(relativeSrc, ext)
        const destName = `${hash}-${basename}${ext}`
        const destPath = path.join(imageOutputDir, destName)
        const publicSrc = `/_holocron/images/${destName}`

        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(imageOutputDir, { recursive: true })
          fs.copyFileSync(sourcePath, destPath)
        }

        imageRewrites[relativeSrc] = publicSrc
      }
    }

    const hasRewrites = Object.keys(imageRewrites).length > 0
    return {
      slug,
      href: slugToHref(slug),
      title: processed.title,
      description: processed.description,
      gitSha: sha,
      headings: processed.headings,
      ...(hasRewrites ? { imageRewrites } : {}),
    }
  }

  // 3. Walk config and enrich
  function enrichPageEntry(entry: ConfigNavPageEntry): NavPageEntry {
    if (typeof entry === 'string') {
      return enrichPage(entry)
    }
    // Nested group
    return enrichGroup(entry)
  }

  function enrichGroup(configGroup: ConfigNavGroup): NavGroup {
    return {
      group: configGroup.group,
      icon: configGroup.icon,
      pages: configGroup.pages.map((entry) => {
        return enrichPageEntry(entry)
      }),
    }
  }

  function enrichTab(configTab: ConfigNavTab): NavTab {
    return {
      tab: configTab.tab,
      groups: configTab.groups.map((g) => {
        return enrichGroup(g)
      }),
    }
  }

  // 4. Build enriched navigation — config.navigation.tabs is already
  // normalized by readConfig(), always an array of ConfigNavTab
  const navigation: Navigation = config.navigation.tabs.map((tab) => {
    return enrichTab(tab)
  })

  // 5. Write cache
  writeCache(cachePath, navigation)

  return { navigation, parsedCount, cachedCount }
}

/* ── Cache I/O ──────────────────────────────────────────────────────── */

function readCache(cachePath: string): Navigation | null {
  if (!fs.existsSync(cachePath)) {
    return null
  }
  try {
    const raw = fs.readFileSync(cachePath, 'utf-8')
    return JSON.parse(raw) as Navigation
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

/** Resolve an MDX file path from a page slug. Tries .mdx then .md */
function resolveMdxPath(pagesDir: string, slug: string): string | undefined {
  for (const ext of ['.mdx', '.md']) {
    const filePath = path.join(pagesDir, slug + ext)
    if (fs.existsSync(filePath)) {
      return filePath
    }
  }
  return undefined
}

/** Convert a page slug to a URL href. "index" → "/", "api/overview" → "/api/overview" */
function slugToHref(slug: string): string {
  if (slug === 'index') {
    return '/'
  }
  // Strip trailing /index
  const cleaned = slug.replace(/\/index$/, '')
  return `/${cleaned}`
}
