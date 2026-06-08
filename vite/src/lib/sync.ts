/**
 * Cache sync engine — builds the enriched navigation tree from config + MDX files.
 *
 * All processing (MDX parsing, image resolution, sharp placeholders) happens
 * here at build time. The resulting NavPage.mdx field is the final content;
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
import { processMdx, rewriteMdxImages, isNonLocalAssetSrc, type ResolvedImage, type InternalLink, type AssetRef, type ProcessMdxOptions } from './mdx-processor.ts'
import { remarkInlineImports, buildSplicedNodes, type InlineImportEntry } from './remark-inline-imports.ts'
import { visit } from 'unist-util-visit'
import { loadImageCache, saveImageCache, processImage, processImageBuffer } from './image-processor.ts'
import { PACKAGE_VERSION } from './package-version.ts'
import { buildEnrichedNavigation } from './enrich-navigation.ts'
import type { IconRef } from './collect-icons.ts'
import {
  type HolocronConfig,
} from '../config.ts'
import { processVirtualTabs } from './virtual-tab-provider.ts'
import { virtualPageDir } from './virtual-page-mdx.ts'
import { openapiProvider } from './openapi/provider.ts'
import { changelogProvider } from './changelog/provider.ts'
import { mcpProvider } from './mcp/provider.ts'
import { colors, formatHolocronError, formatHolocronWarning, logger, logMdxError, HolocronMdxParseError } from './logger.ts'
import { parseFrontmatterObject } from './frontmatter.ts'
import { MdastToJsx, type SafeMdxError } from 'safe-mdx'
import { extractImports, type EagerModules } from 'safe-mdx/parse'
import type { Root } from 'mdast'
import {
  type Navigation,
  type NavTab,
  type NavGroup,
  type NavPage,
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

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.avif', '.ico'])
const MEDIA_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mp3', '.wav', '.m4a', '.mov', '.avi', '.mkv', '.flac', '.aac'])
/** All local asset extensions (images + media) for broken-asset validation. */
const LOCAL_ASSET_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...MEDIA_EXTENSIONS])

function redirectSourceToSlug(source: string): string | undefined {
  if (source.includes(':') || source.includes('*')) return undefined
  const clean = source.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/'
  if (!clean.startsWith('/')) return undefined
  return clean === '/' ? 'index' : clean.slice(1)
}

function titleFromSlug(slug: string): string {
  const segment = slug.split('/').pop() || slug
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}

function createRedirectBackedPage(slug: string): NavPage {
  const title = titleFromSlug(slug)
  return {
    slug,
    href: slugToHref(slug),
    title,
    gitSha: `redirect:${slug}`,
    headings: [],
    frontmatter: { title },
  }
}

export type SyncResult = {
  navigation: Navigation
  /** Version/dropdown metadata with enriched inner navigation. */
  switchers: { versions: NavVersionItem[]; dropdowns: NavDropdownItem[] }
  /** MDX parse errors keyed by page slug. Pages with parse errors are still
   *  in the navigation tree (so they show in the sidebar) but their MDX
   *  content is missing from `mdxContent`. The render layer uses this to
   *  show an error page instead of a 404. */
  mdxParseErrors: Record<string, HolocronMdxParseError>
  /** Pre-processed MDX content keyed by page slug. Kept separate from the
   *  navigation tree so only the server bundle includes it — the client
   *  only receives the lightweight nav tree (titles, headings, slugs). */
  mdxContent: Record<string, string>
  /** Canonical icon refs used by each page body/frontmatter MDX. */
  pageIconRefs: Record<string, IconRef[]>
  /** Resolved import entries per page slug. Each entry has a `moduleKey`
   *  (matching safe-mdx's glob key format, e.g. './snippets/greeting.tsx')
   *  and an `absPath` (absolute filesystem path for the import() call).
   *  Built fresh on every sync from cached importSources + filesystem probing. */
  pageImports: Record<string, ResolvedImport[]>
  /** Absolute paths of local image files referenced by imported .md/.mdx
   *  files. Used by the dev server to watch for image changes and trigger
   *  re-sync so updated dimensions/placeholders are picked up. */
  importedImageDepPaths: string[]
  /** Absolute paths of local files read by virtual tab providers (e.g. OpenAPI
   *  spec files). Watched by the dev server so edits trigger re-sync + HMR. */
  providerWatchPaths: string[]
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
  logParseErrors = true,
  deferProviders = false,
}: {
  config: HolocronConfig
  pagesDir: string
  publicDir: string
  projectRoot: string
  distDir: string
  logParseErrors?: boolean
  /** When true, skip virtual tab providers (OpenAPI, changelog, MCP) during
   *  sync. Provider tabs remain in the navigation but with empty groups.
   *  The caller runs `processDeferredProviders()` in the background and
   *  triggers HMR when providers finish. Production builds should always
   *  use false (the default). */
  deferProviders?: boolean
}): Promise<SyncResult> {
  // 1. Load caches from previous build
  const cachePath = path.join(distDir, CACHE_FILENAME)
  const mdxCachePath = path.join(distDir, MDX_CACHE_FILENAME)
  const oldNav = readCache(cachePath)
  const oldPages = oldNav ? buildPageIndex(oldNav) : new Map<string, NavPage>()
  const oldMdxCache = readMdxCache(mdxCachePath)
  const oldMdxContent = oldMdxCache.content
  const oldPageIconRefs = oldMdxCache.pageIconRefs
  const oldPageImportSources = oldMdxCache.pageImportSources
  const oldPageInternalLinks = oldMdxCache.pageInternalLinks
  const oldPageAssetRefs = oldMdxCache.pageAssetRefs
  const imageCache = loadImageCache({ distDir })

  const imageOutputDir = path.join(publicDir, '_holocron', 'images')

  let parsedCount = 0
  let cachedCount = 0
  const mdxContent: Record<string, string> = {}
  const pageIconRefs: Record<string, IconRef[]> = {}
  /** Raw import sources per page (cached in holocron-mdx.json) */
  const pageImportSources: Record<string, string[]> = {}
  /** Resolved imports per page (computed fresh every sync from pageImportSources + filesystem) */
  const pageImports: Record<string, ResolvedImport[]> = {}
  /** Internal links per page slug (for broken-link validation after nav is built) */
  const pageInternalLinks: Record<string, InternalLink[]> = {}
  /** Local asset references per page slug (for broken-asset validation) */
  const pageAssetRefs: Record<string, AssetRef[]> = {}
  /** Image files referenced by imported .md/.mdx (for HMR watching) */
  const allImportedImageDepPaths = new Set<string>()
  const mdxContentErrors = new Set<string>()
  const mdxParseErrors: Record<string, HolocronMdxParseError> = {}
  const redirectBackedPageSlugs = new Set(
    config.redirects
      .map((rule) => redirectSourceToSlug(rule.source))
      .filter(Boolean),
  )

  const pageEnrichmentCache = new Map<string, Promise<NavPage>>()

  // 2. Enrich a single page slug
  function enrichPage(slug: string): Promise<NavPage> {
    const cached = pageEnrichmentCache.get(slug)
    if (cached) {
      return cached
    }
    const promise = enrichPageUncached(slug)
    pageEnrichmentCache.set(slug, promise)
    return promise
  }

  async function enrichPageUncached(slug: string): Promise<NavPage> {
    const pageSource = slug === 'index' ? '/' : `/${slug}`

    // Virtual pages (e.g. from OpenAPI, changelog) already have content in mdxContent
    const virtualMdx = mdxContent[slug]
    if (virtualMdx) {
      // Virtual pages with .md/.mdx imports (e.g. changelog initialContent)
      // go through the same inline import pipeline as real pages. The virtual
      // page's directory is computed from pagesDir + slug dirname.
      const virtualMdxDir = virtualPageDir(pagesDir, slug)
      const inlineResult = resolveInlineImports({ content: virtualMdx, mdxDir: virtualMdxDir, pagesDir, projectRoot, publicDir })
      const inlineImportMap = inlineResult.imports
      for (const p of inlineResult.imageDepPaths) allImportedImageDepPaths.add(p)

      const processMdxOptions: ProcessMdxOptions = {
        slug,
        ...(inlineImportMap.size > 0 && {
          normalizeMdxOptions: { prependPlugins: [[remarkInlineImports, { resolvedImports: inlineImportMap }]] },
        }),
      }

      const processed = processMdx(virtualMdx, config.icons.library, pageSource, processMdxOptions)
      if (processed instanceof Error) return handleParseError(slug, processed)
      // Store the NORMALIZED content back so the served MDX has Holocron's
      // authoring sugar applied (e.g. <CodeGroup> → <Tabs>/<Tab> for the
      // multi-example aside). The render layer parses this with mdxParse, not
      // normalizeMdx, so the rewrite must happen here.
      mdxContent[slug] = processed.normalizedContent
      pageIconRefs[slug] = processed.iconRefs
      if (processed.internalLinks.length > 0) pageInternalLinks[slug] = processed.internalLinks
      if (processed.assetRefs.length > 0) pageAssetRefs[slug] = processed.assetRefs
      // Resolve imports (.tsx components) so virtual:holocron-modules has them.
      if (processed.importSources.length > 0) {
        pageImportSources[slug] = processed.importSources
        pageImports[slug] = resolveImportSources({ importSources: processed.importSources, slug, pagesDir, projectRoot })
      }
      const errors = validateAndReportMdx({
        markdown: processed.normalizedContent,
        mdast: processed.mdast,
        modules: createPlaceholderModules(pageImports[slug] ?? []),
        baseUrl: getMdxBaseUrl({ slug, pagesDir, projectRoot }),
        source: pageSource,
      })
      if (errors.length > 0) {
        mdxContentErrors.add(slug)
      }
      return {
        slug,
        href: slugToHref(slug),
        title: processed.title,
        description: processed.description,
        gitSha: `virtual:${slug}`,
        headings: processed.headings,
        frontmatter: processed.frontmatter,
      }
    }

    const mdxPath = resolveMdxPath(pagesDir, slug)
    if (!mdxPath) {
      if (redirectBackedPageSlugs.has(slug)) {
        return createRedirectBackedPage(slug)
      }
      throw new Error(`MDX file not found for page "${slug}". Looked in ${pagesDir}`)
    }
    const content = fs.readFileSync(mdxPath, 'utf-8')
    const mdxDir = path.dirname(mdxPath)

    // Resolve .md/.mdx imports early so we can incorporate their SHAs
    // into the cache key. This makes cache hits sensitive to imported
    // file changes, not just the page's own content.
    const inlineResult = resolveInlineImports({ content, mdxDir, pagesDir, projectRoot, publicDir })
    const inlineImportMap = inlineResult.imports
    for (const p of inlineResult.imageDepPaths) allImportedImageDepPaths.add(p)

    // Resolve og:image / twitter:image frontmatter paths early so their
    // file hashes are part of the cache key. Without this, editing the OG
    // image file without touching the MDX would be a false cache hit.
    const rawFrontmatter = parseFrontmatterObject(content)
    const frontmatterImageDeps: string[] = []
    for (const fmKey of ['og:image', 'twitter:image'] as const) {
      const src = rawFrontmatter[fmKey]
      if (!src || typeof src !== 'string' || isNonLocalAssetSrc(src)) continue
      const resolved = resolveImagePath({ src, mdxDir, publicDir, projectRoot })
      if (resolved) {
        frontmatterImageDeps.push(resolved.filePath)
        allImportedImageDepPaths.add(resolved.filePath)
      } else {
        logger.warn(formatHolocronWarning(`frontmatter ${fmKey} references "${src}" but the file was not found`))
      }
    }

    let sha = gitBlobSha(content)
    const shaParts: string[] = []
    if (inlineImportMap.size > 0) {
      // Combine page SHA with imported file SHAs + image dep SHAs so
      // changes to imported files OR their referenced images invalidate
      // the cache.
      shaParts.push(
        ...[...inlineImportMap.values()]
          .map((e) => `${e.absPath}:${gitBlobSha(e.content)}`),
      )
      for (const imgPath of inlineResult.imageDepPaths) {
        try {
          shaParts.push(`img:${imgPath}:${crypto.createHash('sha1').update(fs.readFileSync(imgPath)).digest('hex')}`)
        } catch { /* ignore missing files */ }
      }
    }
    for (const imgPath of frontmatterImageDeps) {
      try {
        shaParts.push(`fm-img:${imgPath}:${crypto.createHash('sha1').update(fs.readFileSync(imgPath)).digest('hex')}`)
      } catch { /* ignore missing files */ }
    }
    if (shaParts.length > 0) {
      sha = gitBlobSha(sha + '\n' + shaParts.sort().join('\n'))
    }

    // Cache hit — MDX unchanged and all imported files unchanged
    const cached = oldPages.get(slug)
    const cachedMdx = oldMdxContent[slug]
    if (cached && cached.gitSha === sha && cachedMdx) {
      cachedCount++
      mdxContent[slug] = cachedMdx
      // Cached MDX entries were validated before being written. Do not
      // validate again here, or cache hits would reparse every page on sync.
      if (oldPageIconRefs[slug]) {
        pageIconRefs[slug] = oldPageIconRefs[slug]
      } else {
        const reprocessed = processMdx(cachedMdx, config.icons.library, pageSource, { slug })
        if (reprocessed instanceof Error) return handleParseError(slug, reprocessed)
        pageIconRefs[slug] = reprocessed.iconRefs
      }
      // Restore cached internal links for broken-link validation
      const cachedLinks = oldPageInternalLinks[slug]
      if (cachedLinks && cachedLinks.length > 0) pageInternalLinks[slug] = cachedLinks
      // Restore cached asset refs for broken-asset validation
      const cachedAssets = oldPageAssetRefs[slug]
      if (cachedAssets && cachedAssets.length > 0) pageAssetRefs[slug] = cachedAssets
      // Restore cached raw import sources, then resolve fresh against the
      // current filesystem. This ensures newly-created files are picked up
      // without re-parsing the MDX.
      const cachedSources = oldPageImportSources[slug] ?? []
      pageImportSources[slug] = cachedSources
      pageImports[slug] = resolveImportSources({ importSources: cachedSources, slug, pagesDir, projectRoot })
      return cached
    }

    // Cache miss — full processing.
    // inlineImportMap was already resolved above (for cache key computation).
    const processMdxOptions: ProcessMdxOptions = {
      slug,
      ...(inlineImportMap.size > 0 && {
        normalizeMdxOptions: {
          prependPlugins: [[remarkInlineImports, { resolvedImports: inlineImportMap }]],
        },
      }),
    }

    const processed = processMdx(content, config.icons.library, pageSource, processMdxOptions)
    if (processed instanceof Error) return handleParseError(slug, processed)
    parsedCount++

    let finalMdx: string
    const mergedAssetRefs = [...processed.assetRefs]

    // Resolve og:image / twitter:image frontmatter paths synchronously in
    // both deferred and blocking modes. copyToPublic is just a file copy
    // (no sharp), so it's fast and keeps frontmatter URLs correct in the
    // navigation cache written at the end of sync.
    for (const fmKey of ['og:image', 'twitter:image'] as const) {
      const src = processed.frontmatter[fmKey]
      if (!src || typeof src !== 'string' || isNonLocalAssetSrc(src)) continue
      if (!mergedAssetRefs.some((r) => r.src === src)) {
        mergedAssetRefs.push({ src, line: undefined })
      }
      const resolved = resolveImagePath({ src, mdxDir, publicDir, projectRoot })
      if (resolved?.needsCopy) {
        processed.frontmatter[fmKey] = `/_holocron/images/${copyToPublic({ filePath: resolved.filePath, imageOutputDir })}`
      }
    }

    const resolvedImages = await resolveAndProcessImages({
      imageSrcs: processed.imageSrcs,
      mdxDir,
      publicDir,
      projectRoot,
      imageCache,
      imageOutputDir,
    })

    // Mutate mdast tree: rewrite image paths + inject dimensions, serialize back
    finalMdx = resolvedImages.size > 0
      ? rewriteMdxImages(processed.mdast, resolvedImages)
      : processed.normalizedContent

    pageIconRefs[slug] = processed.iconRefs
    if (processed.internalLinks.length > 0) pageInternalLinks[slug] = processed.internalLinks
    if (mergedAssetRefs.length > 0) pageAssetRefs[slug] = mergedAssetRefs
    // Cache raw import sources (for future cache hits) and resolve fresh
    pageImportSources[slug] = processed.importSources
    pageImports[slug] = resolveImportSources({ importSources: processed.importSources, slug, pagesDir, projectRoot })
    const renderErrors = validateAndReportMdx({
      markdown: finalMdx,
      mdast: processed.mdast,
      modules: createPlaceholderModules(pageImports[slug] ?? []),
      baseUrl: getMdxBaseUrl({ slug, pagesDir, projectRoot }),
      source: slug === 'index' ? '/' : `/${slug}`,
    })
    // Store MDX content separately from the nav tree
    mdxContent[slug] = finalMdx
    if (renderErrors.length > 0) {
      mdxContentErrors.add(slug)
    }

    return {
      slug,
      href: slugToHref(slug),
      title: processed.title,
      description: processed.description,
      gitSha: sha,
      headings: processed.headings,
      // Icon comes from MDX frontmatter (Mintlify convention: `icon: rocket`)
      ...(processed.icon && { icon: processed.icon }),
      frontmatter: processed.frontmatter,
    }
  }

  /** Handle a parse error: log it, store it for the error overlay, and return a
   *  stub NavPage so the rest of the navigation tree can still be built. */
  function handleParseError(slug: string, err: HolocronMdxParseError): NavPage {
    if (logParseErrors) logger.error(formatHolocronError(`failed to parse ${err.source ?? slug}\n\n${err.reason}\n\n${err.codeFrame}\n`))
    mdxContentErrors.add(slug)
    mdxParseErrors[slug] = err
    return {
      slug,
      href: slugToHref(slug),
      title: titleFromSlug(slug),
      gitSha: 'error',
      headings: [],
      frontmatter: {},
    }
  }

  // 2b. Process virtual tabs (OpenAPI, etc.) — populate groups + inject virtual MDX pages.
  // In dev mode with deferProviders, skip this step so the sync returns fast.
  // The caller runs processDeferredProviders() in the background to fill in
  // provider pages and trigger HMR when ready.
  const providers = [openapiProvider, changelogProvider, mcpProvider]
  let providerWatchPaths: string[] = []
  if (!deferProviders) {
    const result = await processVirtualTabs({
      config,
      projectRoot,
      pagesDir,
      mdxContent,
      providers,
    })
    providerWatchPaths = result.watchPaths
  } else {
    // Empty out provider-claimed tabs so enrichment doesn't encounter
    // provider-specific entries like "..." or "GET /users" that only
    // the provider knows how to resolve. Snapshot authored groups first
    // so processDeferredProviders can restore them later.
    for (const tab of config.navigation.tabs) {
      if (providers.some((p) => p.claims(tab))) {
        if (!tab.authoredGroups) {
          Object.defineProperty(tab, 'authoredGroups', {
            value: structuredClone(tab.groups),
            enumerable: false,
            writable: true,
            configurable: true,
          })
        }
        tab.groups = []
      }
    }
  }

  // 3. Walk config and enrich the shared navigation tree.
  const { navigation, switchers } = await buildEnrichedNavigation({ config, enrichPage })
  const { versions, dropdowns } = switchers

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

  // 4d. Validate internal links — warn about links pointing to non-existent pages.
  const brokenLinkStats = validateInternalLinks({
    navigation,
    pageInternalLinks,
    redirects: config.redirects,
    knownPaths: config.knownPaths,
  })

  // 4e. Validate local asset references — warn about images/media pointing to non-existent files.
  const brokenAssetStats = validateLocalAssets({
    pageAssetRefs,
    pagesDir,
    publicDir,
    projectRoot,
  })

  // 5. Write caches.
  writeCache(cachePath, navigation)
  writeMdxCache(mdxCachePath, {
    content: filterErroredMdxContent({ content: mdxContent, mdxContentErrors }),
    pageIconRefs,
    pageImportSources,
    pageInternalLinks,
    pageAssetRefs,
  })
  saveImageCache({ distDir, cache: imageCache })

  // 6. Log build summary tips for broken links and MDX errors so agents
  //    and users see actionable next steps at the end of the build output.
  //    mdxContentErrors includes both parse errors and safe-mdx render errors.
  if (brokenLinkStats.brokenLinkCount > 0) {
    logger.warn('')
    logger.warn(formatHolocronWarning(
      `found ${colors.yellow(String(brokenLinkStats.brokenLinkCount))} invalid internal link${brokenLinkStats.brokenLinkCount === 1 ? '' : 's'} across ${colors.yellow(String(brokenLinkStats.affectedPageCount))} page${brokenLinkStats.affectedPageCount === 1 ? '' : 's'}. ` +
      `Fix them or add paths to ${colors.cyan('knownPaths')} in docs.json. See ${colors.cyan('https://holocron.so/docs/create/broken-links')}`,
    ))
  }
  if (brokenAssetStats.brokenAssetCount > 0) {
    logger.warn('')
    logger.warn(formatHolocronWarning(
      `found ${colors.yellow(String(brokenAssetStats.brokenAssetCount))} broken asset reference${brokenAssetStats.brokenAssetCount === 1 ? '' : 's'} across ${colors.yellow(String(brokenAssetStats.affectedPageCount))} page${brokenAssetStats.affectedPageCount === 1 ? '' : 's'}. ` +
      `Check that image, video, and audio file paths are correct.`,
    ))
  }
  if (mdxContentErrors.size > 0) {
    logger.warn('')
    logger.warn(formatHolocronWarning(
      `${colors.yellow(String(mdxContentErrors.size))} page${mdxContentErrors.size === 1 ? '' : 's'} with MDX errors. ` +
      `Fix the syntax issues in the pages listed above.`,
    ))
  }

  return {
    navigation, switchers, mdxContent, mdxParseErrors, pageIconRefs, pageImports,
    importedImageDepPaths: [...allImportedImageDepPaths], providerWatchPaths,
    parsedCount, cachedCount,
  }
}

/* ── Image processing helper ─────────────────────────────────────────── */

/**
 * Resolve and process all images in an MDX file.
 *
 * For each image src: resolves to a filesystem path, processes with sharp
 * (dimensions + placeholder), copies to public if needed, and returns a
 * map of original src → { publicSrc, meta }.
 */
async function resolveAndProcessImages({
  imageSrcs,
  mdxDir,
  publicDir,
  projectRoot,
  imageCache,
  imageOutputDir,
}: {
  imageSrcs: string[]
  mdxDir: string
  publicDir: string
  projectRoot: string
  imageCache: ReturnType<typeof loadImageCache>
  imageOutputDir: string
}): Promise<Map<string, ResolvedImage>> {
  const resolvedImages = new Map<string, ResolvedImage>()
  for (const src of imageSrcs) {
    let meta
    try {
      if (src.startsWith('http://') || src.startsWith('https://')) {
        const remoteBuffer = await fetchRemoteImageBuffer(src)
        if (!remoteBuffer) continue
        meta = await processImageBuffer({ buffer: remoteBuffer, cache: imageCache })
        if (meta) resolvedImages.set(src, { publicSrc: src, meta })
        continue
      }

      const resolved = resolveImagePath({ src, mdxDir, publicDir, projectRoot })
      if (!resolved) continue

      meta = await processImage({ filePath: resolved.filePath, cache: imageCache })
      if (!meta) continue

      const publicSrc = resolved.needsCopy
        ? `/_holocron/images/${copyToPublic({ filePath: resolved.filePath, imageOutputDir })}`
        : src

      resolvedImages.set(src, { publicSrc, meta })
    } catch (e) {
      logger.warn(formatHolocronWarning(
        `failed to process image ${src}: ${e instanceof Error ? e.message : String(e)}`,
      ))
      continue
    }
  }
  return resolvedImages
}

/* ── Deferred provider processing ────────────────────────────────────── */

/**
 * Run virtual tab providers (OpenAPI, changelog, MCP) in the background
 * and patch the live syncResult when done.
 *
 * Called by the dev server after the fast initial sync returns. Runs
 * processVirtualTabs(), enriches the generated virtual pages, rebuilds
 * the navigation tree, and patches syncResult in place. The caller then
 * invalidates virtual modules and sends `rsc:update`.
 */
export async function processDeferredProviders({
  config,
  projectRoot,
  pagesDir,
  publicDir,
  distDir,
  syncResult,
  signal,
}: {
  config: HolocronConfig
  projectRoot: string
  pagesDir: string
  publicDir: string
  distDir: string
  syncResult: SyncResult
  signal?: AbortSignal
}): Promise<{ watchPaths: string[] }> {
  // Work against a clone so provider mutations (tab.groups, mdxContent)
  // don't affect the live syncResult if this run is aborted mid-flight.
  // structuredClone drops non-enumerable properties, so we manually copy
  // authoredGroups (the snapshot of original selective-mode groups) onto
  // the cloned tabs so processVirtualTabs can restore them correctly.
  const clonedConfig = structuredClone(config)
  for (let i = 0; i < config.navigation.tabs.length; i++) {
    const authored = (config.navigation.tabs[i] as any)?.authoredGroups
    if (authored && clonedConfig.navigation.tabs[i]) {
      Object.defineProperty(clonedConfig.navigation.tabs[i], 'authoredGroups', {
        value: structuredClone(authored),
        enumerable: false,
        writable: true,
        configurable: true,
      })
    }
  }
  const localMdxContent: Record<string, string> = { ...syncResult.mdxContent }

  const { watchPaths: providerWatchPaths } = await processVirtualTabs({
    config: clonedConfig,
    projectRoot,
    pagesDir,
    mdxContent: localMdxContent,
    providers: [openapiProvider, changelogProvider, mcpProvider],
  })

  if (signal?.aborted) return { watchPaths: [] }

  // Re-enrich the navigation tree now that provider tabs have groups + virtual pages.
  // For non-virtual pages, reuse the already-enriched NavPage from the initial sync.
  const existingPages = buildPageIndex(syncResult.navigation)
  const pageIconRefs: Record<string, IconRef[]> = {}
  const pageImports: Record<string, ResolvedImport[]> = {}
  const imageCache = loadImageCache({ distDir })
  const imageOutputDir = path.join(publicDir, '_holocron', 'images')

  // Dedup enrichPage calls — same slug may appear in multiple groups
  const enrichCache = new Map<string, Promise<NavPage>>()

  function enrichPage(slug: string): Promise<NavPage> {
    const cached = enrichCache.get(slug)
    if (cached) return cached
    const promise = enrichPageInner(slug)
    enrichCache.set(slug, promise)
    return promise
  }

  async function enrichPageInner(slug: string): Promise<NavPage> {
    // Non-virtual page — reuse from initial sync
    const existing = existingPages.get(slug)
    if (existing) return existing

    // Check if we have MDX content: either virtual (from processVirtualTabs)
    // or a real MDX file that was in a provider tab's authored groups and
    // wasn't enriched during the initial sync (because provider tabs were emptied).
    let mdxSource = localMdxContent[slug]
    let mdxDir = virtualPageDir(pagesDir, slug)
    let isRealFile = false

    if (!mdxSource) {
      // Real MDX file that wasn't processed yet — read from disk
      const mdxPath = resolveMdxPath(pagesDir, slug)
      if (!mdxPath) {
        throw new Error(`[processDeferredProviders] page "${slug}" not found in nav, mdxContent, or disk`)
      }
      mdxSource = fs.readFileSync(mdxPath, 'utf-8')
      mdxDir = path.dirname(mdxPath)
      isRealFile = true
    }

    const pageSource = slug === 'index' ? '/' : `/${slug}`
    const inlineResult = resolveInlineImports({ content: mdxSource, mdxDir, pagesDir, projectRoot, publicDir })
    const inlineImportMap = inlineResult.imports

    const processMdxOptions: ProcessMdxOptions = {
      slug,
      ...(inlineImportMap.size > 0 && {
        normalizeMdxOptions: { prependPlugins: [[remarkInlineImports, { resolvedImports: inlineImportMap }]] },
      }),
    }

    const processed = processMdx(mdxSource, clonedConfig.icons.library, pageSource, processMdxOptions)
    if (processed instanceof Error) {
      return {
        slug,
        href: slugToHref(slug),
        title: titleFromSlug(slug),
        gitSha: 'error',
        headings: [],
        frontmatter: {},
      }
    }

    // Process images for real MDX pages (virtual pages rarely have local images)
    let finalMdx = processed.normalizedContent
    if (isRealFile && processed.imageSrcs.length > 0) {
      const resolvedImages = await resolveAndProcessImages({
        imageSrcs: processed.imageSrcs,
        mdxDir,
        publicDir,
        projectRoot,
        imageCache,
        imageOutputDir,
      })
      if (resolvedImages.size > 0) {
        finalMdx = rewriteMdxImages(processed.mdast, resolvedImages)
      }
    }

    localMdxContent[slug] = finalMdx
    pageIconRefs[slug] = processed.iconRefs
    if (processed.importSources.length > 0) {
      pageImports[slug] = resolveImportSources({ importSources: processed.importSources, slug, pagesDir, projectRoot })
    }

    return {
      slug,
      href: slugToHref(slug),
      title: processed.title,
      description: processed.description,
      gitSha: isRealFile ? gitBlobSha(mdxSource) : `virtual:${slug}`,
      headings: processed.headings,
      frontmatter: processed.frontmatter,
    }
  }

  const { navigation, switchers } = await buildEnrichedNavigation({ config: clonedConfig, enrichPage })

  if (signal?.aborted) return { watchPaths: [] }

  // All work done without abort — patch live syncResult atomically.
  syncResult.navigation = navigation
  syncResult.switchers = switchers
  syncResult.mdxContent = localMdxContent
  syncResult.providerWatchPaths = providerWatchPaths
  Object.assign(syncResult.pageIconRefs, pageIconRefs)
  Object.assign(syncResult.pageImports, pageImports)
  saveImageCache({ distDir, cache: imageCache })

  return { watchPaths: providerWatchPaths }
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
 *
 * Strips query strings and hash fragments before filesystem checks so
 * paths like `./og.png?v=1` resolve correctly.
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
  // Strip query/hash before filesystem resolution
  const cleanSrc = src.split(/[?#]/, 1)[0]!
  if (!cleanSrc) return undefined

  const isAbsolute = cleanSrc.startsWith('/')

  if (!isAbsolute) {
    // Relative path — resolve from MDX file's directory
    const filePath = path.resolve(mdxDir, cleanSrc)
    if (fs.existsSync(filePath) && isImageFile(filePath)) {
      return { filePath, needsCopy: true }
    }
    return undefined
  }

  // Absolute path — try publicDir first (no copy needed)
  const publicPath = path.join(publicDir, cleanSrc)
  if (fs.existsSync(publicPath) && isImageFile(publicPath)) {
    return { filePath: publicPath, needsCopy: false }
  }

  // Fallback: try project root (some users use / to mean project root)
  const rootPath = path.join(projectRoot, cleanSrc)
  if (fs.existsSync(rootPath) && isImageFile(rootPath)) {
    return { filePath: rootPath, needsCopy: true }
  }

  return undefined
}

async function fetchRemoteImageBuffer(src: string): Promise<Buffer | undefined> {
  const response = await fetch(src, { signal: AbortSignal.timeout(5_000) })
  if (!response.ok) {
    logger.warn(formatHolocronWarning(
      `failed to fetch remote image ${src}: HTTP ${response.status}`,
    ))
    return undefined
  }
  const contentType = response.headers.get('content-type')
  if (contentType && !contentType.startsWith('image/')) {
    logger.warn(formatHolocronWarning(
      `failed to fetch remote image ${src}: unexpected content-type "${contentType}"`,
    ))
    return undefined
  }
  return Buffer.from(await response.arrayBuffer())
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

function PlaceholderMdxImport() {
  return null
}

function TreePlaceholder() {
  return null
}
TreePlaceholder.Folder = PlaceholderMdxImport
TreePlaceholder.File = PlaceholderMdxImport

function ColorPlaceholder() {
  return null
}
ColorPlaceholder.Row = PlaceholderMdxImport
ColorPlaceholder.Item = PlaceholderMdxImport

function createPlaceholderModules(imports: ResolvedImport[]): EagerModules {
  const modules: EagerModules = {}
  for (const { moduleKey } of imports) {
    modules[moduleKey] = new Proxy({ default: PlaceholderMdxImport }, {
      get() {
        return PlaceholderMdxImport
      },
    })
  }
  return modules
}

function getMdxBaseUrl({ slug, pagesDir, projectRoot }: { slug: string; pagesDir: string; projectRoot: string }): string {
  const slugDir = slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/') + 1) : ''
  const pagesDirRelative = path.relative(projectRoot, pagesDir)
  const pagesDirPrefix = pagesDirRelative === '' ? './' : `./${pagesDirRelative}/`
  return pagesDirPrefix + slugDir
}

// Build-time MDX validation must stay side-effect free. Do not import
// mdx-components-map.tsx or markdown component barrels here: those pull client
// components, CSS imports, and large runtime modules into Vite config loading.
// The canonical component name list lives in mdx-component-names.ts (shared
// with the runtime map for type-safe sync).
import { SAFE_MDX_COMPONENT_NAMES } from './mdx-component-names.ts'

function createSafeMdxComponents() {
  const components = Object.fromEntries(SAFE_MDX_COMPONENT_NAMES.map((name) => [name, PlaceholderMdxImport]))
  components.Tree = TreePlaceholder
  components.Color = ColorPlaceholder
  return components
}

function validateAndReportMdx({ markdown, mdast, modules, baseUrl, source }: {
  markdown: string
  mdast: Root
  modules?: EagerModules
  baseUrl?: string
  source: string
}): SafeMdxError[] {
  const visitor = new MdastToJsx({
    markdown,
    mdast,
    components: createSafeMdxComponents(),
    modules,
    baseUrl,
    onError: (error) => logMdxError(error, source),
  })
  visitor.run()
  return visitor.errors
}

function filterErroredMdxContent({ content, mdxContentErrors }: { content: Record<string, string>; mdxContentErrors: Set<string> }) {
  if (mdxContentErrors.size === 0) return content

  return Object.fromEntries(
    Object.entries(content).filter(([slug]) => !mdxContentErrors.has(slug)),
  )
}

/* ── Internal link validation ────────────────────────────────────────── */

/**
 * Validate that internal links in MDX pages point to existing pages or
 * redirect sources. Logs a warning for each broken link, similar to how
 * safe-mdx errors are reported.
 *
 * Resolution rules:
 * - Strip hash fragments and query strings before matching
 * - Absolute links `/foo/bar` → match against page hrefs
 * - Relative links `./foo` or `../bar` → resolve from the linking page's slug directory
 * - A link is valid if it matches a page href OR a redirect source
 */
function validateInternalLinks({
  navigation,
  pageInternalLinks,
  redirects,
  knownPaths,
}: {
  navigation: Navigation
  pageInternalLinks: Record<string, InternalLink[]>
  redirects: HolocronConfig['redirects']
  knownPaths: string[]
}): { brokenLinkCount: number; affectedPageCount: number } {
  const pageIndex = buildPageIndex(navigation)
  // Build a set of all known hrefs (pages + redirect sources)
  const knownHrefs = new Set<string>()
  for (const page of pageIndex.values()) {
    knownHrefs.add(page.href)
    // Accept the `/index` form too: a page served at `/guide` (from
    // `guide/index.mdx`) is also reachable via `/guide/index`, and the root
    // page (`/`) via `/index`. The runtime registers 308 redirects for these.
    knownHrefs.add(page.href === '/' ? '/index' : `${page.href}/index`)
  }
  for (const rule of redirects) {
    // Only add static redirect sources (no wildcards/params)
    const source = rule.source.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/'
    if (!source.includes('*') && !source.includes(':')) {
      knownHrefs.add(source)
    }
  }
  // Separate exact knownPaths from wildcard prefix patterns
  const knownPathPrefixes: string[] = []
  for (const p of knownPaths) {
    if (p.endsWith('/*')) {
      knownPathPrefixes.push(p.slice(0, -1)) // '/api/*' → '/api/'
    } else {
      const normalized = p.endsWith('/') && p !== '/' ? p.slice(0, -1) : p
      knownHrefs.add(normalized)
    }
  }

  let brokenLinkCount = 0
  const pagesWithBrokenLinks = new Set<string>()

  for (const [slug, links] of Object.entries(pageInternalLinks)) {
    const source = slug === 'index' ? '/' : `/${slug}`
    const slugDir = slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/')) : ''

    for (const { href, line } of links) {
      const resolved = resolveInternalHref(href, slugDir)
      if (!resolved) continue // Skip hrefs we can't resolve (e.g. malformed)
      if (knownHrefs.has(resolved)) continue
      if (knownPathPrefixes.some((prefix) => resolved.startsWith(prefix))) continue

      brokenLinkCount++
      pagesWithBrokenLinks.add(slug)

      const location = line
        ? ` ${colors.cyan(source)}:${colors.yellow(String(line))}`
        : ` ${colors.cyan(source)}`
      logger.warn(formatHolocronWarning(
        `broken link${location} → ${colors.yellow(href)} (no matching page found)`,
      ))
    }
  }

  return { brokenLinkCount, affectedPageCount: pagesWithBrokenLinks.size }
}

/**
 * Resolve an internal href to a normalized absolute path that can be matched
 * against page hrefs. Returns undefined for malformed or unresolvable hrefs.
 *
 * - Strips hash fragments and query strings
 * - Absolute `/foo/bar` → `/foo/bar`
 * - Relative `./foo` from slugDir `docs` → `/docs/foo`
 * - Trailing slashes normalized away
 */
function resolveInternalHref(href: string, slugDir: string): string | undefined {
  // Strip hash and query
  const clean = href.replace(/[?#].*$/, '')
  if (!clean) return undefined

  let resolved: string
  if (clean.startsWith('/')) {
    resolved = clean
  } else {
    // Relative: resolve from slugDir
    const base = slugDir ? `/${slugDir}` : ''
    const segments = (base + '/' + clean).split('/').filter(Boolean)
    // Resolve . and .. segments
    const stack: string[] = []
    for (const seg of segments) {
      if (seg === '.') continue
      if (seg === '..') {
        stack.pop()
        continue
      }
      stack.push(seg)
    }
    resolved = '/' + stack.join('/')
  }

  // Normalize: strip trailing slash (but keep '/' for root)
  if (resolved !== '/' && resolved.endsWith('/')) {
    resolved = resolved.slice(0, -1)
  }

  return resolved || '/'
}

/* ── Local asset validation ───────────────────────────────────────────── */

/**
 * Validate that local asset references (images, video, audio) in MDX pages
 * point to existing files. Logs a warning for each broken reference.
 *
 * Resolution rules (same as resolveImagePath):
 * - Relative paths (./img.png, ../x.jpg): resolve from pagesDir + slugDir
 * - Absolute paths (/images/x.png): try publicDir first, then projectRoot
 * - Remote URLs (http/https) are already excluded by collectAssetRefs
 */
function validateLocalAssets({
  pageAssetRefs,
  pagesDir,
  publicDir,
  projectRoot,
}: {
  pageAssetRefs: Record<string, AssetRef[]>
  pagesDir: string
  publicDir: string
  projectRoot: string
}): { brokenAssetCount: number; affectedPageCount: number } {
  let brokenAssetCount = 0
  const pagesWithBrokenAssets = new Set<string>()

  for (const [slug, refs] of Object.entries(pageAssetRefs)) {
    const source = slug === 'index' ? '/' : `/${slug}`
    const slugDir = slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/')) : ''
    const mdxDir = path.join(pagesDir, slugDir)

    for (const { src, line } of refs) {
      if (resolveLocalAssetPath({ src, mdxDir, publicDir, projectRoot })) continue

      brokenAssetCount++
      pagesWithBrokenAssets.add(slug)

      const location = line
        ? ` ${colors.cyan(source)}:${colors.yellow(String(line))}`
        : ` ${colors.cyan(source)} (frontmatter)`
      logger.warn(formatHolocronWarning(
        `broken asset${location} → ${colors.yellow(src)} (file not found)`,
      ))
    }
  }

  return { brokenAssetCount, affectedPageCount: pagesWithBrokenAssets.size }
}

/**
 * Check if a local asset path resolves to an existing file. Supports both
 * image and media extensions. Same resolution logic as resolveImagePath but
 * uses the broader LOCAL_ASSET_EXTENSIONS set.
 *
 * Strips query strings and hash fragments before filesystem checks so
 * paths like `./image.png?v=1` or `./photo.jpg#crop` resolve correctly.
 */
function resolveLocalAssetPath({
  src,
  mdxDir,
  publicDir,
  projectRoot,
}: {
  src: string
  mdxDir: string
  publicDir: string
  projectRoot: string
}): boolean {
  // Strip query/hash before filesystem resolution
  const pathPart = src.split(/[?#]/, 1)[0]!
  if (!pathPart) return true

  const isAbsolute = pathPart.startsWith('/')
  const ext = path.extname(pathPart).toLowerCase()
  // Only validate files with known asset extensions. Unknown extensions
  // (e.g. .pdf, .zip) are not assets and should not trigger warnings.
  if (ext && !LOCAL_ASSET_EXTENSIONS.has(ext)) return true

  if (!isAbsolute) {
    const filePath = path.resolve(mdxDir, pathPart)
    return fs.existsSync(filePath)
  }

  // Absolute path — try publicDir first, then projectRoot
  if (fs.existsSync(path.join(publicDir, pathPart))) return true
  if (fs.existsSync(path.join(projectRoot, pathPart))) return true
  return false
}

/* ── Inline import resolution ────────────────────────────────────────── */

const MD_EXTENSIONS = new Set(['.md', '.mdx'])

/** Fast check: if the content has no .md/.mdx import source strings at all,
 *  skip the full parse. No false negatives — any real .md/.mdx import MUST
 *  contain this pattern (extensionless imports are not supported for .md/.mdx).
 *  False positives (e.g. the pattern in a string constant) are fine — we
 *  just do the full parse. */
const MAY_HAVE_MD_IMPORTS = /\.mdx?['"]/

/**
 * Quick pre-parse of MDX content to find .md/.mdx imports that should be
 * inlined by remarkInlineImports. Returns a map from raw import source →
 * InlineImportEntry with the file content, relative directory, and
 * pre-built spliced mdast nodes ready for the remark plugin to clone.
 *
 * Recursive: if an imported .md/.mdx file itself imports other .md/.mdx
 * files, those are discovered and added to the map too, with source keys
 * rewritten to be relative to the page's directory (matching what
 * remarkInlineImports' rewriteRelativeImportSources will produce).
 * A visited set prevents cycles.
 *
 * Each imported file is parsed exactly ONCE (by quickMdxParser). The
 * resulting mdast is reused for three purposes:
 * 1. extractImports() — discover nested .md/.mdx imports
 * 2. collectImageDeps() — find image file paths for HMR/cache key
 * 3. buildSplicedNodes() — pre-build rewritten nodes for the remark plugin
 *
 * This runs BEFORE processMdx so the remark plugin can expand the content
 * before other remark plugins (headings, callouts, code groups, etc.)
 * process the combined tree.
 */
function resolveInlineImports({
  content,
  mdxDir,
  pagesDir,
  projectRoot,
  publicDir,
}: {
  content: string
  mdxDir: string
  pagesDir: string
  projectRoot: string
  publicDir: string
}): { imports: Map<string, InlineImportEntry>; imageDepPaths: string[] } {
  const empty = { imports: new Map<string, InlineImportEntry>(), imageDepPaths: [] }

  // Regex fast path: skip the full parse if content has no local default imports
  if (!MAY_HAVE_MD_IMPORTS.test(content)) return empty

  const result = new Map<string, InlineImportEntry>()
  const imageDepPaths: string[] = []
  const visitedAbsPaths = new Set<string>()

  // Scan a file's content for .md/.mdx default imports and add them to result.
  // fileDir is the directory of the file being scanned (for relative resolution).
  // relDirFromPage is the relative path from the page's dir to fileDir
  // (used to compute rewritten source keys for nested imports).
  function scanFile(fileContent: string, fileDir: string, relDirFromPage: string) {
    // Regex fast path for nested files: skip if no local default imports
    if (!MAY_HAVE_MD_IMPORTS.test(fileContent)) return

    let mdast: Root
    try {
      const processor = quickMdxParser()
      mdast = processor.parse(fileContent)
      mdast = processor.runSync(mdast) as Root
    } catch {
      return
    }

    const imports = extractImports(mdast)

    for (const imp of imports) {
      if (imp.source.includes('?')) continue
      const hasDefault = imp.specifiers.some((s) => s.type === 'default')
      if (!hasDefault) continue

      const absPath = resolveImportSourceToPath(imp.source, fileDir, pagesDir, projectRoot)
      if (!absPath) continue

      const ext = path.extname(absPath)
      if (!MD_EXTENSIONS.has(ext)) continue
      if (visitedAbsPaths.has(absPath)) continue
      visitedAbsPaths.add(absPath)

      let importContent: string
      try {
        importContent = fs.readFileSync(absPath, 'utf-8')
      } catch {
        continue
      }

      const importDir = path.dirname(absPath)

      // For top-level imports (relDirFromPage === ''), the source key is the
      // raw import source. For nested imports, the source key is what
      // remarkInlineImports will produce after rewriting: the relative path
      // from the page's directory to the imported file.
      let sourceKey: string
      if (relDirFromPage === '') {
        sourceKey = imp.source
      } else {
        if (imp.source.startsWith('./') || imp.source.startsWith('../')) {
          const joined = path.posix.join(relDirFromPage, imp.source)
          sourceKey = joined.startsWith('../') || joined.startsWith('./')
            ? joined
            : './' + joined
        } else {
          sourceKey = imp.source
        }
      }

      // relativeDir for this entry is from the PAGE's dir (mdxDir)
      const relFromPage = path.relative(mdxDir, importDir).replace(/\\/g, '/')
      const relFromPageNorm = relFromPage === ''
        ? './'
        : (relFromPage.startsWith('.') ? relFromPage : './' + relFromPage) + '/'

      // Single parse of the imported file. Reuse the mdast for all three
      // purposes: nested import discovery, image dep collection, and
      // pre-building the spliced nodes for the remark plugin.
      let importedMdast: Root | undefined
      try {
        const proc = quickMdxParser()
        importedMdast = proc.runSync(proc.parse(importContent)) as Root
      } catch { /* parse errors handled by processMdx later */ }

      // Collect image dep paths from this one parse
      if (importedMdast) {
        collectImageDeps(importedMdast, importDir)
      }

      // Pre-build spliced nodes (strip frontmatter + rewrite URLs).
      // Uses a clone so the original mdast can still be scanned for
      // nested imports without mutation interference.
      let parsedNodes: import('mdast').RootContent[] | undefined
      if (importedMdast) {
        const cloned = structuredClone(importedMdast)
        parsedNodes = buildSplicedNodes(cloned, relFromPageNorm, { importDir, pagesDir })
      }

      result.set(sourceKey, {
        content: importContent,
        absPath,
        relativeDir: relFromPageNorm,
        parsedNodes,
      })

      // Recurse: extract nested imports from the SAME parsed mdast
      // (no second parse of importContent). We only recurse if the
      // imported file itself might have .md/.mdx imports.
      if (importedMdast && MAY_HAVE_MD_IMPORTS.test(importContent)) {
        scanMdast(importedMdast, importDir, relFromPageNorm)
      }
    }
  }

  // Like scanFile but works on an already-parsed mdast to avoid
  // re-parsing. Used for nested import discovery.
  function scanMdast(mdast: Root, fileDir: string, relDirFromPage: string) {
    const imports = extractImports(mdast)

    for (const imp of imports) {
      if (imp.source.includes('?')) continue
      const hasDefault = imp.specifiers.some((s) => s.type === 'default')
      if (!hasDefault) continue

      const absPath = resolveImportSourceToPath(imp.source, fileDir, pagesDir, projectRoot)
      if (!absPath) continue

      const ext = path.extname(absPath)
      if (!MD_EXTENSIONS.has(ext)) continue
      if (visitedAbsPaths.has(absPath)) continue
      visitedAbsPaths.add(absPath)

      let importContent: string
      try {
        importContent = fs.readFileSync(absPath, 'utf-8')
      } catch {
        continue
      }

      const importDir = path.dirname(absPath)

      let sourceKey: string
      if (imp.source.startsWith('./') || imp.source.startsWith('../')) {
        const joined = path.posix.join(relDirFromPage, imp.source)
        sourceKey = joined.startsWith('../') || joined.startsWith('./')
          ? joined
          : './' + joined
      } else {
        sourceKey = imp.source
      }

      const relFromPage = path.relative(mdxDir, importDir).replace(/\\/g, '/')
      const relFromPageNorm = relFromPage === ''
        ? './'
        : (relFromPage.startsWith('.') ? relFromPage : './' + relFromPage) + '/'

      let nestedMdast: Root | undefined
      try {
        const proc = quickMdxParser()
        nestedMdast = proc.runSync(proc.parse(importContent)) as Root
      } catch { }

      if (nestedMdast) {
        collectImageDeps(nestedMdast, importDir)
      }

      let parsedNodes: import('mdast').RootContent[] | undefined
      if (nestedMdast) {
        parsedNodes = buildSplicedNodes(structuredClone(nestedMdast), relFromPageNorm, { importDir, pagesDir })
      }

      result.set(sourceKey, {
        content: importContent,
        absPath,
        relativeDir: relFromPageNorm,
        parsedNodes,
      })

      if (nestedMdast && MAY_HAVE_MD_IMPORTS.test(importContent)) {
        scanMdast(nestedMdast, importDir, relFromPageNorm)
      }
    }
  }

  function collectImageDeps(mdast: Root, fileDir: string) {
    visit(mdast, (node) => {
      if (node.type === 'image') {
        const src = node.url
        if (!src || src.startsWith('http://') || src.startsWith('https://')) return
        const resolved = resolveImagePath({ src, mdxDir: fileDir, publicDir, projectRoot })
        if (resolved) imageDepPaths.push(resolved.filePath)
        return
      }
      const jsxName = (node as any).name
      if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && (jsxName === 'Image' || jsxName === 'img')) {
        const attrs = (node as any).attributes ?? []
        for (const attr of attrs) {
          if (attr.type === 'mdxJsxAttribute' && attr.name === 'src' && typeof attr.value === 'string') {
            const src = attr.value
            if (src.startsWith('http://') || src.startsWith('https://')) continue
            const resolved = resolveImagePath({ src, mdxDir: fileDir, publicDir, projectRoot })
            if (resolved) imageDepPaths.push(resolved.filePath)
          }
        }
      }
    })
  }

  scanFile(content, mdxDir, '')
  return { imports: result, imageDepPaths }
}

/**
 * Resolve an import source string to an absolute filesystem path.
 * Handles absolute (/snippets/foo) and relative (./foo, ../foo) paths.
 */
function resolveImportSourceToPath(
  source: string,
  mdxDir: string,
  pagesDir: string,
  projectRoot: string,
): string | undefined {
  if (source.startsWith('/')) {
    // Absolute import — try pagesDir first, then projectRoot
    return tryResolveImport(path.join(pagesDir, source.slice(1)))
      ?? tryResolveImport(path.join(projectRoot, source.slice(1)))
  }

  if (source.startsWith('./') || source.startsWith('../')) {
    // Relative import — resolve from MDX file's directory
    return tryResolveImport(path.resolve(mdxDir, source))
  }

  return undefined
}

import remarkMdx from 'remark-mdx'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import { remark } from 'remark'

function quickMdxParser() {
  return remark()
    .use(remarkMdx)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
}

/* ── Cache I/O ──────────────────────────────────────────────────────── */

type NavCacheEnvelope = {
  version: string
  navigation: Navigation
}

type MdxCacheEnvelope = {
  version: string
  content: Record<string, string>
  pageIconRefs: Record<string, IconRef[]>
  /** Raw import source strings from MDX (e.g. '/snippets/greeting', '../components/badge').
   *  Cached so we can re-resolve them on every sync without re-parsing MDX. */
  pageImportSources: Record<string, string[]>
  /** Internal links per page for broken-link validation. Cached so we can
   *  validate links on cache hits without re-parsing MDX. */
  pageInternalLinks: Record<string, InternalLink[]>
  /** Local asset refs per page for broken-asset validation. Cached so we can
   *  validate asset paths on cache hits without re-parsing MDX. */
  pageAssetRefs: Record<string, AssetRef[]>
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

type MdxCacheData = {
  content: Record<string, string>
  pageIconRefs: Record<string, IconRef[]>
  pageImportSources: Record<string, string[]>
  pageInternalLinks: Record<string, InternalLink[]>
  pageAssetRefs: Record<string, AssetRef[]>
}

function readMdxCache(cachePath: string): MdxCacheData {
  const empty: MdxCacheData = { content: {}, pageIconRefs: {}, pageImportSources: {}, pageInternalLinks: {}, pageAssetRefs: {} }
  if (!fs.existsSync(cachePath)) return empty
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    if (raw && typeof raw === 'object' && raw.version === PACKAGE_VERSION) {
      const envelope = raw as MdxCacheEnvelope
      return {
        content: envelope.content,
        pageIconRefs: envelope.pageIconRefs ?? {},
        pageImportSources: envelope.pageImportSources ?? {},
        pageInternalLinks: envelope.pageInternalLinks ?? {},
        pageAssetRefs: envelope.pageAssetRefs ?? {},
      }
    }
    return empty
  } catch {
    return empty
  }
}

function writeMdxCache(
  cachePath: string,
  data: MdxCacheData,
): void {
  const dir = path.dirname(cachePath)
  fs.mkdirSync(dir, { recursive: true })
  const envelope: MdxCacheEnvelope = {
    version: PACKAGE_VERSION,
    content: data.content,
    pageIconRefs: data.pageIconRefs,
    pageImportSources: data.pageImportSources,
    pageInternalLinks: data.pageInternalLinks,
    pageAssetRefs: data.pageAssetRefs,
  }
  fs.writeFileSync(cachePath, JSON.stringify(envelope))
}

/**
 * Patch the MDX cache on disk with updated content for specific slugs.
 * Called after background image processing completes so that subsequent
 * syncs see cache hits with correct image dimensions/placeholders.
 */
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

const IMPORT_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.mdx', '.md']

/** A resolved import with both the module key (for safe-mdx matching) and
 *  the absolute filesystem path (for the lazy import() call). */
export type ResolvedImport = {
  /** Raw import source as written in MDX (e.g. '/snippets/greeting',
   *  '../components/badge'). Preserved for exact matching when merging
   *  imported headings into the parent page's TOC. */
  source: string
  /** Key matching safe-mdx's glob key format. For absolute imports `/snippets/greeting`,
   *  this is `./snippets/greeting.tsx`. For relative imports `../components/badge`,
   *  this is the normalized path from the pagesDirPrefix base. */
  moduleKey: string
  /** Absolute filesystem path for the import() call. */
  absPath: string
}

/**
 * Resolve raw MDX import source strings to { moduleKey, absPath } tuples.
 *
 * The moduleKey must match what safe-mdx's resolveModulePath() produces:
 * - Absolute `/x` → normalized to `./x` then extension-probed against glob keys
 * - Relative `./x`, `../x` → resolved from `baseUrl` (pagesDirPrefix + slugDir)
 *
 * We replicate that normalization here so the virtual:holocron-modules glob
 * keys exactly match what safe-mdx will look up at render time.
 */
function resolveImportSources({
  importSources,
  slug,
  pagesDir,
  projectRoot,
}: {
  importSources: string[]
  slug: string
  pagesDir: string
  projectRoot: string
}): ResolvedImport[] {
  const result: ResolvedImport[] = []
  const seen = new Set<string>()
  // Directory containing the MDX file for this slug
  const slugDir = slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/')) : ''
  const mdxDir = path.join(pagesDir, slugDir)
  // pagesDirPrefix as computed by vite-plugin.ts (e.g. './pages/' or './')
  const pagesDirRelative = path.relative(projectRoot, pagesDir)
  const pagesDirPrefix = pagesDirRelative === '' ? './' : `./${pagesDirRelative}/`

  for (const source of importSources) {
    // Strip Vite query strings (?raw, ?url, etc.) before filesystem probing,
    // then re-attach them to the moduleKey so safe-mdx can match exactly.
    const queryIdx = source.indexOf('?')
    const querySuffix = queryIdx >= 0 ? source.slice(queryIdx) : ''
    const cleanSource = queryIdx >= 0 ? source.slice(0, queryIdx) : source

    if (cleanSource.startsWith('/')) {
      // Absolute import: safe-mdx normalizes as '.' + source → './snippets/greeting'
      // The moduleKey is that normalized path + resolved extension
      const normalized = '.' + cleanSource // e.g. './snippets/greeting'
      // Try to find the file on disk: pagesDir first, then projectRoot
      const resolved = tryResolveImport(path.join(pagesDir, cleanSource.slice(1)))
        ?? tryResolveImport(path.join(projectRoot, cleanSource.slice(1)))
      if (resolved) {
        const ext = path.extname(resolved)
        const moduleKey = (path.extname(cleanSource) ? normalized : normalized + ext) + querySuffix
        if (!seen.has(moduleKey)) {
          seen.add(moduleKey)
          result.push({ source, moduleKey, absPath: resolved })
        }
      }
      continue
    }

    // Relative import: safe-mdx resolves from baseUrl (pagesDirPrefix + slugDir)
    // e.g. baseUrl='./pages/', source='../components/badge'
    // → joinPaths('./pages/', '../components/badge') → './components/badge'
    // Imports outside projectRoot keep leading ../ segments as module keys.
    const resolved = tryResolveImport(path.resolve(mdxDir, cleanSource))
    if (resolved) {
      const relativeToRoot = path.relative(projectRoot, resolved).replace(/\\/g, '/')
      const moduleKey = (relativeToRoot.startsWith('../') || path.isAbsolute(relativeToRoot)
        ? relativeToRoot
        : './' + relativeToRoot) + querySuffix
      if (!seen.has(moduleKey)) {
        seen.add(moduleKey)
        result.push({ source, moduleKey, absPath: resolved })
      }
    }
  }

  return result
}

/** Try to resolve a file path with extension probing. Returns the first
 *  existing path, or undefined if none match. */
function tryResolveImport(basePath: string): string | undefined {
  // Try exact path first (if user wrote the extension)
  if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
    return basePath
  }
  // Try each extension
  for (const ext of IMPORT_EXTENSIONS) {
    const candidate = basePath + ext
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  // Try index files (e.g. ./components/ → ./components/index.tsx)
  for (const ext of IMPORT_EXTENSIONS) {
    const candidate = path.join(basePath, 'index' + ext)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }
  return undefined
}
