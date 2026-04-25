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
  type ConfigNavGroup,
} from '../config.ts'
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
  const redirectBackedPageSlugs = new Set(
    config.redirects
      .map((rule) => redirectSourceToSlug(rule.source))
      .filter((slug): slug is string => slug !== undefined),
  )

  // 2. Enrich a single page slug
  async function enrichPage(slug: string): Promise<NavPage> {
    // Virtual pages (e.g. from OpenAPI) already have content in mdxContent
    const virtualMdx = mdxContent[slug]
    if (virtualMdx) {
      const processed = processMdx(virtualMdx, config.icons.library)
      pageIconRefs[slug] = processed.iconRefs
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
      pageIconRefs[slug] = oldPageIconRefs[slug] ?? processMdx(cachedMdx, config.icons.library).iconRefs
      // Restore cached raw import sources, then resolve fresh against the
      // current filesystem. This ensures newly-created files are picked up
      // without re-parsing the MDX.
      const cachedSources = oldPageImportSources[slug] ?? []
      pageImportSources[slug] = cachedSources
      pageImports[slug] = resolveImportSources({ importSources: cachedSources, slug, pagesDir, projectRoot })
      return cached
    }

    // Cache miss — full processing
    const processed = processMdx(content, config.icons.library)
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
        console.error(`[holocron] warning: failed to process image ${src}`, e)
        continue
      }
    }

    // Mutate mdast tree: rewrite image paths + inject dimensions, serialize back
    const finalMdx = resolvedImages.size > 0
      ? rewriteMdxImages(processed.mdast, resolvedImages)
      : processed.normalizedContent

    // Store MDX content separately from the nav tree
    mdxContent[slug] = finalMdx
    pageIconRefs[slug] = processed.iconRefs
    // Cache raw import sources (for future cache hits) and resolve fresh
    pageImportSources[slug] = processed.importSources
    pageImports[slug] = resolveImportSources({ importSources: processed.importSources, slug, pagesDir, projectRoot })

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

  // 2b. Process OpenAPI tabs — populate their groups + inject virtual MDX pages
  await processOpenAPITabs({
    config,
    projectRoot,
    mdxContent,
    pageIconRefs,
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
  writeMdxCache(mdxCachePath, { content: mdxContent, pageIconRefs, pageImportSources })
  saveImageCache({ distDir, cache: imageCache })

  return { navigation, switchers, mdxContent, pageIconRefs, pageImports, parsedCount, cachedCount }
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

/* ── OpenAPI tab processing ───────────────────────────────────────────── */

async function processOpenAPITabs({
  config,
  projectRoot,
  mdxContent,
  pageIconRefs: _pageIconRefs,
}: {
  config: HolocronConfig
  projectRoot: string
  mdxContent: Record<string, string>
  pageIconRefs: Record<string, IconRef[]>
}) {
  // Track all generated slugs across tabs to detect collisions
  const generatedSlugs = new Map<string, string>()

  for (const tab of config.navigation.tabs) {
    if (!tab.openapi) continue

    const specPaths = Array.isArray(tab.openapi) ? tab.openapi : [tab.openapi]

    // Carry doc with each operation so multi-spec lookups (security, tags) use the right doc
    type OpWithDoc = { op: import('./openapi/process.ts').ExtractedOperation; doc: import('./openapi/process.ts').DereferencedDocument }
    const allOps: OpWithDoc[] = []

    for (const specPath of specPaths) {
      const resolvedPath = path.resolve(projectRoot, specPath)
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`[holocron] OpenAPI spec not found: ${resolvedPath}`)
      }

      const { processOpenAPISpec, extractOperations } = await import('./openapi/process.ts')
      const processed = await processOpenAPISpec(resolvedPath)
      for (const op of extractOperations(processed)) {
        allOps.push({ op, doc: processed })
      }
    }

    if (allOps.length === 0) continue

    const { groupOperationsByTag, operationSlug, operationTitle, tagDisplayName } = await import('./openapi/process.ts')
    const { generateCurl } = await import('./openapi/curl-generator.ts')

    // Group operations by tag (using the first tag of each operation)
    const tagGroups = new Map<string, OpWithDoc[]>()
    for (const item of allOps) {
      const tag = item.op.tags[0] ?? 'default'
      const list = tagGroups.get(tag) ?? []
      list.push(item)
      tagGroups.set(tag, list)
    }

    const groups: ConfigNavGroup[] = []

    for (const [tag, ops] of tagGroups) {
      const pages: string[] = []

      for (const { op, doc } of ops) {
        const slug = `api/${operationSlug(op)}`

        // Validate slug uniqueness
        const existingOwner = generatedSlugs.get(slug)
        if (existingOwner) {
          throw new Error(
            `[holocron] duplicate OpenAPI slug "${slug}" generated from ${op.method.toUpperCase()} ${op.path}. ` +
            `Conflicts with ${existingOwner}. Use unique operationIds to avoid collisions.`,
          )
        }
        generatedSlugs.set(slug, `${op.method.toUpperCase()} ${op.path}`)

        // Also check the slug doesn't shadow a real MDX page on disk
        if (resolveMdxPath(projectRoot, slug)) {
          console.warn(
            `[holocron] OpenAPI page "${slug}" shadows an MDX file on disk. ` +
            `The virtual OpenAPI page will be used instead.`,
          )
        }

        const title = operationTitle(op)
        const curl = generateCurl(op)

        const params = op.parameters.map((p) => ({
          name: p.name,
          in: p.in,
          required: p.required,
          deprecated: p.deprecated,
          description: p.description,
          schema: p.schema ? simplifySchema(p.schema as Record<string, unknown>) : undefined,
        }))

        const requestBody = (() => {
          const body = op.operation.requestBody as import('openapi-types').OpenAPIV3.RequestBodyObject | undefined
          if (!body?.content) return undefined
          // Prefer application/json, fall back to any JSON-like type, then first available
          const jsonKey = Object.keys(body.content).find((k) => k === 'application/json')
            ?? Object.keys(body.content).find((k) => k.includes('json'))
            ?? Object.keys(body.content)[0]
          if (!jsonKey) return undefined
          const media = body.content[jsonKey]!
          return {
            required: body.required,
            description: body.description,
            contentType: jsonKey,
            schema: media.schema ? simplifySchema(media.schema as Record<string, unknown>) : undefined,
          }
        })()

        const responses = Object.entries(op.operation.responses ?? {}).map(([status, resp]) => {
          const r = resp as import('openapi-types').OpenAPIV3.ResponseObject
          // Prefer application/json, fall back to any JSON-like type
          const jsonKey = r.content
            ? (Object.keys(r.content).find((k) => k === 'application/json')
              ?? Object.keys(r.content).find((k) => k.includes('json')))
            : undefined
          const jsonContent = jsonKey && r.content ? r.content[jsonKey] : undefined
          const example = jsonContent?.example ?? pickFirstExample(jsonContent?.examples)
          return {
            status,
            description: r.description,
            schema: jsonContent?.schema ? simplifySchema(jsonContent.schema as Record<string, unknown>) : undefined,
            example,
          }
        })

        // Use the operation's own doc for security lookups (correct for multi-spec)
        const security = extractSecurityInfo(op, doc)

        const servers = op.servers.map((s) => ({
          url: s.url,
          description: s.description,
        }))

        const propsJson = JSON.stringify({
          method: op.method,
          path: op.path,
          summary: op.operation.summary,
          description: op.operation.description,
          parameters: params,
          requestBody,
          responses,
          security,
          servers,
          deprecated: op.operation.deprecated,
        })

        // Find response example if the spec provides one
        const responseWithExample = responses.find((r) => r.example !== undefined)
        const responseExampleJson = responseWithExample?.example !== undefined
          ? (typeof responseWithExample.example === 'string'
            ? responseWithExample.example
            : JSON.stringify(responseWithExample.example, null, 2))
          : undefined

        // Build the aside block with cURL + optional response example
        const asideLines = [
          '<Aside full>',
          '',
          '<RequestExample>',
          '',
          '```bash',
          curl,
          '```',
          '',
          '</RequestExample>',
        ]
        if (responseExampleJson) {
          asideLines.push(
            '',
            '<ResponseExample>',
            '',
            '```json',
            responseExampleJson,
            '```',
            '',
            '</ResponseExample>',
          )
        }
        asideLines.push('', '</Aside>')

        const virtualMdx = [
          '---',
          `title: "${title.replace(/"/g, '\\"')}"`,
          `description: "${(op.operation.description ?? op.operation.summary ?? '').replace(/"/g, '\\"').replace(/\n/g, ' ').slice(0, 200)}"`,
          `api: "${op.method.toUpperCase()} ${op.path}"`,
          ...(op.operation.deprecated ? ['deprecated: true'] : []),
          '---',
          '',
          `<OpenAPIEndpoint {...${propsJson}} />`,
          '',
          ...asideLines,
        ].join('\n')

        mdxContent[slug] = virtualMdx
        pages.push(slug)
      }

      // Use the first doc's tag metadata for display name
      const firstDoc = ops[0]!.doc
      groups.push({
        group: tagDisplayName(tag, firstDoc),
        pages,
      })
    }

    // Replace the empty groups with the auto-generated ones
    tab.groups = groups
  }
}

/** Simplify a schema object for serialization (strip non-essential fields). */
function simplifySchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return schema
  const result: Record<string, unknown> = {}
  const keepKeys = ['type', 'format', 'description', 'required', 'properties', 'items',
    'enum', 'default', 'example', 'oneOf', 'anyOf', 'allOf', 'additionalProperties',
    'nullable', 'deprecated', 'minimum', 'maximum', 'minLength', 'maxLength', 'pattern', 'title']
  for (const key of keepKeys) {
    if (key in schema) {
      const value = schema[key]
      if (key === 'properties' && value && typeof value === 'object') {
        const props: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value)) {
          props[k] = simplifySchema(v as Record<string, unknown>)
        }
        result[key] = props
      } else if (key === 'items' && value && typeof value === 'object') {
        result[key] = simplifySchema(value as Record<string, unknown>)
      } else if ((key === 'oneOf' || key === 'anyOf' || key === 'allOf') && Array.isArray(value)) {
        result[key] = value.map((v: unknown) => simplifySchema(v as Record<string, unknown>))
      } else {
        result[key] = value
      }
    }
  }
  return result
}

function pickFirstExample(examples: Record<string, unknown> | undefined): unknown | undefined {
  if (!examples) return undefined
  const first = Object.values(examples)[0]
  if (first && typeof first === 'object' && 'value' in (first as Record<string, unknown>)) {
    return (first as Record<string, unknown>).value
  }
  return first
}

function extractSecurityInfo(
  op: import('./openapi/process.ts').ExtractedOperation,
  doc: import('./openapi/process.ts').DereferencedDocument,
): { name: string; type: string; scheme?: string; in?: string; description?: string }[] {
  const schemes = (doc.dereferenced.components as Record<string, unknown> | undefined)?.securitySchemes as Record<string, Record<string, unknown>> | undefined
  if (!schemes || op.security.length === 0) return []

  const result: { name: string; type: string; scheme?: string; in?: string; description?: string }[] = []
  for (const req of op.security) {
    for (const schemeName of Object.keys(req)) {
      const scheme = schemes[schemeName]
      if (!scheme) continue
      result.push({
        name: schemeName,
        type: scheme.type as string,
        scheme: scheme.scheme as string | undefined,
        in: scheme.type === 'apiKey' ? (scheme.in as string) : scheme.type === 'http' ? 'header' : undefined,
        description: scheme.description as string | undefined,
      })
    }
  }
  return result
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

const IMPORT_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js']

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
    if (source.startsWith('/')) {
      // Absolute import: safe-mdx normalizes as '.' + source → './snippets/greeting'
      // The moduleKey is that normalized path + resolved extension
      const normalized = '.' + source // e.g. './snippets/greeting'
      // Try to find the file on disk: pagesDir first, then projectRoot
      const resolved = tryResolveImport(path.join(pagesDir, source.slice(1)))
        ?? tryResolveImport(path.join(projectRoot, source.slice(1)))
      if (resolved) {
        const ext = path.extname(resolved)
        const moduleKey = normalized + ext
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
    const resolved = tryResolveImport(path.resolve(mdxDir, source))
    if (resolved) {
      const ext = path.extname(resolved)
      // Compute the moduleKey the same way safe-mdx's joinPaths would:
      // relative from projectRoot, with ./ prefix
      const relFromRoot = './' + path.relative(projectRoot, resolved).replace(/\\/g, '/')
      // But safe-mdx computes from baseUrl, so we need the key it would produce.
      // safe-mdx: joinPaths(baseUrl, source) + ext probing
      // We can derive this: the resolved file's path relative to root IS the moduleKey
      // because safe-mdx's joinPaths(pagesDirPrefix + slugDir, relativeSource) produces
      // the same normalized path as resolving on disk then making root-relative.
      const moduleKey = relFromRoot
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
