/**
 * Async factory for a spiceflow app that serves the docs site.
 *
 * Layouts and loaders are registered per-slug (not `/*`) so users can mount
 * holocron as a child and add their own routes without the wildcard
 * wrapping everything. Every slug registers the SAME layout function so
 * React reconciles by element type and preserves client identity across
 * navigations. A wildcard layout handles 404s only.
 *
 * Providers are resolved once at setup time; HMR invalidates this module.
 */

// Import the CSS from `../src` so it always resolves to the file that actually
// ships in the package (only `src/styles/globals.css` is published; `tsc` does
// not copy `.css` into `dist/`). From both `src/app-factory.tsx` and the
// emitted `dist/app-factory.js`, one `..` reaches the package root, so `../src`
// is stable in both. This matches the `../src` convention in vite-plugin.ts and
// lets non-Vite consumers (e.g. the workerd test pool) resolve the stylesheet.
import '../src/styles/globals.css'
import React from 'react'
import { Spiceflow, type AnySpiceflow, redirect } from 'spiceflow'
import { createSpiceflowFetch } from 'spiceflow/client'
import { Head, ProgressBar } from 'spiceflow/react'
import { MdastToJsx, type SafeMdxError } from 'safe-mdx'
import { mdxParse, resolveModules, type EagerModules } from 'safe-mdx/parse'
import { parse as parseCookies } from 'cookie'
import type { Root } from 'mdast'
import {
  EditorialPage,
  type EditorialSection,
} from './components/layout/editorial-page.tsx'
import { RenderBannerNodes } from './components/layout/banner.tsx'
import { P, SectionHeading } from './components/markdown/typography.tsx'
import { Danger, Warning } from './components/markdown/callout.tsx'
import { CodeBlock } from './components/markdown/code-block.tsx'
import { extractParseErrorInfo, HolocronMdxParseError, logger } from './lib/logger.ts'
import { slug as githubSlug } from 'github-slugger'
import { NotFound } from './components/not-found.tsx'
import {
  findPage,
  collectAllPages,
  slugToHref,
  buildHrefToSlugMap,
  type NavHeading,
  type NavPage,
  type NavGroup,
  type Navigation,
  type NavVersionItem,
  type NavDropdownItem,
} from './navigation.ts'

import { deduplicateRedirects, interpolateDestination, redirectSourceMatches } from './lib/redirects.ts'
import { isAgentRequest, stripVisibilityForAgents } from './lib/raw-markdown.ts'
import { zipSync, strToU8 } from 'fflate'
import { buildSections, isAboveNode } from './lib/mdx-sections.ts'
import { computeSidebarWidthFromAsideNodes } from './lib/sidebar-widths.ts'
import { visit } from 'unist-util-visit'
import { RenderNodes, mdxComponents, renderNode } from './lib/mdx-components-map.tsx'
import { SiteHead, THEME_SCRIPT, GtmNoscript } from './lib/site-head.tsx'
import { encodeFederationPayload } from 'spiceflow/federation'
import { modelMessagesToChatMessages, renderMarkdownTextPart } from './lib/chat-restore.tsx'
import dedent from 'string-dedent'
import { buildOgImageUrl } from './lib/og-utils.ts'
import { getPageRendering, getPageRobots, getPageSeoMeta, isIndexablePage, parsePageFrontmatter, serializeKeywords, type PageFrontmatter, type PageRendering } from './lib/page-frontmatter.ts'
import { holocronUrl, getHolocronApiKey } from './lib/holocron-url.ts'
import { createGitHubStarsPromise } from './lib/github-stars.ts'
import {
  buildVisibleSiteData,
  type HolocronSiteData,
  collectAncestorGroupKeys,
  findFirstPage,
  resolveActiveDropdownHref,
  resolveActiveTabHref,
  resolveActiveVersionHref,
} from './site-data.ts'
import type { HolocronConfig, ConfigNavTab, ConfigNavGroup } from './config.ts'
import { collectIconRefs, dedupeIconRefs, type IconRef } from './lib/collect-icons.ts'
import { resolveConfigOverride, shouldShowConfigPanel, hasPreviewProps } from './lib/config-override.ts'
import { normalize as normalizeConfig } from './lib/normalize-config.ts'
import {
  type CustomTabProvider,
  resolveRuntimeContent,
  mergeRuntimeNavigation,
} from './lib/runtime-provider.ts'
import { runtimeCache } from './lib/runtime-cache.ts'

/* ── Runtime provider registry ────────────────────────────────────────── */

/** Entry for a runtime-provider tab. Each entry carries the provider
 *  object directly (imported via virtual module by vite-plugin). */
export type RuntimeTabEntry = {
  tabName: string
  provider: CustomTabProvider
}

/* ── Server-only page lookup (uses parsePageFrontmatter → zod/yaml) ── */

/** Lightweight title extraction from raw MDX. Checks frontmatter `title:`
 *  first, then falls back to the first `# heading`. */
function extractTitleFromMdx(mdx: string): string {
  const frontmatter = parsePageFrontmatter(mdx)
  if (frontmatter.title) return frontmatter.title
  const headingMatch = mdx.match(/^#\s+(.+)/m)
  if (headingMatch?.[1]) return headingMatch[1].trim()
  return 'Untitled'
}

/** Find a page by slug, checking both the navigation tree and async MDX source.
 *  Ensures pages that exist on disk are always serveable even if not listed
 *  in the navigation config. */
async function findPageBySlug({
  nav, slug, getMdxSource,
}: {
  nav: Navigation
  slug: string
  getMdxSource: (slug: string) => Promise<string | undefined>
}): Promise<NavPage | undefined> {
  const navPage = findPage(nav, slug)
  if (navPage) return navPage
  const mdx = await getMdxSource(slug)
  if (!mdx) return undefined
  const frontmatter = parsePageFrontmatter(mdx)
  return {
    slug,
    href: slugToHref(slug),
    title: extractTitleFromMdx(mdx),
    description: frontmatter.description,
    gitSha: '',
    headings: [],
    icon: frontmatter.icon,
    frontmatter,
  }
}

/* ── Loader data type ────────────────────────────────────────────────── */

/**
 * Per-request data produced by `.loader('/*')`. Serialized via RSC flight
 * to both the page handler (via `loaderData`) and every client component
 * (via `useHolocronData()` from `@holocron.so/vite/react`).
 *
 * Includes canonical site data so client components can read the same `site`
 * object through the typed loader API during SSR and client navigation.
 */
export type HolocronLoaderData = {
  /** Canonical site-wide data shared by server + client components. */
  site: HolocronSiteData
  /** Active page href, or `undefined` on 404. */
  currentPageHref: string | undefined
  /** Active page title, or `undefined` on 404. */
  currentPageTitle: string | undefined
  /** Active page description (for meta tag), or `undefined`. */
  currentPageDescription: string | undefined
  /** Flat heading list for the active page — used by TOC scroll tracking. */
  currentHeadings: NavHeading[]
  /** Path-based keys (`\0`-joined) of groups that should start expanded. */
  ancestorGroupKeys: string[]
  /** Href of the tab that contains the active page. */
  activeTabHref: string | undefined
  /** Href of the version item that contains the active page. */
  activeVersionHref: string | undefined
  /** Href of the dropdown item that contains the active page. */
  activeDropdownHref: string | undefined
  /** Original requested path when a 404 occurred (includes leading slash). */
  notFoundPath: string | undefined
  /** Fully-composed `<title>` text (includes site name suffix). */
  headTitle: string
  /** Value for `<meta name="robots">`, or `undefined` to omit the tag. */
  headRobots: string | undefined
  /** Parsed frontmatter for the active page. */
  currentPageFrontmatter: PageFrontmatter | undefined
  /** Whether the config customization panel should be shown. */
  showConfigPanel: boolean
  /** Whether the page is loaded inside the notaku dashboard iframe
   *  (previewProps=true). When true, the ConfigOverrideListener is
   *  rendered to handle live config updates via postMessage. */
  hasPreviewProps: boolean
  /**
   * Non-blocking promise that resolves to a map of GitHub repo URLs → star
   * counts. Passed as an unresolved promise so it streams via RSC flight
   * without blocking the initial page render. Client components use
   * `React.use()` inside a Suspense boundary to read the resolved value.
   */
  githubStars?: Promise<Record<string, number>>
}

type MdxParseErrorInfo = {
  reason: string
  line: number
  column?: number
  source?: string
  mdxSource: string
}

type HolocronNavigationData = {
  navigation: Navigation
  switchers: { versions: NavVersionItem[]; dropdowns: NavDropdownItem[] }
  mdxParseErrors?: Record<string, MdxParseErrorInfo>
}

type HolocronProviders = {
  base: string
  getConfig(): Promise<HolocronConfig>
  getNavigationData(): HolocronNavigationData | Promise<HolocronNavigationData>
  getMdxSlugs(): Promise<string[]>
  getMdxSource(slug: string): Promise<string | undefined>
  getPageIconRefs(slug: string): Promise<IconRef[]>
  /** Lazy glob of importable files (snippets, components, colocated pages).
   *  Used by resolveModules() to resolve MDX import statements at render time. */
  getModules?(): Record<string, () => Promise<Record<string, any>>>
  /** Pages directory relative to root with ./ prefix and trailing slash.
   *  E.g. './pages/' or './' when pagesDir is the project root. */
  pagesDirPrefix?: string
  /** Runtime provider tabs (e.g. Outrank). Serialized as tab index → provider
   *  name pairs from sync, reconstructed in app.tsx. */
  runtimeTabs?: RuntimeTabEntry[]
}

/* ── Shared helpers ──────────────────────────────────────────────────── */

function withBaseRoute(base: string, route: string): string {
  const normalizedBase = base === '/' ? '' : `/${base.replace(/^\/+|\/+$/g, '')}`
  if (!normalizedBase) return route
  if (route === '/') return normalizedBase
  return `${normalizedBase}${route}`
}

function isLocalhostUrl(requestUrl: string): boolean {
  const url = new URL(requestUrl)
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
}

function escapeMarkdownText(value: string): string {
  return value.replaceAll('\n', ' ').trim()
}

function stripBaseFromSlug(rawSlug: string, base: string): string {
  const slug = rawSlug.replace(/^\/+/, '')
  const normalizedBase = base === '/' ? '' : base.replace(/^\/+|\/+$/g, '')
  if (!normalizedBase) return slug
  if (slug === normalizedBase) return ''
  if (slug.startsWith(normalizedBase + '/')) {
    return slug.slice(normalizedBase.length + 1)
  }
  return slug
}

function getBannerJsx(site: HolocronSiteData, request: Request): React.ReactNode | undefined {
  if (!site.config.banner) return undefined
  const pageCookies = parseCookies(request.headers.get('cookie') || '')
  if (pageCookies['holocron-banner-dismissed'] === site.config.banner.content) return undefined
  const bannerMdx = site.config.banner.content
  try {
    const bannerMdast = mdxParse(bannerMdx)
    return <RenderBannerNodes markdown={bannerMdx} nodes={bannerMdast.children} source='docs.json banner' />
  } catch {
    // Banner MDX is from config, not user files. If it fails to parse,
    // skip the banner silently rather than crashing the whole page.
    return undefined
  }
}

function renderMdxPage({
  site,
  slug,
  pageMdx,
  loaderData,
  bannerJsx,
  ogImageUrl,
  requestUrl,
  modules,
  pagesDirPrefix,
  preParsedMdast,
  devRenderErrors,
}: {
  site: HolocronSiteData
  slug: string
  pageMdx: string
  loaderData: HolocronLoaderData
  bannerJsx: React.ReactNode | undefined
  ogImageUrl: string
  /** Request URL used to resolve relative og:image / twitter:image paths to absolute URLs */
  requestUrl: URL
  /** Pre-resolved modules for MDX import statements (from resolveModules) */
  modules?: EagerModules
  /** Pages directory prefix for resolving relative imports */
  pagesDirPrefix?: string
  /** Pre-parsed mdast — avoids re-parsing when the caller already parsed it (e.g. for resolveModules) */
  preParsedMdast?: Root
  /** Safe-mdx render errors collected during dev-only pre-validation. */
  devRenderErrors?: SafeMdxError[]
}) {
  const pageSeoMeta = getPageSeoMeta(loaderData.currentPageFrontmatter)
  const pageKeywords = serializeKeywords(loaderData.currentPageFrontmatter?.keywords)
  // Resolve relative image URLs to absolute — social crawlers need full URLs
  const resolveUrl = (url: string) => /^https?:\/\//.test(url) ? url : new URL(url, requestUrl.origin).toString()
  const pageOgImage = resolveUrl(pageSeoMeta['og:image'] ?? ogImageUrl)
  const pageTwitterImage = resolveUrl(pageSeoMeta['twitter:image'] ?? pageOgImage)
  const pageOgDescription = pageSeoMeta['og:description'] ?? loaderData.currentPageDescription
  const pageTwitterDescription = pageSeoMeta['twitter:description'] ?? loaderData.currentPageDescription
  const pageOgTitle = pageSeoMeta['og:title'] ?? loaderData.headTitle
  const pageTwitterTitle = pageSeoMeta['twitter:title'] ?? loaderData.headTitle
  const pageTwitterCard = pageSeoMeta['twitter:card'] ?? 'summary_large_image'

  const mdast = preParsedMdast ?? mdxParse(pageMdx)

  const pageMode = loaderData.currentPageFrontmatter?.mode

  // Compute the baseUrl for resolving relative imports in MDX.
  // The slug mirrors the file path inside pagesDir (e.g. 'api/overview'
  // comes from pages/api/overview.mdx), so its directory is the baseUrl.
  const slugDir = slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/') + 1) : ''
  const mdxBaseUrl = (pagesDirPrefix || './') + slugDir
  const mdxSourcePath = slug === 'index' ? '/' : `/${slug}`

  // Custom mode: skip section splitting, aside extraction, and all editorial
  // processing. Render the raw mdast directly so the AST stays unmutated
  // (buildSections injects AI widget / page nav into <Aside> nodes).
  if (pageMode === 'custom') {
    const maxWidth = loaderData.currentPageFrontmatter?.maxWidth
    return (
      <>
        <Head>
          <Head.Title>{loaderData.headTitle}</Head.Title>
          <Head.Meta property='og:title' content={pageSeoMeta['og:title'] ?? loaderData.headTitle} />
          <Head.Meta name='twitter:title' content={pageSeoMeta['twitter:title'] ?? loaderData.headTitle} />
          {loaderData.currentPageDescription && (
            <Head.Meta name='description' content={loaderData.currentPageDescription} />
          )}
          {site.config.description ? <Head.Meta name='holocron:site-description' content={site.config.description} /> : null}
          {pageOgDescription && <Head.Meta property='og:description' content={pageOgDescription} />}
          {pageTwitterDescription && <Head.Meta name='twitter:description' content={pageTwitterDescription} />}
          {pageKeywords && <Head.Meta name='keywords' content={pageKeywords} />}
          {loaderData.headRobots && <Head.Meta name='robots' content={loaderData.headRobots} />}
          <Head.Meta property='og:image' content={pageOgImage} />
          <Head.Meta name='twitter:image' content={pageTwitterImage} />
          <Head.Meta name='twitter:card' content={pageTwitterCard} />
        </Head>
        <EditorialPage mode={pageMode} bannerContent={bannerJsx} maxWidth={maxWidth}>
          <RenderNodes markdown={pageMdx} nodes={mdast.children} modules={modules} baseUrl={mdxBaseUrl} source={mdxSourcePath} />
        </EditorialPage>
      </>
    )
  }

  const aboveNodes = mdast.children.filter(isAboveNode)
  const contentChildren = mdast.children.filter((node) => !isAboveNode(node))
  const contentMdast: Root = { type: 'root', children: contentChildren }
  const mdastSections = buildSections(contentMdast, { enableAssistant: site.config.assistant.enabled })

  // Check if the page content already starts with a heading. If not, we
  // prepend a rendered <SectionHeading> component at the top of the first
  // section so every page always shows a visible title.
  //
  // We skip the injection entirely when the page leads with JSX content
  // (e.g. <Hero />, a custom component, or an expression). Authors who open
  // with JSX are crafting a custom layout and don't want an auto title pushed
  // above it. JSX nodes are mdxJsxFlowElement/mdxJsxTextElement (named tags)
  // and mdxFlowExpression/mdxTextExpression (`{...}` expressions).
  const firstContentNode = contentChildren.find(
    (n) => n.type !== 'mdxjsEsm' && n.type !== 'yaml',
  )
  const startsWithHeading = (() => {
    if (!firstContentNode) return false
    if (firstContentNode.type === 'heading') return true
    const nodeType: string = firstContentNode.type
    if (nodeType === 'mdxJsxFlowElement') {
      const name = Reflect.get(firstContentNode, 'name')
      return typeof name === 'string' && (/^h[1-6]$/.test(name) || name === 'Heading')
    }
    return false
  })()
  const startsWithJsx = (() => {
    if (!firstContentNode) return false
    const nodeType: string = firstContentNode.type
    return (
      nodeType === 'mdxJsxFlowElement' ||
      nodeType === 'mdxJsxTextElement' ||
      nodeType === 'mdxFlowExpression' ||
      nodeType === 'mdxTextExpression'
    )
  })()
  // Non-default page modes ("center") render a bespoke, centered layout
  // where an auto title would interfere with the author's design.
  // "wide" and "frame" alias the default layout, so they keep the auto H1.
  // "custom" is handled above (early return).
  const isCustomLayoutMode = pageMode === 'center'
  const shouldInjectH1 = !startsWithHeading && !startsWithJsx && !isCustomLayoutMode && !!loaderData.currentPageTitle

  // Extract import nodes (mdxjsEsm) from the full mdast so they can be
  // prepended to each section. Section splitting separates import statements
  // from the components that use them, so each SafeMdxRenderer instance
  // needs the imports to resolve components from the `modules` map.
  const importNodes = modules ? mdast.children.filter((node) => node.type === 'mdxjsEsm') : []

  // Compute required right-sidebar width from aside contents. When an
  // Aside holds components like RequestExample / ResponseExample it needs
  // more horizontal room than the 210px default.
  const allAsideNodes = mdastSections.flatMap((s) => s.asideNodes)
  const sidebarWidth = computeSidebarWidthFromAsideNodes(allAsideNodes, visit)

  const sections: EditorialSection[] = mdastSections.map((section, i) => {
    // Prepend import nodes so SafeMdxRenderer can resolve imported
    // components in every section, not just the one containing the imports.
    const contentNodes = importNodes.length > 0
      ? [...importNodes, ...section.contentNodes]
      : section.contentNodes
    const asideNodes = importNodes.length > 0 && section.asideNodes.length > 0
      ? [...importNodes, ...section.asideNodes]
      : section.asideNodes
    const aside =
      asideNodes.length > 0 ? (
        <RenderNodes markdown={pageMdx} nodes={asideNodes} modules={modules} baseUrl={mdxBaseUrl} source={mdxSourcePath} />
      ) : undefined
    const renderedContent = <RenderNodes markdown={pageMdx} nodes={contentNodes} modules={modules} baseUrl={mdxBaseUrl} source={mdxSourcePath} />
    // Prepend a rendered H1 from frontmatter title when the MDX doesn't
    // start with one. Only the first section gets the heading.
    const content = (shouldInjectH1 && i === 0) ? (
      <>
        <SectionHeading id={githubSlug(loaderData.currentPageTitle!)} level={1}>
          {loaderData.currentPageTitle}
        </SectionHeading>
        {renderedContent}
      </>
    ) : renderedContent
    return {
      content,
      aside,
      fullWidth: section.fullWidth,
      asideRowSpan: section.asideRowSpan,
    }
  })

  // Prepend import nodes to above nodes too, so imported components
  // (like <HeroSection />) used inside <Above> are resolvable.
  const aboveWithImports = importNodes.length > 0 && aboveNodes.length > 0
    ? [...importNodes, ...aboveNodes]
    : aboveNodes
  const above =
    aboveWithImports.length > 0 ? (
      <RenderNodes markdown={pageMdx} nodes={aboveWithImports} modules={modules} baseUrl={mdxBaseUrl} source={mdxSourcePath} />
    ) : undefined

  const gridGap = loaderData.currentPageFrontmatter?.gridGap

  // In dev mode, prepend a warning section showing safe-mdx render errors
  // (missing components, invalid expressions, etc.) so the user sees them
  // directly in the page without checking the console.
  if (devRenderErrors && devRenderErrors.length > 0) {
    const errorList = devRenderErrors.map((err) => {
      const loc = err.line ? `${mdxSourcePath}:${err.line}` : mdxSourcePath
      return `${loc} — ${err.message}`
    })
    sections.unshift({
      content: (
        <Warning title={`${devRenderErrors.length} MDX rendering ${devRenderErrors.length === 1 ? 'issue' : 'issues'}`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {errorList.map((msg, i) => (
              <CodeBlock key={i} lang='text' showLineNumbers={false}>{msg}</CodeBlock>
            ))}
          </div>
        </Warning>
      ),
    })
  }

  return (
    <>
      <Head>
        <Head.Title>{loaderData.headTitle}</Head.Title>
        <Head.Meta property='og:title' content={pageOgTitle} />
        <Head.Meta name='twitter:title' content={pageTwitterTitle} />
        {loaderData.currentPageDescription && (
          <>
            <Head.Meta name='description' content={loaderData.currentPageDescription} />
          </>
        )}
        {site.config.description ? <Head.Meta name='holocron:site-description' content={site.config.description} /> : null}
        {pageOgDescription && <Head.Meta property='og:description' content={pageOgDescription} />}
        {pageTwitterDescription && <Head.Meta name='twitter:description' content={pageTwitterDescription} />}
        {pageKeywords && <Head.Meta name='keywords' content={pageKeywords} />}
        {loaderData.headRobots && <Head.Meta name='robots' content={loaderData.headRobots} />}
        <Head.Meta property='og:image' content={pageOgImage} />
        <Head.Meta name='twitter:image' content={pageTwitterImage} />
        <Head.Meta name='twitter:card' content={pageTwitterCard} />
        {Object.entries(pageSeoMeta)
          .filter(([name]) => ![
            'robots',
            'og:title',
            'og:description',
            'og:image',
            'twitter:title',
            'twitter:description',
            'twitter:image',
            'twitter:card',
          ].includes(name))
          .map(([name, content]) => (
            name.startsWith('og:')
              ? <Head.Meta key={name} property={name} content={content} />
              : <Head.Meta key={name} name={name} content={content} />
          ))}
      </Head>
      <EditorialPage mode={pageMode} sections={sections} above={above} bannerContent={bannerJsx} sidebarWidth={sidebarWidth} gridGap={gridGap} />
    </>
  )
}

/** Render an error page when MDX parsing fails. */
function renderMdxParseErrorPage({
  slug,
  error,
  bannerJsx,
}: {
  slug: string
  error: MdxParseErrorInfo
  bannerJsx: React.ReactNode | undefined
}) {
  const locationStr = error.source
    ? `${error.source}:${error.line}${error.column ? ':' + error.column : ''}`
    : `line ${error.line}`

  return (
    <>
      <Head>
        <Head.Title>{`Parse Error - ${slug}`}</Head.Title>
      </Head>
      <EditorialPage
        sections={[{
          content: (
            <Danger title={`MDX parse error at ${locationStr}`}>
              <CodeBlock lang='text' showLineNumbers={false}>{error.reason}</CodeBlock>
            </Danger>
          ),
        }]}
        above={undefined}
        bannerContent={bannerJsx}
      />
    </>
  )
}

/** Runtime parse boundary for MDX loaded during dev/HMR. */
function parsePageMdx(markdown: string, source: string): HolocronMdxParseError | Root {
  try {
    return mdxParse(markdown)
  } catch (err) {
    const { line, column, reason } = extractParseErrorInfo(err)
    return new HolocronMdxParseError({ reason, line, column, source, mdxSource: markdown })
  }
}

function parseChatRequestBody(value: unknown): {
  modelMessages: Record<string, unknown>[]
  message: string
  currentSlug: string
  toolSchemas?: { name: string; description: string; inputJsonSchema: Record<string, unknown> }[]
  context?: Record<string, unknown>
} {
  if (!isRecord(value) || !Array.isArray(value.modelMessages) || typeof value.message !== 'string' || typeof value.currentSlug !== 'string') {
    throw new Error('Invalid chat request body')
  }

  return {
    modelMessages: value.modelMessages.filter(isRecord),
    message: value.message,
    currentSlug: value.currentSlug,
    toolSchemas: Array.isArray(value.toolSchemas) ? value.toolSchemas as any : undefined,
    context: isRecord(value.context) ? value.context : undefined,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

// ── Persistent chat sessions ─────────────────────────────────────────
// The session id is a 256-bit random bearer token (chs_ + 43 base64url
// chars). It is stored in a first-party cookie (JS-readable, not
// httpOnly) for the embedded docs site so the client can detect an
// existing session on page load and eagerly restore the conversation.
// The id is also mirrored to the widget via a `session` stream chunk so
// cross-origin ChatWidget embeds (which cannot receive our cookie) can
// keep it in localStorage and send it back as a header.

const CHAT_SESSION_COOKIE = 'holocron_chat'
const CHAT_SESSION_ID_RE = /^chs_[A-Za-z0-9_-]{43}$/

/** Read the chat session id from the request — explicit header first
 *  (cross-origin widget), then the first-party cookie (embedded mode). */
function readChatSessionId(request: Request): string | null {
  const header = request.headers.get('x-holocron-chat-session')
  if (header && CHAT_SESSION_ID_RE.test(header)) return header
  const cookie = request.headers.get('cookie') || ''
  const match = cookie.match(/(?:^|;\s*)holocron_chat=([^;\s]+)/)
  const value = match?.[1]
  if (value && CHAT_SESSION_ID_RE.test(value)) return value
  return null
}

/** Generate a new chat session id: 32 CSPRNG bytes as base64url (43 chars). */
function generateChatSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return 'chs_' + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/** Build the Set-Cookie value for the chat session (30 days).
 *  NOT httpOnly — the client reads document.cookie to detect an existing
 *  session on page load and eagerly restore the conversation.
 *  `Secure` is added on https only so plain-http dev servers keep working.
 *  Path is scoped to the site's base path so two holocron sites hosted on
 *  the same origin under different base paths keep separate sessions. */
function chatSessionCookie(args: {
  sessionId: string
  requestUrl: string
  maxAgeSeconds: number
  path: string
}): string {
  const secure = args.requestUrl.startsWith('https:') ? '; Secure' : ''
  return `${CHAT_SESSION_COOKIE}=${args.sessionId}; Path=${args.path}; Max-Age=${args.maxAgeSeconds}; SameSite=Lax${secure}`
}

function getToolArgs(input: unknown): Record<string, unknown> {
  return isRecord(input) ? input : {}
}

function getToolOutput(output: unknown): { stdout?: string; stderr?: string } {
  if (!isRecord(output)) {
    return {}
  }
  return {
    ...(typeof output.stdout === 'string' ? { stdout: output.stdout } : {}),
    ...(typeof output.stderr === 'string' ? { stderr: output.stderr } : {}),
  }
}

function isHolocronLoaderData(value: unknown): value is HolocronLoaderData {
  return isRecord(value) && isRecord(value.site) && typeof value.headTitle === 'string' && Array.isArray(value.currentHeadings)
}

/** Build the docs Spiceflow app. Await once at module load. */
export async function createHolocronApp(providers: HolocronProviders): Promise<AnySpiceflow> {
  const [config, { navigation, switchers, mdxParseErrors }, slugs] = await Promise.all([
    providers.getConfig(),
    providers.getNavigationData(),
    providers.getMdxSlugs(),
  ])
  const site: HolocronSiteData = {
    config,
    navigation,
    switchers,
    base: providers.base,
    icons: { icons: {} },
    origin: '', // Populated per-request in buildLoaderSite from request.url
  }
  const sharedIconRefs = collectIconRefs({ config, navigation })

  // Reconstruct runtime tab Map from serialized entries.
  const runtimeTabs = new Map<string, CustomTabProvider>()
  if (providers.runtimeTabs) {
    for (const { tabName, provider } of providers.runtimeTabs) {
      runtimeTabs.set(tabName, provider)
    }
  }

  // Start fetching GitHub star counts eagerly (don't await). The same
  // promise is reused for every loader response so it never blocks rendering.
  const githubStarsPromise = createGitHubStarsPromise(config)

  const firstPage = findFirstPage(site)
  const hrefToSlug = buildHrefToSlugMap(slugs)
  const absoluteUrlBase = (() => {
    const routeBase = withBaseRoute(site.base, '/')
    return routeBase === '/' ? '' : routeBase
  })()
  const hrefToMarkdownPath = (href: string) => {
    return href === '/' ? '/index.md' : `${href}.md`
  }

  function buildAgentDocsDirective(base: string): string {
    const basePath = base === '/' ? '' : base.replace(/\/$/, '')
    return `Agent-readable docs index: ${basePath}/llms.txt. Full docs in one file: ${basePath}/llms-full.txt. Download ${basePath}/docs.zip to grep all markdown files locally.`
  }

  function buildMarkdownSource(mdx: string): string {
    return `> ${buildAgentDocsDirective(site.base)}\n\n${stripVisibilityForAgents(mdx)}`
  }

  /** Resolve a root-relative href with the site base path. External and
   *  protocol-relative URLs pass through unchanged. */
  function resolveHrefWithBase(href: string): string {
    if (!href.startsWith('/') || /^\/\//.test(href)) return href
    return withBaseRoute(site.base, href)
  }

  /** Collect all external/navigation links from the site config, deduped by href.
   *  Used to surface navbar, anchor, and footer links in sitemap.xml and llms.txt
   *  so AI agents and crawlers can discover the same links humans see in the UI.
   *  Root-relative hrefs are resolved with the site base path so agents see the
   *  same URLs humans get in the browser. */
  function collectSiteLinks(): Array<{ label: string; href: string }> {
    const seen = new Set<string>()
    const links: Array<{ label: string; href: string }> = []
    function add(label: string, href: string) {
      const resolved = resolveHrefWithBase(href)
      if (!resolved || seen.has(resolved)) return
      seen.add(resolved)
      links.push({ label, href: resolved })
    }
    // Anchors (GitHub, Blog, etc. in tab bar or sidebar)
    for (const anchor of site.config.navigation.anchors) {
      if (anchor.hidden) continue
      add(anchor.anchor, anchor.href)
    }
    // Link-only dropdowns/products (visible in the header select)
    for (const dropdown of site.config.navigation.dropdowns) {
      if (dropdown.hidden) continue
      if (dropdown.href && !dropdown.navigation) {
        add(dropdown.dropdown, dropdown.href)
      }
    }
    // Navbar links
    for (const link of site.config.navbar.links) {
      add(link.label, link.href)
    }
    // Navbar primary CTA
    if (site.config.navbar.primary) {
      add(site.config.navbar.primary.label, site.config.navbar.primary.href)
    }
    // Footer socials
    const socialLabels: Record<string, string> = {
      x: 'X', github: 'GitHub', discord: 'Discord', twitter: 'Twitter',
      'x-twitter': 'X', linkedin: 'LinkedIn', youtube: 'YouTube',
      slack: 'Slack', facebook: 'Facebook', instagram: 'Instagram',
      'hacker-news': 'Hacker News', medium: 'Medium', telegram: 'Telegram',
      bluesky: 'Bluesky', threads: 'Threads', reddit: 'Reddit',
      podcast: 'Podcast', website: 'Website', 'earth-americas': 'Website',
    }
    for (const [platform, url] of Object.entries(site.config.footer.socials)) {
      if (!url) continue
      add(socialLabels[platform] ?? platform, url)
    }
    // Footer link columns
    for (const col of site.config.footer.links) {
      for (const item of col.items) {
        add(item.label, item.href)
      }
    }
    return links
  }

  /** Escape a string for use inside an XML comment. XML comments cannot
   *  contain `--` and must not end with `-`. */
  function escapeXmlComment(value: string): string {
    return value.replaceAll('--', '- -').replace(/-$/, '- ')
  }

  /** Escape a string for use as XML text content. */
  function escapeXmlText(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  }

  function buildLlmsTxt(origin: string): string {
    const basePath = withBaseRoute(site.base, '/') === '/' ? '' : withBaseRoute(site.base, '/').replace(/\/$/, '')
    const baseUrl = `${origin}${basePath}`
    const description = escapeMarkdownText(site.config.description || `Documentation and usage guide for ${site.config.name}.`)
    const pageLinks = collectAllPages(site.navigation)
      .filter((page) => isIndexablePage(page.frontmatter))
      .map((page) => `- [${escapeMarkdownText(page.title)}](${baseUrl}${hrefToMarkdownPath(page.href)})`)
      .join('\n')

    const siteLinks = collectSiteLinks()
    const linksSection = siteLinks.length > 0
      ? `\n\n## Links\n\n${siteLinks.map((l) => `- [${escapeMarkdownText(l.label)}](${l.href})`).join('\n')}`
      : ''

    return dedent`
      # ${escapeMarkdownText(site.config.name)}

      > ${description}

      ## Best way to inspect these docs

      Download all docs as markdown files and grep them locally:

      ${'```'}bash
      curl -L ${baseUrl}/docs.zip -o docs.zip
      unzip docs.zip -d docs
      grep -R "search term" docs/
      ${'```'}

      Use this when you need to search across the whole documentation set. The zip contains every page as a .md file.

      ## Page index

      You can also fetch individual markdown pages directly:

      ${pageLinks}
    ` + linksSection
  }

  async function buildLlmsFullTxt(origin: string): Promise<string> {
    const basePath = withBaseRoute(site.base, '/') === '/' ? '' : withBaseRoute(site.base, '/').replace(/\/$/, '')
    const baseUrl = `${origin}${basePath}`
    const description = escapeMarkdownText(site.config.description || `Documentation and usage guide for ${site.config.name}.`)

    const pages = collectAllPages(site.navigation).filter((page) => isIndexablePage(page.frontmatter))

    const header = dedent`
      # ${escapeMarkdownText(site.config.name)}

      > ${description}

      This file contains the full content of all documentation pages. For a compact index, see [llms.txt](${baseUrl}/llms.txt). To download all pages as a zip, use [docs.zip](${baseUrl}/docs.zip).
    `

    // Fetch all page sources in parallel (same pattern as docs.zip)
    const entries = await Promise.all(
      pages.map(async (page) => ({ page, mdx: await providers.getMdxSource(page.slug) })),
    )

    const sections: string[] = [header]
    for (const { page, mdx } of entries) {
      if (mdx === undefined) continue
      const body = stripLeadingFrontmatter(stripVisibilityForAgents(mdx))
      const pageSection = [
        '---',
        `title: ${yamlString(page.title)}`,
        `url: ${yamlString(`${baseUrl}${hrefToMarkdownPath(page.href)}`)}`,
        ...(page.description ? [`description: ${yamlString(page.description)}`] : []),
        '---',
        '',
        body,
      ].join('\n')
      sections.push(pageSection)
    }

    return sections.join('\n\n')
  }

  /** Quote a string for safe YAML frontmatter output. Only quotes when the
   *  value contains characters that would break unquoted YAML scalars. */
  function yamlString(value: string): string {
    if (/[:\n"'#{}[\],&*?|>!%@`]/.test(value) || value.startsWith(' ') || value.endsWith(' ')) {
      return JSON.stringify(value)
    }
    return value
  }

  /** Strip leading YAML frontmatter (---\n...\n---) from markdown so the
   *  generated llms-full.txt frontmatter doesn't duplicate the original. */
  function stripLeadingFrontmatter(markdown: string): string {
    const s = markdown.charCodeAt(0) === 0xfeff ? markdown.slice(1) : markdown
    const match = s.match(/^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)\r?\n?/)
    return match ? s.slice(match[0].length).trimStart() : markdown
  }

  async function buildLoaderSite(
    slug: string | undefined,
    effectiveConfig: HolocronConfig,
    origin: string,
  ): Promise<HolocronSiteData> {
    const pageIconRefs = slug ? await providers.getPageIconRefs(slug) : []
    const { resolveIconSvgs } = await import('./lib/resolve-icons.ts')

    // Merge runtime provider navigation into the site data so the sidebar
    // shows runtime pages (e.g. Outrank blog articles). On cache hit this
    // is just a Map lookup + shallow array clone.
    let effectiveSite = site
    if (runtimeTabs.size > 0) {
      const { tabs: mergedConfigTabs, pageTitles } = await mergeRuntimeNavigation(
        effectiveConfig.navigation.tabs,
        runtimeTabs,
        runtimeCache,
      )
      const mergedNavTabs = enrichRuntimeTabs(site.navigation, mergedConfigTabs, pageTitles)
      effectiveSite = {
        ...site,
        config: { ...effectiveConfig, navigation: { ...effectiveConfig.navigation, tabs: mergedConfigTabs } },
        navigation: mergedNavTabs,
      }
    }

    return {
      ...buildVisibleSiteData({ ...effectiveSite, config: effectiveConfig }),
      icons: resolveIconSvgs(dedupeIconRefs([...sharedIconRefs, ...pageIconRefs])).atlas,
      origin,
    }
  }

  /** Enrich runtime tab groups into NavTab format for the sidebar.
   *  Static tabs pass through unchanged. Runtime tabs get their groups
   *  rebuilt from the cached ConfigNavGroup[] into NavGroup[]. */
  function enrichRuntimeTabs(
    baseNav: Navigation,
    mergedConfigTabs: ConfigNavTab[],
    pageTitles: Record<string, string>,
  ): Navigation {
    return baseNav.map((navTab, i) => {
      const configTab = mergedConfigTabs[i]
      if (!configTab || !runtimeTabs.has(configTab.tab)) return navTab
      const groups = configTab.groups.map((g) => enrichRuntimeGroup(g, pageTitles))
      return { ...navTab, groups }
    })
  }

  function enrichRuntimeGroup(g: ConfigNavGroup, pageTitles: Record<string, string>): NavGroup {
    return {
      group: g.group,
      pages: g.pages.map((entry): NavPage | NavGroup => {
        if (typeof entry === 'string') {
          return {
            slug: entry,
            href: slugToHref(entry),
            title: pageTitles[entry] ?? titleFromSlug(entry),
            gitSha: '',
            headings: [],
            frontmatter: {},
          }
        }
        return enrichRuntimeGroup(entry, pageTitles)
      }),
    }
  }

  /** Derive a human-readable title from a slug. Used as a fallback when
   *  frontmatter title is missing. */
  function titleFromSlug(slug: string): string {
    const last = slug.split('/').pop() || slug
    return last.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function slugFromRequest(request: Request): string {
    const { pathname } = new URL(request.url)
    const strippedSlug = stripBaseFromSlug(pathname, site.base)
    const href = strippedSlug === '' ? '/' : `/${strippedSlug}`
    return hrefToSlug.get(href) ?? (strippedSlug === '' ? 'index' : strippedSlug)
  }

  // Same function reference is registered for every slug AND the
  // wildcard. Do NOT set `response.status = 404` here — the wildcard
  // loader also fires for user-owned routes, which would poison their
  // responses. The 404 status is set in `wildcardLayoutFn` only when
  // spiceflow passes `children === null` (true 404 case).
  const loaderFn = async ({ request }: { request: Request }): Promise<HolocronLoaderData> => {
    const slug = slugFromRequest(request)
    const showPanel = shouldShowConfigPanel(request)
    const isPreview = hasPreviewProps(request.url)
    const origin = new URL(request.url).origin

    // Run page lookup, MDX source check, and config override fetch in parallel.
    // The override fetch only does work when the cookie is present; otherwise
    // it returns the base config immediately (zero overhead).
    const [currentPage, hasMdx, effectiveConfig] = await Promise.all([
      findPageBySlug({ nav: site.navigation, slug, getMdxSource: providers.getMdxSource }),
      providers.getMdxSource(slug),
      resolveConfigOverride(request, site.config, normalizeConfig),
    ])

    // Use enriched site (with runtime tab pages populated) for tab
    // resolution so the tab bar highlights correctly for all pages,
    // including runtime provider pages that aren't in the static nav.
    const enrichedSite = await buildLoaderSite(slug, effectiveConfig, origin)

    if (!currentPage || !hasMdx) {
      return {
        site: enrichedSite,
        currentPageHref: undefined,
        currentPageTitle: undefined,
        currentPageDescription: undefined,
        currentHeadings: [],
        ancestorGroupKeys: firstPage ? collectAncestorGroupKeys(site, firstPage.href) : [],
        activeTabHref: resolveActiveTabHref(enrichedSite, '/' + slug),
        activeVersionHref: resolveActiveVersionHref(enrichedSite, '/' + slug),
        activeDropdownHref: resolveActiveDropdownHref(enrichedSite, '/' + slug),
        notFoundPath: '/' + slug,
        headTitle: `Page not found — ${effectiveConfig.name}`,
        headRobots: 'noindex',
        currentPageFrontmatter: undefined,
        showConfigPanel: showPanel,
        hasPreviewProps: isPreview,
        githubStars: githubStarsPromise,
      }
    }

    return {
      site: enrichedSite,
      currentPageHref: currentPage.href,
      currentPageTitle: currentPage.title,
      currentPageDescription: currentPage.description ?? effectiveConfig.description,
      currentHeadings: currentPage.headings,
      ancestorGroupKeys: collectAncestorGroupKeys(site, currentPage.href),
      activeTabHref: resolveActiveTabHref(enrichedSite, currentPage.href),
      activeVersionHref: resolveActiveVersionHref(enrichedSite, currentPage.href),
      activeDropdownHref: resolveActiveDropdownHref(enrichedSite, currentPage.href),
      notFoundPath: undefined,
      headTitle: `${currentPage.title} — ${effectiveConfig.name}`,
      headRobots: getPageRobots(currentPage.frontmatter),
      currentPageFrontmatter: currentPage.frontmatter,
      showConfigPanel: showPanel,
      hasPreviewProps: isPreview,
      githubStars: githubStarsPromise,
    }
  }

  // One captured function reference per slug so the server produces
  // identically-shaped element trees → React preserves client identity
  // across navigations.
  function renderFullShell({
    children,
    request,
    loaderData,
  }: {
    children: React.ReactNode
    request: Request
    loaderData: HolocronLoaderData
  }) {
    // Use the loader's site data which includes any config overrides
    // from the holo-config-override cookie. The closure `site` is the
    // base config; `loaderData.site.config` is the merged effective config.
    const effectiveConfig = loaderData.site.config

    const cookies = parseCookies(request.headers.get('cookie') || '')
    const cookieTheme = effectiveConfig.appearance.strict
      ? null
      : (cookies['color-theme'] === 'light' || cookies['color-theme'] === 'dark' ? cookies['color-theme'] : null)
    const isDark =
      cookieTheme === 'dark' ||
      (!cookieTheme && effectiveConfig.appearance.default === 'dark')

    const isNotFound = children === null
    const bannerJsx = getBannerJsx(loaderData.site, request)
    const notFoundContent = (
      <EditorialPage bannerContent={bannerJsx}>
        <NotFound
          path={loaderData?.notFoundPath ?? '/'}
          homeHref={firstPage?.href || '/'}
        />
      </EditorialPage>
    )

    return (
      <html
        lang='en'
        className={isDark ? 'dark' : undefined}
        data-default-theme={effectiveConfig.appearance.default}
        suppressHydrationWarning
        {...(effectiveConfig.appearance.strict ? { 'data-strict-theme': '' } : {})}
      >
        <SiteHead
          config={effectiveConfig}
          titleOverride={isNotFound ? (loaderData?.headTitle ?? `Page not found — ${effectiveConfig.name}`) : undefined}
        />
        {isNotFound && (
          <Head>
            <Head.Meta name='robots' content='noindex' />
          </Head>
        )}
        <body>
          {/* Blocking theme script — runs before any content is painted to set
              .dark class from the color-theme cookie. Prevents flash of wrong
              theme on reload. The server also sets className on <html> from the
              cookie, but this script handles streaming race conditions where the
              browser renders before the server class attribute arrives. */}
          <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
          <GtmNoscript integrations={effectiveConfig.integrations} />
          <div className='sr-only'>{buildAgentDocsDirective(site.base)}</div>
          <ProgressBar color='var(--primary)' />
          {children ?? notFoundContent}
        </body>
      </html>
    )
  }

  const layoutFn = async ({ children, request, response, loaderData: rawLoaderData }: { children?: React.ReactNode; request: Request; response: { headers: Headers }; loaderData: unknown }) => {
    if (!isHolocronLoaderData(rawLoaderData)) {
      throw new Error('Holocron loader data missing in layout')
    }
    const cacheControl = rawLoaderData.currentPageFrontmatter?.['cache-control']
    if (cacheControl) {
      response.headers.set('cache-control', cacheControl)
    }
    return renderFullShell({ children: children ?? null, request, loaderData: rawLoaderData })
  }

  // Wildcard fallback. `children === null` means no `.page()` matched
  // → real 404. Otherwise a more specific layout is nested; return a
  // Fragment so exactly one <html> stays at the root.
  //
  // Root redirect lives here (not as a `.get('/')`) so parent-app routes
  // take priority when holocron is mounted as a child.
  const wildcardLayoutFn = async ({ children, request, response, loaderData: rawLoaderData }: { children?: React.ReactNode; request: Request; response: { status?: number; headers: Headers }; loaderData: unknown }) => {
    if (!isHolocronLoaderData(rawLoaderData)) {
      throw new Error('Holocron loader data missing in wildcard layout')
    }
    if (children === null || children === undefined) {
      // Redirect `/` (or base route) to the first doc page when no
      // index.mdx exists. This only fires if no parent route handled `/`.
      if (needsRootRedirect) {
        const url = new URL(request.url)
        const rootRoutes = new Set(['/', withBaseRoute(site.base, '/')])
        const pathname = url.pathname.replace(/\/+$/, '') || '/'
        if (rootRoutes.has(pathname)) {
          const dest = new URL(withBaseRoute(site.base, firstPage!.href), request.url)
          dest.search = url.search
          dest.hash = url.hash
          throw redirect(dest.href, { status: 307 })
        }
      }
      response.status = 404
      return renderFullShell({ children: null, request, loaderData: rawLoaderData })
    }
    const cacheControl = rawLoaderData.currentPageFrontmatter?.['cache-control']
    if (cacheControl) {
      response.headers.set('cache-control', cacheControl)
    }
    return <>{children}</>
  }

  // Lazy glob for resolving MDX import statements at render time.
  const lazyGlob = providers.getModules?.()

  function makePageHandler(slug: string, pageHref: string) {
    return async ({ loaderData: rawLoaderData, request }: { loaderData: unknown; request: Request }) => {
      if (!isHolocronLoaderData(rawLoaderData)) {
        throw new Error('Holocron loader data missing in page route')
      }
      const loaderData = rawLoaderData
      const effectiveConfig = loaderData.site.config
      const bannerJsx = getBannerJsx(loaderData.site, request)
      const requestUrl = new URL(request.url)
      const faviconUrl = effectiveConfig.favicon.light || effectiveConfig.favicon.dark
      const ogImageUrl = buildOgImageUrl({
        title: loaderData.currentPageTitle ?? effectiveConfig.name,
        description: loaderData.currentPageDescription ?? effectiveConfig.description,
        iconUrl: faviconUrl ? new URL(faviconUrl, request.url).toString() : undefined,
        siteName: effectiveConfig.name,
        pageLabel: `${requestUrl.host}${loaderData.currentPageHref ?? pageHref}`,
      })
      const pageMdx = await providers.getMdxSource(slug)

      // Check for parse errors from build-time sync. Show error overlay
      // instead of a cryptic 500 or "content missing" crash.
      const parseError = mdxParseErrors?.[slug]
      if (pageMdx === undefined && parseError) {
        return renderMdxParseErrorPage({ slug, error: parseError, bannerJsx })
      }
      if (pageMdx === undefined) {
        throw new Error(`MDX content missing for registered page slug "${slug}"`)
      }

      // Resolve MDX import statements against the lazy glob.
      // Only loads modules that the current page actually imports.
      // Parse the mdast once and share it with renderMdxPage to avoid a duplicate parse.
      const pageSource = slug === 'index' ? '/' : `/${slug}`
      const preParsedMdast = parsePageMdx(pageMdx, pageSource)
      if (preParsedMdast instanceof Error) return renderMdxParseErrorPage({ slug, error: preParsedMdast, bannerJsx })

      const modules = lazyGlob && Object.keys(lazyGlob).length > 0
        ? await resolveModules({
            glob: lazyGlob,
            mdast: preParsedMdast,
            baseUrl: (providers.pagesDirPrefix || './') + (slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/') + 1) : ''),
          })
        : undefined

      // In dev mode, pre-validate the MDX to collect safe-mdx render errors
      // (missing components, invalid expressions, etc.) so we can show them
      // in the page. Production builds skip this entirely (tree-shaken).
      let devRenderErrors: SafeMdxError[] | undefined
      if (import.meta.env.DEV) {
        const slugDir = slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/') + 1) : ''
        const mdxBaseUrl = (providers.pagesDirPrefix || './') + slugDir
        const visitor = new MdastToJsx({
          markdown: pageMdx,
          mdast: preParsedMdast,
          components: mdxComponents,
          renderNode,
          modules,
          baseUrl: mdxBaseUrl,
        })
        visitor.run()
        if (visitor.errors.length > 0) devRenderErrors = visitor.errors
      }

      return renderMdxPage({ site: loaderData.site, slug, pageMdx, loaderData, bannerJsx, ogImageUrl, requestUrl, modules, pagesDirPrefix: providers.pagesDirPrefix, preParsedMdast, devRenderErrors })
    }
  }

  // `let app` because spiceflow's chain types don't survive the loop.
  let app: AnySpiceflow = new Spiceflow()

  // Agent redirect: when Accept includes text/markdown, 302 to .md URL.
  // No UA sniffing — only fires when the client explicitly asks for markdown.
  app = app.use(({ request }: { request: Request }) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return
    if (!isAgentRequest(request)) return

    const url = new URL(request.url)
    let pathname = url.pathname
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }
    if (pathname.endsWith('.md') || pathname.endsWith('.mdx') || pathname.endsWith('.xml') || pathname.endsWith('.zip') || pathname.startsWith('/holocron-api/') || pathname.includes('/.well-known/')) return

    const baseRoute = withBaseRoute(site.base, '/')
    const normalizedBase = baseRoute === '/' ? '' : baseRoute
    const hasBase = !!normalizedBase && (pathname === normalizedBase || pathname.startsWith(normalizedBase + '/'))
    const stripped = hasBase ? pathname.slice(normalizedBase.length) || '/' : pathname
    if (!hrefToSlug.has(stripped)) return

    const mdPath = hrefToMarkdownPath(stripped)
    return Response.redirect(new URL(withBaseRoute(site.base, mdPath) + url.search, url.origin).href, 302)
  })

  // Config redirects (spiceflow's trie router handles specificity)
  for (const rule of deduplicateRedirects(site.config.redirects)) {
    for (const source of new Set([rule.source, withBaseRoute(site.base, rule.source)])) {
      app = app.get(source, ({ request, params }: { request: Request; params: Record<string, string> }) => {
        const url = new URL(request.url)
        const allParams = { ...params, splat: params['*'] ?? '' }
        let dest = interpolateDestination(rule.destination, allParams)
        if (!dest.includes('?') && url.search) dest += url.search
        throw redirect(dest, { status: rule.permanent ? 301 : 302 })
      })
    }
  }

  // Root redirect when no explicit index page is defined.
  // Registered as a middleware so it does NOT block parent-app routes when
  // holocron is mounted as a child via `.use(holocronApp)`. A `.get('/')`
  // would register an explicit route that competes with the parent's own
  // `/` page, preventing users from owning the root while serving docs
  // under a subfolder like `/docs/*`.
  //
  // As a middleware, the parent's routes are checked first. Only if no
  // parent route handled `/` does this fire and redirect.
  const needsRootRedirect = !slugs.includes('index') && !!firstPage

  // /sitemap.xml
  for (const sitemapRoute of new Set(['/sitemap.xml', withBaseRoute(site.base, '/sitemap.xml')])) {
    app = app.get(sitemapRoute, ({ request }: { request: Request }) => {
      const url = new URL(request.url)
      const hrefs = collectAllPages(site.navigation)
        .filter((page) => isIndexablePage(page.frontmatter))
        .map((page) => page.href)
      const urls = hrefs
        .map((href: string) => `  <url><loc>${url.origin}${withBaseRoute(site.base, href)}</loc></url>`)
        .join('\n')
      const siteLinks = collectSiteLinks()
      const linkComments = siteLinks.map((l) => `<!-- Link: ${escapeXmlComment(`${l.label} ${l.href}`)} -->`)
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!-- To get the raw markdown content of any page, append .md to the URL. -->',
        `<!-- Example: ${url.origin}${withBaseRoute(site.base, '/getting-started.md')} -->`,
        `<!-- To download all docs as a zip of .md files: ${url.origin}${withBaseRoute(site.base, '/docs.zip')} -->`,
        ...linkComments,
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        urls,
        '</urlset>',
      ].join('\n')
      return new Response(xml, {
        headers: {
          'content-type': 'application/xml; charset=utf-8',
          'cache-control': 's-maxage=3600, stale-while-revalidate=86400',
          'x-content-type-options': 'nosniff',
        },
      })
    })
  }

  // /llms.txt — primary agent index. Keep docs.zip first because agents can
  // grep the whole markdown corpus locally before reading specific pages.
  for (const llmsTxtRoute of new Set(['/llms.txt', withBaseRoute(site.base, '/llms.txt')])) {
    app = app.get(llmsTxtRoute, ({ request }: { request: Request }) => {
      const url = new URL(request.url)
      return new Response(buildLlmsTxt(url.origin), {
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'cache-control': 's-maxage=300, stale-while-revalidate=86400',
          'x-content-type-options': 'nosniff',
        },
      })
    })
  }

  // /llms-full.txt — full content of every page in one file, separated by frontmatter blocks.
  // Pages are in docs.json navigation order so the output mirrors the site structure.
  for (const llmsFullRoute of new Set(['/llms-full.txt', withBaseRoute(site.base, '/llms-full.txt')])) {
    app = app.get(llmsFullRoute, async ({ request }: { request: Request }) => {
      const url = new URL(request.url)
      return new Response(await buildLlmsFullTxt(url.origin), {
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'cache-control': 's-maxage=300, stale-while-revalidate=86400',
          'x-content-type-options': 'nosniff',
        },
      })
    })
  }

  if (!slugs.includes('index') && firstPage) {
    const firstMarkdownPath = hrefToMarkdownPath(firstPage.href)
    for (const route of new Set(['/index.md', '/index.mdx', withBaseRoute(site.base, '/index.md'), withBaseRoute(site.base, '/index.mdx')])) {
      app = app.get(route, ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const dest = new URL(withBaseRoute(site.base, firstMarkdownPath), url.origin)
        dest.search = url.search
        dest.hash = url.hash
        return Response.redirect(dest.href, 307)
      })
    }
  }

  // Per-page .md/.mdx routes (both serve the same raw markdown)
  for (const slug of slugs) {
    const href = slugToHref(slug)
    const mdPath = hrefToMarkdownPath(href)
    const mdxPath = href === '/' ? '/index.mdx' : `${href}.mdx`

    for (const route of new Set([mdPath, mdxPath, withBaseRoute(site.base, mdPath), withBaseRoute(site.base, mdxPath)])) {
      app = app.get(route, async () => {
        const mdx = await providers.getMdxSource(slug)
        if (mdx === undefined) {
          return new Response('Not found', { status: 404 })
        }
        const frontmatter = parsePageFrontmatter(mdx)
        return new Response(buildMarkdownSource(mdx), {
          headers: {
            'content-type': 'text/markdown; charset=utf-8',
            'cache-control': frontmatter['cache-control'] ?? 's-maxage=300, stale-while-revalidate=86400',
            'x-content-type-options': 'nosniff',
            'x-robots-tag': 'noindex, nofollow',
          },
        })
      })
    }
  }

  // /docs.zip — whole site in one download for agents
  for (const docsZipRoute of new Set(['/docs.zip', withBaseRoute(site.base, '/docs.zip')])) {
    app = app.get(docsZipRoute, async () => {
      const files: Record<string, Uint8Array> = {}
      const pages = await Promise.all(slugs.map(async (slug) => {
        const mdx = await providers.getMdxSource(slug)
        return mdx === undefined ? undefined : [slug, mdx] as const
      }))
      for (const page of pages) {
        if (!page) continue
        const [slug, mdx] = page
        files[slug + '.md'] = strToU8(buildMarkdownSource(mdx))
      }

      const zipped = zipSync(files)
      const zipBody = new Uint8Array(zipped.byteLength)
      zipBody.set(zipped)
      return new Response(zipBody.buffer, {
        headers: {
          'content-type': 'application/zip',
          'content-disposition': 'attachment; filename="docs.zip"',
          'cache-control': 's-maxage=300, stale-while-revalidate=86400',
          'x-content-type-options': 'nosniff',
        },
      })
    })
  }

  // /.well-known/agent-skills/ and /.well-known/skills/ — agent skill discovery
  // Follows the agent-skills 0.2.0 discovery spec (RFC 8615 extension by Cloudflare)
  // and the legacy /.well-known/skills/ format for backward compatibility.
  // Slugify to kebab-case, 1-64 chars, lowercase alphanumeric + hyphens.
  // Falls back to 'docs' for non-Latin names that produce empty slugs.
  const skillName = (() => {
    const slug = site.config.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)
      .replace(/-+$/g, '')
    return slug || 'docs'
  })()
  const skillDescription = site.config.description
    ? site.config.description.slice(0, 1024)
    : `Documentation and usage guide for ${site.config.name}. Use when working with ${site.config.name} APIs, SDKs, or integrations.`

  const exampleMdPath = firstPage
    ? hrefToMarkdownPath(firstPage.href)
    : '/index.md'

  function generateSkillMd(origin: string, base: string): string {
    const baseUrl = base === '/' ? origin : `${origin}${base.replace(/\/+$/, '')}`
    return dedent`
      ---
      name: ${skillName}
      description: >
        ${skillDescription}
      ---

      # ${site.config.name}
      ${site.config.description ? '\n' + site.config.description + '\n' : ''}
      ## Browsing docs

      Fetch the sitemap to discover all available pages:

      ${'```'}bash
      curl ${baseUrl}/sitemap.xml
      ${'```'}

      Append \`.md\` to any page URL to get the raw markdown:

      ${'```'}bash
      curl ${baseUrl}${exampleMdPath}
      ${'```'}

      ## Downloading all docs locally

      Download all documentation as a zip of markdown files for local search and grep:

      ${'```'}bash
      curl -o docs.zip ${baseUrl}/docs.zip
      unzip docs.zip -d docs
      grep -r "search term" docs/
      ${'```'}

      This is the fastest way to search across all pages locally.
    `
  }

  // Compute sha256 digest for the v0.2.0 spec (lazy, cached per origin)
  let cachedSkillDigest: { origin: string; digest: string } | undefined
  async function getSkillDigest(origin: string, base: string): Promise<string> {
    if (cachedSkillDigest?.origin === origin) return cachedSkillDigest.digest
    const content = generateSkillMd(origin, base)
    const encoded = new TextEncoder().encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const digest = 'sha256:' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
    cachedSkillDigest = { origin, digest }
    return digest
  }

  // v0.2.0 agent-skills index
  for (const route of new Set(['/.well-known/agent-skills/index.json', withBaseRoute(site.base, '/.well-known/agent-skills/index.json')])) {
    app = app.get(route, async ({ request }: { request: Request }) => {
      const url = new URL(request.url)
      const digest = await getSkillDigest(url.origin, site.base)
      const index = {
        $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
        skills: [
          {
            name: skillName,
            type: 'skill-md',
            description: skillDescription,
            url: `${skillName}/SKILL.md`,
            digest,
          },
        ],
      }
      return new Response(JSON.stringify(index), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 's-maxage=3600, stale-while-revalidate=86400',
          'x-content-type-options': 'nosniff',
        },
      })
    })
  }

  // Legacy skills index
  for (const route of new Set(['/.well-known/skills/index.json', withBaseRoute(site.base, '/.well-known/skills/index.json')])) {
    app = app.get(route, () => {
      const index = {
        skills: [
          {
            name: skillName,
            description: skillDescription,
            files: ['SKILL.md'],
          },
        ],
      }
      return new Response(JSON.stringify(index), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 's-maxage=3600, stale-while-revalidate=86400',
          'x-content-type-options': 'nosniff',
        },
      })
    })
  }

  // Serve SKILL.md at both well-known paths
  for (const route of new Set([
    `/.well-known/agent-skills/${skillName}/SKILL.md`,
    withBaseRoute(site.base, `/.well-known/agent-skills/${skillName}/SKILL.md`),
    `/.well-known/skills/${skillName}/SKILL.md`,
    withBaseRoute(site.base, `/.well-known/skills/${skillName}/SKILL.md`),
  ])) {
    app = app.get(route, ({ request }: { request: Request }) => {
      const url = new URL(request.url)
      const content = generateSkillMd(url.origin, site.base)
      return new Response(content, {
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'cache-control': 's-maxage=3600, stale-while-revalidate=86400',
          'x-content-type-options': 'nosniff',
        },
      })
    })
  }

  // /holocron-api/ai-logo/:text — proxy AI-generated logos from holocron.so to avoid
  // cross-origin requests and improve latency via Cache API caching.
  for (const logoRoute of new Set(['/holocron-api/ai-logo/:text', withBaseRoute(site.base, '/holocron-api/ai-logo/:text')])) {
    app = app.get(logoRoute, async ({ params, request }: { params: Record<string, string>; request: Request }) => {
      const text = params.text || ''
      if (!text) return new Response('Missing logo text', { status: 400 })

      const upstreamUrl = holocronUrl(`/api/ai-logo/${encodeURIComponent(text)}`)

      // Try Cache API first (available on Cloudflare Workers; no-op in dev).
      // Gracefully degrade if Cache API throws (e.g. Dynamic Workers hosting).
      let cache: Cache | undefined
      const cacheKey = new Request(upstreamUrl)
      try {
        cache = typeof caches !== 'undefined' ? await caches.open('ai-logo') : undefined
        if (cache) {
          const cached = await cache.match(cacheKey)
          if (cached) {
            // Evict stale SVG fallbacks cached by older code
            const cachedType = cached.headers.get('content-type') || ''
            if (cachedType.includes('svg')) {
              await cache.delete(cacheKey).catch(() => {})
            } else {
              return cached
            }
          }
        }
      } catch {
        cache = undefined
      }

      const upstream = await fetch(upstreamUrl, {
        headers: { accept: request.headers.get('accept') || 'image/*' },
      })
      if (!upstream.ok) {
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { 'content-type': upstream.headers.get('content-type') || 'text/plain' },
        })
      }

      const body = await upstream.arrayBuffer()
      const contentType = upstream.headers.get('content-type') || 'image/jpeg'
      const isFallback = contentType.includes('svg')

      const response = new Response(body, {
        headers: {
          'content-type': contentType,
          // Never cache the SVG fallback — it's a temporary placeholder until
          // the AI model generates a real JPEG. Caching it would prevent retries.
          'cache-control': isFallback ? 'no-store' : 's-maxage=31536000, immutable',
        },
      })

      // Only store real images in Cache API, never fallback SVGs
      if (cache && !isFallback) {
        try {
          await cache.put(cacheKey, response.clone())
        } catch {
          // Cache API unavailable; skip silently
        }
      }

      return response
    })
  }

  // /holocron-api/chat — only registered when assistant is enabled
  // CORS headers for cross-origin widget use. x-holocron-chat-session carries
  // the persistent session id for widget embeds that cannot use our cookie.
  const chatCorsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-holocron-chat-session',
  }
  const CHAT_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
  // Cookie path + site-key suffix scoped to the base path so multiple
  // holocron sites on one origin (different base paths) don't share sessions.
  const chatSessionCookiePath = withBaseRoute(site.base, '/')
  const chatSiteKey = (request: Request) =>
    `${new URL(request.url).host}${chatSessionCookiePath === '/' ? '' : chatSessionCookiePath}`
  for (const chatRoute of new Set(['/holocron-api/chat', withBaseRoute(site.base, '/holocron-api/chat')])) {
    // OPTIONS preflight for CORS
    app = app.options(chatRoute, async () => new Response(null, { status: 204, headers: chatCorsHeaders }))
    if (!site.config.assistant.enabled) {
      app = app.post(chatRoute, async () => new Response('Assistant is disabled', { status: 404, headers: chatCorsHeaders }))
      continue
    }
    app = app.post(chatRoute, async ({ request }: { request: Request }) => {
      const body = parseChatRequestBody(await request.json())

      // Resolve or mint the persistent session id. Newly minted ids are
      // announced to the client via a `session` stream chunk (for the
      // cross-origin widget) and set as a first-party httpOnly cookie
      // (for the embedded docs site).
      const existingSessionId = readChatSessionId(request)
      const sessionId = existingSessionId ?? generateChatSessionId()

      // Build system prompt
      const allPages = collectAllPages(site.navigation)
      const pageIndex = allPages
        .map((p) => `<page path="/docs/${p.slug}.mdx" href="${p.href}" title="${p.title}" />`)
        .join('\n')
      const currentPageSlug = slugs.find((slug) => {
        const href = slugToHref(slug)
        return href === body.currentSlug || slug === body.currentSlug
      })
      const currentPage = currentPageSlug
        ? allPages.find((p) => p.slug === currentPageSlug)
        : undefined
      const currentPageMdx = currentPageSlug
        ? ((await providers.getMdxSource(currentPageSlug)) ?? '')
        : ''

      const systemPrompt = dedent`
        You are a documentation assistant for ${site.config.name || 'this site'}.

        ## Tone
        - Behave like a real human in a messenger app: short, direct, casual
        - Be extremely concise; no fluff, no filler, no repeating the question back
        - Use bullet points over paragraphs
        - Only include code examples when specifically asked or when a short snippet is the fastest way to answer

        ## Answering
        - Link to docs pages instead of explaining things already documented
        - When a docs page covers the topic, just link it with a one-line summary
        - Use the bash tool to search and read docs files before answering
        - First grep for likely terms: grep -rn "term" /docs/
        - Then read the best match: cat /docs/slug.mdx

        ## Links
        - Each page in the <pages> index has an href attribute — always use that exact href for links
        - Render markdown links with absolute paths starting with /
        - If you find a file via bash (e.g. /docs/foo/bar.mdx), look up its href in the <pages> index
        - If not in the index, convert manually: remove /docs/ prefix, remove .mdx extension, remove trailing /index, then prepend /
        - NEVER include the site origin, base URL, or domain in links
        - NEVER use bare relative paths like "docs/foo" without a leading slash

        ## Formatting
        - NEVER use XML <think> tags or any thinking/reasoning tags in your response; output only the final answer directly
        - NEVER wrap the entire response in a single code block

        <current_page>
        <path>${body.currentSlug}</path>
        <title>${currentPage?.title || ''}</title>
        <description>${currentPage?.description || ''}</description>
        <content>
        ${currentPageMdx.slice(0, 4000)}
        </content>
        </current_page>

        <pages>
        ${pageIndex}
        </pages>
        ${body.context && Object.keys(body.context).length > 0
          ? `\n<user_context format="json">\n${escapeXmlText(JSON.stringify(body.context, null, 2))}\n</user_context>`
          : ''
        }
        ${body.toolSchemas?.length
          ? `\n## Client tools\nYou have access to these additional tools that run in the user's browser:\n${body.toolSchemas.map((t: any) => `- **${t.name}**: ${t.description}`).join('\n')}\n\nAlways prefer client tools over the bash tool when both could accomplish the task. Client tools interact directly with the page the user is on. Only fall back to bash for tasks client tools cannot handle, like searching or reading documentation files.`
          : ''
        }
      `

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...body.modelMessages,
        // On initial submit, message is the user's text. On re-POST after
        // client tool execution, message is empty and modelMessages already
        // contains the full conversation history including tool results.
        ...(body.message ? [{ role: 'user' as const, content: body.message }] : []),
      ]

      let textBuffer = ''
      const toolNames = new Map<string, string>()

      /** Yield any buffered text as a rendered part. Called on text-end AND
       *  before tool parts: some providers only close the text part (text-end)
       *  after the tool input chunk, so without this flush a tool call that
       *  the model announced with text would render ABOVE that text. */
      function flushTextBuffer() {
        if (!textBuffer.trim()) {
          textBuffer = ''
          return null
        }
        // Shared with the session restore path (chat-restore.tsx) so
        // restored and streamed messages render identically.
        const part = renderMarkdownTextPart(textBuffer)
        textBuffer = ''
        return part
      }

      /** Convert a UIMessageStream-like async iterable into ChatPart stream. */
      async function* convertChunksToParts(uiStream: AsyncIterable<any>) {
        for await (const chunk of uiStream) {
          if (chunk.type === 'notice') {
            yield chunk
            continue
          }

          // AI-generated conversation title (first turn) — forwarded so the
          // widget can label this session in its local session list.
          if (chunk.type === 'title') {
            yield chunk
            continue
          }

          if (chunk.type === 'text-delta') {
            textBuffer += chunk.delta
            continue
          }

          if (chunk.type === 'text-end') {
            const text = flushTextBuffer()
            if (text) yield text
            continue
          }

          if (chunk.type === 'tool-input-available') {
            const text = flushTextBuffer()
            if (text) yield text
            toolNames.set(chunk.toolCallId, chunk.toolName)
            yield {
              type: 'tool-call' as const,
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              args: getToolArgs(chunk.input),
            }
            continue
          }

          if (chunk.type === 'tool-output-available') {
            const text = flushTextBuffer()
            if (text) yield text
            const rawOutput = getToolOutput(chunk.output)
            yield {
              type: 'tool-result' as const,
              toolCallId: chunk.toolCallId,
              toolName: toolNames.get(chunk.toolCallId) || 'bash',
              output: (rawOutput.stdout || '').slice(0, 500),
              ...(rawOutput.stderr ? { error: rawOutput.stderr } : {}),
            }
            continue
          }

          if (chunk.type === 'model-messages') {
            yield {
              type: 'model-messages' as const,
              messages: [
                ...body.modelMessages,
                ...(body.message ? [{ role: 'user', content: body.message }] : []),
                ...chunk.messages,
              ],
            }
            continue
          }
        }
      }

      async function* generateParts() {
        // Announce a freshly minted session id so the widget can persist it
        // (localStorage in cross-origin mode; the cookie covers embedded mode).
        if (!existingSessionId) {
          yield { type: 'session' as const, sessionId }
        }
        // Forward to the Holocron chat gateway (holocron.so or HOLOCRON_URL override).
        const chatUrl = new URL(holocronUrl('/api/chat'))
        const useInlineDocs = isLocalhostUrl(request.url)
        const apiKey = getHolocronApiKey()
        const chatFetch = createSpiceflowFetch<any>(chatUrl.origin, {
          headers: {
            ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
            // Site key for session scoping when unauthenticated. Includes the
            // base path so co-hosted holocron sites stay isolated.
            'x-holocron-site': chatSiteKey(request),
          },
        })
        const docsPayload = useInlineDocs
          ? {
              docsPages: {
                ...Object.fromEntries(
                  (await Promise.all(slugs.map(async (slug) => {
                    const mdx = await providers.getMdxSource(slug)
                    return mdx === undefined ? undefined : [`/docs/${slug}.mdx`, buildMarkdownSource(mdx)] as const
                  }))).filter((page) => page !== undefined),
                ),
              },
            }
          : { docsZipUrl: new URL(withBaseRoute(site.base, '/docs.zip'), request.url).toString() }
        const uiStream = await chatFetch('/api/chat', {
          method: 'POST',
          body: {
            messages,
            ...docsPayload,
            skillUrls: [],
            pageSlug: body.currentSlug,
            sessionId,
            ...(body.toolSchemas?.length ? { toolSchemas: body.toolSchemas } : {}),
          },
        })

        if (uiStream instanceof Error) {
          yield { type: 'tool-result' as const, toolCallId: 'holocron-chat', toolName: 'holocron-chat', output: '', error: uiStream.message }
          return
        }

        yield* convertChunksToParts(uiStream)
      }

      const response = await encodeFederationPayload({ stream: generateParts() })
      for (const [key, value] of Object.entries(chatCorsHeaders)) {
        response.headers.set(key, value)
      }
      // Refresh (or set) the session cookie on every turn so active
      // conversations keep sliding their 30-day expiry forward.
      response.headers.append(
        'set-cookie',
        chatSessionCookie({ sessionId, requestUrl: request.url, maxAgeSeconds: CHAT_SESSION_MAX_AGE_SECONDS, path: chatSessionCookiePath }),
      )
      return response
    })
  }

  // /holocron-api/chat/session — restore + clear persisted conversations.
  // GET returns the stored conversation rendered server-side (same JSX
  // pipeline as live streaming) as a federation payload. POST /clear deletes
  // the conversation and expires the cookie ("New chat").
  if (site.config.assistant.enabled) {
    const forwardSessionHeaders = (request: Request, sessionId: string) => ({
      ...(getHolocronApiKey() ? { authorization: `Bearer ${getHolocronApiKey()}` } : {}),
      'x-holocron-chat-session': sessionId,
      'x-holocron-site': chatSiteKey(request),
    })

    for (const sessionRoute of new Set(['/holocron-api/chat/session', withBaseRoute(site.base, '/holocron-api/chat/session')])) {
      app = app.options(sessionRoute, async () => new Response(null, { status: 204, headers: chatCorsHeaders }))
      app = app.get(sessionRoute, async ({ request }: { request: Request }) => {
        const sessionId = readChatSessionId(request)
        let modelMessages: Record<string, unknown>[] = []
        if (sessionId) {
          try {
            const gatewayResponse = await fetch(holocronUrl('/api/chat/session'), {
              headers: forwardSessionHeaders(request, sessionId),
            })
            if (gatewayResponse.ok) {
              const data = await gatewayResponse.json()
              if (isRecord(data) && Array.isArray(data.modelMessages)) {
                modelMessages = data.modelMessages.filter(isRecord)
              }
            }
          } catch (error) {
            logger.error(`chat session restore failed: ${error}`)
          }
        }
        const response = await encodeFederationPayload({
          messages: modelMessagesToChatMessages(modelMessages),
          modelMessages,
        })
        for (const [key, value] of Object.entries(chatCorsHeaders)) {
          response.headers.set(key, value)
        }
        return response
      })
    }

    for (const clearRoute of new Set(['/holocron-api/chat/session/clear', withBaseRoute(site.base, '/holocron-api/chat/session/clear')])) {
      app = app.options(clearRoute, async () => new Response(null, { status: 204, headers: chatCorsHeaders }))
      app = app.post(clearRoute, async ({ request }: { request: Request }) => {
        const sessionId = readChatSessionId(request)
        if (sessionId) {
          try {
            await fetch(holocronUrl('/api/chat/session'), {
              method: 'DELETE',
              headers: forwardSessionHeaders(request, sessionId),
            })
          } catch (error) {
            logger.error(`chat session clear failed: ${error}`)
          }
        }
        return new Response(JSON.stringify({ cleared: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            ...chatCorsHeaders,
            // Expire the cookie so the next message mints a fresh session.
            'set-cookie': chatSessionCookie({ sessionId: '', requestUrl: request.url, maxAgeSeconds: 0, path: chatSessionCookiePath }),
          },
        })
      })
    }
  }

  // Resolve the per-page rendering strategy (ssr vs static) from frontmatter.
  // Pages opting into `rendering: static` are registered with spiceflow's
  // `.staticPage()`, which the prerender plugin (wired via spiceflowPlugin)
  // prerenders to HTML + RSC data at build time. Prefer the navigation tree's
  // already-parsed frontmatter; fall back to parsing the MDX for orphan pages
  // that exist on disk but aren't listed in the navigation.
  const renderingBySlug = new Map<string, PageRendering>(
    await Promise.all(
      slugs.map(async (slug): Promise<[string, PageRendering]> => {
        const navPage = findPage(site.navigation, slug)
        if (navPage) return [slug, getPageRendering(navPage.frontmatter)]
        const mdx = await providers.getMdxSource(slug)
        return [slug, getPageRendering(mdx ? parsePageFrontmatter(mdx) : undefined)]
      }),
    ),
  )

  // Per-slug .loader/.layout/.page with shared fn references for client identity
  for (const slug of slugs) {
    const pageHref = slugToHref(slug)
    const pageHandler = makePageHandler(slug, pageHref)
    const isStatic = renderingBySlug.get(slug) === 'static'

    for (const route of new Set([pageHref, withBaseRoute(site.base, pageHref)])) {
      app = app.loader(route, loaderFn).layout(route, layoutFn)
      app = isStatic ? app.staticPage(route, pageHandler) : app.page(route, pageHandler)
    }
  }

  // Runtime provider catch-all routes (e.g. /blog/* for Outrank).
  // These must be registered AFTER the per-slug routes so static pages take
  // priority, and BEFORE the wildcard fallback so runtime pages don't 404.
  if (runtimeTabs.size > 0) {
    const runtimePageHandler = async ({ params, request }: { params: Record<string, string>; request: Request }) => {
      const wildcard = params['*'] ?? ''
      const url = new URL(request.url)
      const strippedSlug = stripBaseFromSlug(url.pathname, site.base)

      const result = await resolveRuntimeContent(strippedSlug, runtimeTabs, config.navigation.tabs, runtimeCache)
      if (!result) {
        // Not found in any runtime provider — fall through to 404
        return null
      }

      const { mdx: pageMdx } = result
      const pageHref = slugToHref(strippedSlug)

      // Extract title from frontmatter for the page
      const frontmatter = parsePageFrontmatter(pageMdx)
      const pageTitle = frontmatter.title || titleFromSlug(strippedSlug)
      const ogImageUrl = buildOgImageUrl({
        title: pageTitle,
        description: frontmatter.description ?? config.description,
        siteName: config.name,
        pageLabel: `${url.host}${pageHref}`,
      })

      // Parse MDX
      const pageSource = `/${strippedSlug}`
      const preParsedMdast = parsePageMdx(pageMdx, pageSource)
      if (preParsedMdast instanceof Error) {
        return renderMdxParseErrorPage({ slug: strippedSlug, error: preParsedMdast, bannerJsx: null })
      }

      // Resolve MDX import statements (runtime pages typically have none, but support it)
      const lazyGlob = providers.getModules?.()
      const modules = lazyGlob && Object.keys(lazyGlob).length > 0
        ? await resolveModules({
            glob: lazyGlob,
            mdast: preParsedMdast,
            baseUrl: (providers.pagesDirPrefix || './') + (strippedSlug.includes('/') ? strippedSlug.slice(0, strippedSlug.lastIndexOf('/') + 1) : ''),
          })
        : undefined

      // Build a minimal loader data for rendering. Use the enriched site
      // (with runtime tab pages populated) for active-tab resolution so the
      // tab bar highlights the correct tab for runtime provider pages.
      const effectiveConfig = await resolveConfigOverride(request, site.config, normalizeConfig)
      const enrichedSite = await buildLoaderSite(strippedSlug, effectiveConfig, url.origin)
      const loaderData: HolocronLoaderData = {
        site: enrichedSite,
        currentPageHref: pageHref,
        currentPageTitle: pageTitle,
        currentPageDescription: frontmatter.description,
        currentHeadings: [], // Runtime pages don't have pre-extracted headings
        ancestorGroupKeys: [],
        activeTabHref: resolveActiveTabHref(enrichedSite, pageHref),
        activeVersionHref: resolveActiveVersionHref(enrichedSite, pageHref),
        activeDropdownHref: resolveActiveDropdownHref(enrichedSite, pageHref),
        notFoundPath: undefined,
        headTitle: `${pageTitle} — ${effectiveConfig.name}`,
        headRobots: getPageRobots(frontmatter),
        currentPageFrontmatter: frontmatter,
        showConfigPanel: shouldShowConfigPanel(request),
        hasPreviewProps: hasPreviewProps(request.url),
        githubStars: githubStarsPromise,
      }

      const bannerJsx = getBannerJsx(loaderData.site, request)

      return renderMdxPage({
        site: loaderData.site,
        slug: strippedSlug,
        pageMdx,
        loaderData,
        bannerJsx,
        ogImageUrl,
        requestUrl: url,
        modules,
        pagesDirPrefix: providers.pagesDirPrefix,
        preParsedMdast,
        devRenderErrors: undefined,
      })
    }

    for (const [tabName, provider] of runtimeTabs) {
      const configTab = config.navigation.tabs.find((t) => t.tab === tabName)
      const base = configTab?.base ?? provider.name
      const pattern = base ? `/${base}/*` : '/*'
      for (const route of new Set([pattern, withBaseRoute(site.base, pattern)])) {
        app = app.loader(route, loaderFn).layout(route, layoutFn).page(route, runtimePageHandler)
      }
    }
  }

  // Redirect `/index`-style paths to their canonical href so links written
  // against the source filename (e.g. `/guide/index` or `/index`) still work.
  // A page authored as `index.mdx` serves at `/`, and `guide/index.mdx` serves
  // at `/guide`; their `*/index` forms have no route and would otherwise 404.
  const allPageHrefs = new Set(slugs.map((slug) => slugToHref(slug)))
  // When no index.mdx exists, `/index` should still resolve to the same place
  // as `/` (the first doc page) rather than 404.
  const indexRedirectTargets = new Map<string, string>()
  for (const pageHref of allPageHrefs) {
    const indexHref = pageHref === '/' ? '/index' : `${pageHref}/index`
    indexRedirectTargets.set(indexHref, pageHref)
  }
  if (!allPageHrefs.has('/') && firstPage) {
    indexRedirectTargets.set('/index', firstPage.href)
  }
  const configRedirectRules = deduplicateRedirects(site.config.redirects)
  for (const [indexHref, pageHref] of indexRedirectTargets) {
    // Skip if some other real page already owns the index-form href.
    if (allPageHrefs.has(indexHref)) continue
    // Skip if a user-authored config redirect already covers this path —
    // config redirects (registered earlier) must win over generated aliases.
    if (configRedirectRules.some((rule) => redirectSourceMatches(rule.source, indexHref))) continue
    for (const route of new Set([indexHref, withBaseRoute(site.base, indexHref)])) {
      app = app.get(route, ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const dest = withBaseRoute(site.base, pageHref) + url.search
        throw redirect(new URL(dest, url.origin).href, { status: 308 })
      })
    }
  }

  // Wildcard fallback for 404s (no .page('/*') — spiceflow passes
  // children=null when nothing matched, which the layout detects).
  app = app
    .loader('/*', loaderFn)
    .layout('/*', wildcardLayoutFn)

  return app
}

export type HolocronApp = AnySpiceflow
