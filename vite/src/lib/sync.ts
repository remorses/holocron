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
import { loadImageCache, saveImageCache, processImage, processImageBuffer } from './image-processor.ts'
import { PACKAGE_VERSION } from './package-version.ts'
import { buildEnrichedNavigation } from './enrich-navigation.ts'
import type { IconRef } from './collect-icons.ts'
import {
  type HolocronConfig,
} from '../config.ts'
import { processVirtualTabs } from './virtual-tab-provider.ts'
import { openapiProvider } from './openapi/provider.ts'
import { formatHolocronError, formatHolocronWarning, logger, logMdxError, HolocronMdxParseError } from './logger.ts'
import { MdastToJsx, type SafeMdxError } from 'safe-mdx'
import type { EagerModules } from 'safe-mdx/parse'
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
  const oldMdxCache = readMdxCache(mdxCachePath)
  const oldMdxContent = oldMdxCache.content
  const oldPageIconRefs = oldMdxCache.pageIconRefs
  const oldPageImportSources = oldMdxCache.pageImportSources
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
    const sha = gitBlobSha(content)

    // Cache hit — MDX unchanged and we have cached MDX content
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
      // Restore cached raw import sources, then resolve fresh against the
      // current filesystem. This ensures newly-created files are picked up
      // without re-parsing the MDX.
      const cachedSources = oldPageImportSources[slug] ?? []
      pageImportSources[slug] = cachedSources
      pageImports[slug] = resolveImportSources({ importSources: cachedSources, slug, pagesDir, projectRoot })
      return cached
    }

    // Cache miss — full processing
    const processed = processMdx(content, config.icons.library, pageSource)
    if (processed instanceof Error) return handleParseError(slug, processed)
    parsedCount++

    const mdxDir = path.dirname(mdxPath)
    const resolvedImages = new Map<string, ResolvedImage>()

    // Resolve and process each image
    for (const src of processed.imageSrcs) {
      let meta
      try {
        if (src.startsWith('http://') || src.startsWith('https://')) {
          const remoteBuffer = await fetchRemoteImageBuffer(src)
          if (!remoteBuffer) {
            continue
          }
          meta = await processImageBuffer({ buffer: remoteBuffer, cache: imageCache })
          if (meta) {
            resolvedImages.set(src, { publicSrc: src, meta })
          }
          continue
        }

        const resolved = resolveImagePath({ src, mdxDir, publicDir, projectRoot })
        if (!resolved) {
          continue
        }

        meta = await processImage({ filePath: resolved.filePath, cache: imageCache })
        if (!meta) {
          continue
        }

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

    // Mutate mdast tree: rewrite image paths + inject dimensions, serialize back
    const finalMdx = resolvedImages.size > 0
      ? rewriteMdxImages(processed.mdast, resolvedImages)
      : processed.normalizedContent

    pageIconRefs[slug] = processed.iconRefs
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
    logger.error(formatHolocronError(`failed to parse ${err.source ?? slug}\n\n${err.reason}\n\n${err.codeFrame}\n`))
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

  // 5. Write caches
  writeCache(cachePath, navigation)
  writeMdxCache(mdxCachePath, { content: filterErroredMdxContent({ content: mdxContent, mdxContentErrors }), pageIconRefs, pageImportSources })
  saveImageCache({ distDir, cache: imageCache })

  return { navigation, switchers, mdxContent, mdxParseErrors, pageIconRefs, pageImports, parsedCount, cachedCount }
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

function readMdxCache(cachePath: string): { content: Record<string, string>; pageIconRefs: Record<string, IconRef[]>; pageImportSources: Record<string, string[]> } {
  if (!fs.existsSync(cachePath)) {
    return { content: {}, pageIconRefs: {}, pageImportSources: {} }
  }
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    if (raw && typeof raw === 'object' && raw.version === PACKAGE_VERSION) {
      const envelope = raw as MdxCacheEnvelope
      return {
        content: envelope.content,
        pageIconRefs: envelope.pageIconRefs ?? {},
        pageImportSources: envelope.pageImportSources ?? {},
      }
    }
    return { content: {}, pageIconRefs: {}, pageImportSources: {} }
  } catch {
    return { content: {}, pageIconRefs: {}, pageImportSources: {} }
  }
}

function writeMdxCache(
  cachePath: string,
  data: { content: Record<string, string>; pageIconRefs: Record<string, IconRef[]>; pageImportSources: Record<string, string[]> },
): void {
  const dir = path.dirname(cachePath)
  fs.mkdirSync(dir, { recursive: true })
  const envelope: MdxCacheEnvelope = { version: PACKAGE_VERSION, content: data.content, pageIconRefs: data.pageIconRefs, pageImportSources: data.pageImportSources }
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
          result.push({ moduleKey, absPath: resolved })
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
        result.push({ moduleKey, absPath: resolved })
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
