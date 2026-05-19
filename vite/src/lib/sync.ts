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
import { processMdx, rewriteMdxImages, type ResolvedImage, type InternalLink, type ProcessMdxOptions } from './mdx-processor.ts'
import { remarkInlineImports, type InlineImportEntry } from './mintlify/remark-inline-imports.ts'
import { visit } from 'unist-util-visit'
import { loadImageCache, saveImageCache, processImage, processImageBuffer } from './image-processor.ts'
import { PACKAGE_VERSION } from './package-version.ts'
import { buildEnrichedNavigation } from './enrich-navigation.ts'
import type { IconRef } from './collect-icons.ts'
import {
  type HolocronConfig,
} from '../config.ts'
import { processVirtualTabs } from './virtual-tab-provider.ts'
import { openapiProvider } from './openapi/provider.ts'
import { colors, formatHolocronError, formatHolocronWarning, logger, logMdxError, HolocronMdxParseError } from './logger.ts'
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

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'])

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
}: {
  config: HolocronConfig
  pagesDir: string
  publicDir: string
  projectRoot: string
  distDir: string
  logParseErrors?: boolean
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

    // Virtual pages (e.g. from OpenAPI) already have content in mdxContent
    const virtualMdx = mdxContent[slug]
    if (virtualMdx) {
      const processed = processMdx(virtualMdx, config.icons.library, pageSource)
      if (processed instanceof Error) return handleParseError(slug, processed)
      pageIconRefs[slug] = processed.iconRefs
      if (processed.internalLinks.length > 0) pageInternalLinks[slug] = processed.internalLinks
      const errors = validateAndReportMdx({ markdown: virtualMdx, mdast: processed.mdast, source: pageSource })
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
    let sha = gitBlobSha(content)
    if (inlineImportMap.size > 0) {
      // Combine page SHA with imported file SHAs + image dep SHAs so
      // changes to imported files OR their referenced images invalidate
      // the cache.
      const parts = [...inlineImportMap.values()]
        .map((e) => `${e.absPath}:${gitBlobSha(e.content)}`)
        .sort()
      for (const imgPath of inlineResult.imageDepPaths) {
        try {
          parts.push(`img:${imgPath}:${gitBlobSha(fs.readFileSync(imgPath, 'utf-8'))}`)
        } catch { /* ignore missing files */ }
      }
      sha = gitBlobSha(sha + '\n' + parts.join('\n'))
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
        const reprocessed = processMdx(cachedMdx, config.icons.library, pageSource)
        if (reprocessed instanceof Error) return handleParseError(slug, reprocessed)
        pageIconRefs[slug] = reprocessed.iconRefs
      }
      // Restore cached internal links for broken-link validation
      const cachedLinks = oldPageInternalLinks[slug]
      if (cachedLinks && cachedLinks.length > 0) pageInternalLinks[slug] = cachedLinks
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
    const processMdxOptions: ProcessMdxOptions | undefined = inlineImportMap.size > 0
      ? {
        normalizeMdxOptions: {
          prependPlugins: [[remarkInlineImports, { resolvedImports: inlineImportMap }]],
        },
      }
      : undefined

    const processed = processMdx(content, config.icons.library, pageSource, processMdxOptions)
    if (processed instanceof Error) return handleParseError(slug, processed)
    parsedCount++

    const resolvedImages = await resolveAndProcessImages({
      imageSrcs: processed.imageSrcs,
      mdxDir,
      publicDir,
      projectRoot,
      imageCache,
      imageOutputDir,
    })

    // Mutate mdast tree: rewrite image paths + inject dimensions, serialize back
    const finalMdx = resolvedImages.size > 0
      ? rewriteMdxImages(processed.mdast, resolvedImages)
      : processed.normalizedContent

    pageIconRefs[slug] = processed.iconRefs
    if (processed.internalLinks.length > 0) pageInternalLinks[slug] = processed.internalLinks
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

  // 2b. Process virtual tabs (OpenAPI, etc.) — populate groups + inject virtual MDX pages
  await processVirtualTabs({
    config,
    projectRoot,
    pagesDir,
    mdxContent,
    providers: [openapiProvider],
  })

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

  // 4d. Validate internal links — warn about links pointing to non-existent pages
  if (logParseErrors) {
    validateInternalLinks({
      navigation,
      pageInternalLinks,
      redirects: config.redirects,
      knownPaths: config.knownPaths,
    })
  }

  // 5. Write caches
  writeCache(cachePath, navigation)
  writeMdxCache(mdxCachePath, {
    content: filterErroredMdxContent({ content: mdxContent, mdxContentErrors }),
    pageIconRefs,
    pageImportSources,
    pageInternalLinks,
  })
  saveImageCache({ distDir, cache: imageCache })

  return { navigation, switchers, mdxContent, mdxParseErrors, pageIconRefs, pageImports, importedImageDepPaths: [...allImportedImageDepPaths], parsedCount, cachedCount }
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

async function fetchRemoteImageBuffer(src: string): Promise<Buffer | undefined> {
  const response = await fetch(src)
  if (!response.ok) {
    return undefined
  }
  const contentType = response.headers.get('content-type')
  if (contentType && !contentType.startsWith('image/')) {
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
}): void {
  const pageIndex = buildPageIndex(navigation)
  // Build a set of all known hrefs (pages + redirect sources)
  const knownHrefs = new Set<string>()
  for (const page of pageIndex.values()) {
    knownHrefs.add(page.href)
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

  for (const [slug, links] of Object.entries(pageInternalLinks)) {
    const source = slug === 'index' ? '/' : `/${slug}`
    const slugDir = slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/')) : ''

    for (const { href, line } of links) {
      const resolved = resolveInternalHref(href, slugDir)
      if (!resolved) continue // Skip hrefs we can't resolve (e.g. malformed)
      if (knownHrefs.has(resolved)) continue
      if (knownPathPrefixes.some((prefix) => resolved.startsWith(prefix))) continue

      const location = line
        ? ` ${colors.cyan(source)}:${colors.yellow(String(line))}`
        : ` ${colors.cyan(source)}`
      logger.warn(formatHolocronWarning(
        `broken link${location} → ${colors.yellow(href)} (no matching page found)`,
      ))
    }
  }
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

/* ── Inline import resolution ────────────────────────────────────────── */

const MD_EXTENSIONS = new Set(['.md', '.mdx'])

/**
 * Quick pre-parse of MDX content to find .md/.mdx imports that should be
 * inlined by remarkInlineImports. Returns a map from raw import source →
 * InlineImportEntry with the file content and relative directory.
 *
 * Recursive: if an imported .md/.mdx file itself imports other .md/.mdx
 * files, those are discovered and added to the map too, with source keys
 * rewritten to be relative to the page's directory (matching what
 * remarkInlineImports' rewriteRelativeImportSources will produce).
 * A visited set prevents cycles.
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
  const result = new Map<string, InlineImportEntry>()
  const imageDepPaths: string[] = []
  const visitedAbsPaths = new Set<string>()

  // Scan a file's content for .md/.mdx default imports and add them to result.
  // fileDir is the directory of the file being scanned (for relative resolution).
  // relDirFromPage is the relative path from the page's dir to fileDir
  // (used to compute rewritten source keys for nested imports).
  function scanFile(fileContent: string, fileDir: string, relDirFromPage: string) {
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
      const relativeDir = path.relative(fileDir, importDir).replace(/\\/g, '/')
      const relativeDirNorm = relativeDir === ''
        ? './'
        : (relativeDir.startsWith('.') ? relativeDir : './' + relativeDir) + '/'

      // For top-level imports (relDirFromPage === ''), the source key is the
      // raw import source. For nested imports, the source key is what
      // remarkInlineImports will produce after rewriting: the relative path
      // from the page's directory to the imported file.
      let sourceKey: string
      if (relDirFromPage === '') {
        sourceKey = imp.source
      } else {
        // Rewrite source relative to the page dir (same logic as
        // resolveRelativeUrl in the remark plugin)
        if (imp.source.startsWith('./') || imp.source.startsWith('../')) {
          const joined = path.posix.join(relDirFromPage, imp.source)
          sourceKey = joined.startsWith('../') || joined.startsWith('./')
            ? joined
            : './' + joined
        } else {
          sourceKey = imp.source // absolute imports don't get rewritten
        }
      }

      // relativeDir for this entry is from the PAGE's dir (mdxDir), not the
      // importing file's dir. remarkInlineImports uses this to rewrite URLs
      // in the inlined content.
      const relFromPage = path.relative(mdxDir, importDir).replace(/\\/g, '/')
      const relFromPageNorm = relFromPage === ''
        ? './'
        : (relFromPage.startsWith('.') ? relFromPage : './' + relFromPage) + '/'

      result.set(sourceKey, {
        content: importContent,
        absPath,
        relativeDir: relFromPageNorm,
      })

      // Parse the imported file separately to collect image dep paths for
      // HMR watching and cache key computation.
      try {
        const importedProcessor = quickMdxParser()
        const importedMdast = importedProcessor.runSync(importedProcessor.parse(importContent)) as Root
        collectImageDeps(importedMdast, importDir)
      } catch { /* parsing errors don't affect image dep collection */ }

      // Recurse into the imported file to discover its own .md/.mdx imports
      scanFile(importContent, importDir, relFromPageNorm)
    }
  }

  function collectImageDeps(mdast: Root, fileDir: string) {
    visit(mdast, (node) => {
      if (node.type === 'image') {
        const src = (node as import('mdast').Image).url
        if (!src || src.startsWith('http://') || src.startsWith('https://')) return
        const resolved = resolveImagePath({ src, mdxDir: fileDir, publicDir, projectRoot })
        if (resolved) imageDepPaths.push(resolved.filePath)
        return
      }
      if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && (node as any).name === 'Image') {
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
}

function readMdxCache(cachePath: string): MdxCacheData {
  const empty: MdxCacheData = { content: {}, pageIconRefs: {}, pageImportSources: {}, pageInternalLinks: {} }
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
  }
  fs.writeFileSync(cachePath, JSON.stringify(envelope))
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
