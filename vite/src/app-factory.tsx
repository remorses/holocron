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

import './styles/globals.css'
import React from 'react'
import { Spiceflow, type AnySpiceflow, redirect } from 'spiceflow'
import { createSpiceflowFetch } from 'spiceflow/client'
import { Head, ProgressBar, ScrollRestoration } from 'spiceflow/react'
import { mdxParse, resolveModules, type EagerModules } from 'safe-mdx/parse'
import { parse as parseCookies } from 'cookie'
import type { Root } from 'mdast'
import {
  EditorialPage,
  type EditorialSection,
} from './components/layout/editorial-page.tsx'
import { RenderBannerNodes } from './components/layout/banner.tsx'
import { P, SectionHeading } from './components/markdown/typography.tsx'
import { slugify } from './lib/toc-tree.ts'
import { NotFound } from './components/not-found.tsx'
import {
  findPage,
  collectAllPages,
  slugToHref,
  buildHrefToSlugMap,
  type NavHeading,
  type NavPage,
  type Navigation,
  type NavVersionItem,
  type NavDropdownItem,
} from './navigation.ts'
import { parsePageFrontmatter } from './lib/page-frontmatter.ts'
import { deduplicateRedirects, interpolateDestination } from './lib/redirects.ts'
import { isAgentRequest, stripVisibilityForAgents } from './lib/raw-markdown.ts'
import { zipSync, strToU8 } from 'fflate'
import { buildSections, isAboveNode } from './lib/mdx-sections.ts'
import { computeSidebarWidthFromAsideNodes } from './lib/sidebar-widths.ts'
import { visit } from 'unist-util-visit'
import { RenderNodes } from './lib/mdx-components-map.tsx'
import { SiteHead } from './lib/site-head.tsx'
import { encodeFederationPayload } from 'spiceflow/federation'
import { ChatRenderNodes } from './lib/chat-render.tsx'
import dedent from 'string-dedent'
import { buildOgImageUrl } from './lib/og-utils.ts'
import { getPageRobots, getPageSeoMeta, isIndexablePage, serializeKeywords, type PageFrontmatter } from './lib/page-frontmatter.ts'
import {
  buildVisibleSiteData,
  type HolocronSiteData,
  collectAncestorGroupKeys,
  findFirstPage,
  resolveActiveDropdownHref,
  resolveActiveTabHref,
  resolveActiveVersionHref,
} from './site-data.ts'
import type { HolocronConfig } from './config.ts'
import { collectIconRefs, dedupeIconRefs, type IconRef } from './lib/collect-icons.ts'

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
}

type HolocronNavigationData = {
  navigation: Navigation
  switchers: { versions: NavVersionItem[]; dropdowns: NavDropdownItem[] }
}

type HolocronProviders = {
  base: string
  getConfig(): Promise<HolocronConfig>
  getNavigationData(): Promise<HolocronNavigationData>
  getMdxSlugs(): Promise<string[]>
  getMdxSource(slug: string): Promise<string | undefined>
  getPageIconRefs(slug: string): Promise<IconRef[]>
  /** Lazy glob of importable files (snippets, components, colocated pages).
   *  Used by resolveModules() to resolve MDX import statements at render time. */
  getModules?(): Record<string, () => Promise<Record<string, any>>>
  /** Pages directory relative to root with ./ prefix and trailing slash.
   *  E.g. './pages/' or './' when pagesDir is the project root. */
  pagesDirPrefix?: string
}

/* ── Constants ───────────────────────────────────────────────────────── */

const POWERED_BY_FOOTER = '\n\n---\n\n*Powered by [holocron.so](https://holocron.so)*\n'

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
  const bannerMdast = mdxParse(bannerMdx)
  return <RenderBannerNodes markdown={bannerMdx} nodes={bannerMdast.children} />
}

function renderMdxPage({
  site,
  slug,
  pageMdx,
  loaderData,
  bannerJsx,
  ogImageUrl,
  modules,
  pagesDirPrefix,
  preParsedMdast,
}: {
  site: HolocronSiteData
  slug: string
  pageMdx: string
  loaderData: HolocronLoaderData
  bannerJsx: React.ReactNode | undefined
  ogImageUrl: string
  /** Pre-resolved modules for MDX import statements (from resolveModules) */
  modules?: EagerModules
  /** Pages directory prefix for resolving relative imports */
  pagesDirPrefix?: string
  /** Pre-parsed mdast — avoids re-parsing when the caller already parsed it (e.g. for resolveModules) */
  preParsedMdast?: Root
}) {
  const pageSeoMeta = getPageSeoMeta(loaderData.currentPageFrontmatter)
  const pageKeywords = serializeKeywords(loaderData.currentPageFrontmatter?.keywords)
  const pageOgImage = pageSeoMeta['og:image'] ?? ogImageUrl
  const pageTwitterImage = pageSeoMeta['twitter:image'] ?? pageOgImage
  const pageOgDescription = pageSeoMeta['og:description'] ?? loaderData.currentPageDescription
  const pageTwitterDescription = pageSeoMeta['twitter:description'] ?? loaderData.currentPageDescription
  const pageOgTitle = pageSeoMeta['og:title'] ?? loaderData.headTitle
  const pageTwitterTitle = pageSeoMeta['twitter:title'] ?? loaderData.headTitle
  const pageTwitterCard = pageSeoMeta['twitter:card'] ?? 'summary_large_image'

  const mdast = preParsedMdast ?? mdxParse(pageMdx)
  const aboveNodes = mdast.children.filter(isAboveNode)
  const contentChildren = mdast.children.filter((node) => !isAboveNode(node))
  const contentMdast: Root = { type: 'root', children: contentChildren }
  const mdastSections = buildSections(contentMdast, { enableAssistant: site.config.assistant.enabled })

  // Check if the page content already starts with any heading. If not, we
  // prepend a rendered <SectionHeading> component at the top of the first
  // section so every page always shows a visible title.
  const firstContentNode = contentChildren.find(
    (n) => n.type !== 'mdxjsEsm' && n.type !== 'yaml',
  )
  const startsWithHeading = (() => {
    if (!firstContentNode) return false
    if (firstContentNode.type === 'heading') return true
    const nodeType = firstContentNode.type as string
    if (nodeType === 'mdxJsxFlowElement') {
      const jsx = firstContentNode as unknown as { name: string | null; attributes: Array<{ type: string; name: string; value: unknown }> }
      return /^h[1-6]$/.test(jsx.name ?? '') || jsx.name === 'Heading'
    }
    return false
  })()
  const shouldInjectH1 = !startsWithHeading && !!loaderData.currentPageTitle

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

  // Compute the baseUrl for resolving relative imports in MDX.
  // The slug mirrors the file path inside pagesDir (e.g. 'api/overview'
  // comes from pages/api/overview.mdx), so its directory is the baseUrl.
  const slugDir = slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/') + 1) : ''
  const mdxBaseUrl = (pagesDirPrefix || './') + slugDir

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
        <RenderNodes markdown={pageMdx} nodes={asideNodes} modules={modules} baseUrl={mdxBaseUrl} />
      ) : undefined
    const renderedContent = <RenderNodes markdown={pageMdx} nodes={contentNodes} modules={modules} baseUrl={mdxBaseUrl} />
    // Prepend a rendered H1 from frontmatter title when the MDX doesn't
    // start with one. Only the first section gets the heading.
    const content = (shouldInjectH1 && i === 0) ? (
      <>
        <SectionHeading id={slugify(loaderData.currentPageTitle!)} level={1}>
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
      <RenderNodes markdown={pageMdx} nodes={aboveWithImports} modules={modules} baseUrl={mdxBaseUrl} />
    ) : undefined

  const gridGap = loaderData.currentPageFrontmatter?.gridGap

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
      <EditorialPage sections={sections} above={above} bannerContent={bannerJsx} sidebarWidth={sidebarWidth} gridGap={gridGap} />
    </>
  )
}

function parseChatRequestBody(value: unknown): {
  modelMessages: Record<string, unknown>[]
  message: string
  currentSlug: string
} {
  if (!isRecord(value) || !Array.isArray(value.modelMessages) || typeof value.message !== 'string' || typeof value.currentSlug !== 'string') {
    throw new Error('Invalid chat request body')
  }

  return {
    modelMessages: value.modelMessages.filter(isRecord),
    message: value.message,
    currentSlug: value.currentSlug,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
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
  const [config, { navigation, switchers }, slugs] = await Promise.all([
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
  }
  const sharedIconRefs = collectIconRefs({ config, navigation })
  const clientSite = buildVisibleSiteData(site)
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
    return `Agent-readable docs index: ${basePath}/llms.txt. Download ${basePath}/docs.zip to grep all markdown files locally.`
  }

  function buildMarkdownSource(mdx: string): string {
    return `> ${buildAgentDocsDirective(site.base)}\n\n${stripVisibilityForAgents(mdx)}${POWERED_BY_FOOTER}`
  }

  function buildLlmsTxt(origin: string): string {
    const basePath = withBaseRoute(site.base, '/') === '/' ? '' : withBaseRoute(site.base, '/').replace(/\/$/, '')
    const baseUrl = `${origin}${basePath}`
    const description = escapeMarkdownText(site.config.description || `Documentation and usage guide for ${site.config.name}.`)
    const pageLinks = collectAllPages(site.navigation)
      .filter((page) => isIndexablePage(page.frontmatter))
      .map((page) => `- [${escapeMarkdownText(page.title)}](${baseUrl}${hrefToMarkdownPath(page.href)})`)
      .join('\n')

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
    `
  }

  async function buildLoaderSite(slug: string | undefined): Promise<HolocronSiteData> {
    const pageIconRefs = slug ? await providers.getPageIconRefs(slug) : []
    const { resolveIconSvgs } = await import('./lib/resolve-icons.ts')
    return {
      ...clientSite,
      icons: resolveIconSvgs(dedupeIconRefs([...sharedIconRefs, ...pageIconRefs])),
    }
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
    const currentPage = await findPageBySlug({ nav: site.navigation, slug, getMdxSource: providers.getMdxSource })
    const hasMdx = (await providers.getMdxSource(slug)) !== undefined

    if (!currentPage || !hasMdx) {
      return {
        site: await buildLoaderSite(undefined),
        currentPageHref: undefined,
        currentPageTitle: undefined,
        currentPageDescription: undefined,
        currentHeadings: [],
        ancestorGroupKeys: firstPage ? collectAncestorGroupKeys(site, firstPage.href) : [],
        activeTabHref: resolveActiveTabHref(site, firstPage?.href),
        activeVersionHref: resolveActiveVersionHref(site, firstPage?.href),
        activeDropdownHref: resolveActiveDropdownHref(site, firstPage?.href),
        notFoundPath: '/' + slug,
        headTitle: `Page not found — ${site.config.name}`,
        headRobots: 'noindex',
        currentPageFrontmatter: undefined,
      }
    }

    return {
      site: await buildLoaderSite(slug),
      currentPageHref: currentPage.href,
      currentPageTitle: currentPage.title,
      currentPageDescription: currentPage.description ?? site.config.description,
      currentHeadings: currentPage.headings,
      ancestorGroupKeys: collectAncestorGroupKeys(site, currentPage.href),
      activeTabHref: resolveActiveTabHref(site, currentPage.href),
      activeVersionHref: resolveActiveVersionHref(site, currentPage.href),
      activeDropdownHref: resolveActiveDropdownHref(site, currentPage.href),
      notFoundPath: undefined,
      headTitle: `${currentPage.title} — ${site.config.name}`,
      headRobots: getPageRobots(currentPage.frontmatter),
      currentPageFrontmatter: currentPage.frontmatter,
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
    const cookies = parseCookies(request.headers.get('cookie') || '')
    const cookieTheme = site.config.appearance.strict
      ? null
      : (cookies['holocron-theme'] === 'light' || cookies['holocron-theme'] === 'dark' ? cookies['holocron-theme'] : null)
    const isDark =
      cookieTheme === 'dark' ||
      (!cookieTheme && site.config.appearance.default === 'dark')

    const isNotFound = children === null
    const bannerJsx = getBannerJsx(site, request)
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
        data-default-theme={site.config.appearance.default}
        suppressHydrationWarning
        {...(site.config.appearance.strict ? { 'data-strict-theme': '' } : {})}
      >
        <SiteHead
          config={site.config}
          titleOverride={isNotFound ? (loaderData?.headTitle ?? `Page not found — ${site.config.name}`) : undefined}
        />
        {isNotFound && (
          <Head>
            <Head.Meta name='robots' content='noindex' />
          </Head>
        )}
        <body>
          <div className='sr-only'>{buildAgentDocsDirective(site.base)}</div>
          <ProgressBar color='var(--primary)' />
          <ScrollRestoration />
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
  const wildcardLayoutFn = async ({ children, request, response, loaderData: rawLoaderData }: { children?: React.ReactNode; request: Request; response: { status?: number; headers: Headers }; loaderData: unknown }) => {
    if (!isHolocronLoaderData(rawLoaderData)) {
      throw new Error('Holocron loader data missing in wildcard layout')
    }
    if (children === null || children === undefined) {
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
      const bannerJsx = getBannerJsx(site, request)
      const requestUrl = new URL(request.url)
      const faviconUrl = site.config.favicon.light || site.config.favicon.dark
      const ogImageUrl = buildOgImageUrl({
        title: loaderData.currentPageTitle ?? site.config.name,
        description: loaderData.currentPageDescription ?? site.config.description,
        iconUrl: faviconUrl ? new URL(faviconUrl, request.url).toString() : undefined,
        siteName: site.config.name,
        pageLabel: `${requestUrl.host}${loaderData.currentPageHref ?? pageHref}`,
      })
      const pageMdx = await providers.getMdxSource(slug)
      if (pageMdx === undefined) {
        throw new Error(`MDX content missing for registered page slug "${slug}"`)
      }

      // Resolve MDX import statements against the lazy glob.
      // Only loads modules that the current page actually imports.
      // Parse the mdast once and share it with renderMdxPage to avoid a duplicate parse.
      let modules: EagerModules | undefined
      let preParsedMdast: Root | undefined
      if (lazyGlob && Object.keys(lazyGlob).length > 0) {
        preParsedMdast = mdxParse(pageMdx)
        const slugDir = slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/') + 1) : ''
        const baseUrl = (providers.pagesDirPrefix || './') + slugDir
        modules = await resolveModules({ glob: lazyGlob, mdast: preParsedMdast, baseUrl })
      }

      return renderMdxPage({ site, slug, pageMdx, loaderData, bannerJsx, ogImageUrl, modules, pagesDirPrefix: providers.pagesDirPrefix, preParsedMdast })
    }
  }

  // `let app` because spiceflow's chain types don't survive the loop.
  let app: AnySpiceflow = new Spiceflow()

  // Agent redirect: detect AI agents on docs pages → 302 to .md
  app = app.use(({ request }: { request: Request }) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return
    if (!isAgentRequest(request)) return

    const url = new URL(request.url)
    let pathname = url.pathname
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }
    if (pathname.endsWith('.md') || pathname.endsWith('.xml') || pathname.endsWith('.zip') || pathname.startsWith('/holocron-api/') || pathname.includes('/.well-known/')) return

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

  // Root redirect when no explicit index page is defined
  if (!slugs.includes('index') && firstPage) {
    for (const rootRoute of new Set(['/', withBaseRoute(site.base, '/')])) {
      app = app.get(rootRoute, ({ request }: { request: Request }) => {
        return Response.redirect(new URL(withBaseRoute(site.base, firstPage.href), request.url), 307)
      })
    }
  }

  // /sitemap.xml
  for (const sitemapRoute of new Set(['/sitemap.xml', withBaseRoute(site.base, '/sitemap.xml')])) {
    app = app.get(sitemapRoute, ({ request }: { request: Request }) => {
      const url = new URL(request.url)
      const hrefs = collectAllPages(site.navigation)
        .filter((page) => isIndexablePage(page.frontmatter))
        .map((page) => page.href)
        .sort()
      const urls = hrefs
        .map((href: string) => `  <url><loc>${url.origin}${withBaseRoute(site.base, href)}</loc></url>`)
        .join('\n')
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!-- To get the raw markdown content of any page, append .md to the URL. -->',
        `<!-- Example: ${url.origin}${withBaseRoute(site.base, '/getting-started.md')} -->`,
        `<!-- To download all docs as a zip of .md files: ${url.origin}${withBaseRoute(site.base, '/docs.zip')} -->`,
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

  if (!slugs.includes('index') && firstPage) {
    const firstMarkdownPath = hrefToMarkdownPath(firstPage.href)
    for (const route of new Set(['/index.md', withBaseRoute(site.base, '/index.md')])) {
      app = app.get(route, ({ request }: { request: Request }) => {
        return Response.redirect(new URL(withBaseRoute(site.base, firstMarkdownPath), request.url), 307)
      })
    }
  }

  // Per-page .md routes
  for (const slug of slugs) {
    const href = slugToHref(slug)
    const mdPath = hrefToMarkdownPath(href)

    for (const route of new Set([mdPath, withBaseRoute(site.base, mdPath)])) {
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

  // OG image routes are handled by the og-worker at holocron.so. Generated
  // fallback logo URLs point to website /api/ai-logo, not to takumi.

  // /holocron-api/chat — only registered when assistant is enabled
  for (const chatRoute of new Set(['/holocron-api/chat', withBaseRoute(site.base, '/holocron-api/chat')])) {
    if (!site.config.assistant.enabled) {
      app = app.post(chatRoute, async () => new Response('Assistant is disabled', { status: 404 }))
      continue
    }
    app = app.post(chatRoute, async ({ request }: { request: Request }) => {
      const body = parseChatRequestBody(await request.json())

      // Build system prompt
      const allPages = collectAllPages(site.navigation)
      const pageIndex = allPages
        .map((p) => `<page path="/docs/${p.slug}.mdx" title="${p.title}" />`)
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

        Use the bash tool to search and read documentation files before answering.
        First grep for likely terms from the user's question to find relevant sections, then cat the best matching files.
        Files are at /docs/<slug>.mdx. Use grep -rn "term" /docs/ to search, cat /docs/slug.mdx to read.

        When linking to another docs page, render a normal markdown link.
        Convert file paths to page paths by removing the /docs/ prefix and removing the .mdx extension.
        Also remove a trailing /index segment. Do not include the docs base path or origin; relative root paths are rewritten by the docs app.
        Examples:
        - /docs/index.mdx with title "Home" -> [Home](/)
        - /docs/quickstart.mdx with title "Quickstart" -> [Quickstart](/quickstart)
        - /docs/guide/index.mdx with title "Guide" -> [Guide](/guide)

        Answer concisely based on the documentation. Include code examples when relevant.
      `

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...body.modelMessages,
        { role: 'user' as const, content: body.message },
      ]

      // Points to the hosted Holocron chat route. It owns model selection,
      // quota checks, docs.zip fetching, and AI SDK streaming.
      const chatUrl = new URL('https://preview.holocron.so/api/holocron/chat')
      const useInlineDocs = isLocalhostUrl(request.url)
      const apiKey = process.env.HOLOCRON_KEY || ''
      let textBuffer = ''
      const toolNames = new Map<string, string>()

      async function* generateParts() {
        // Uses `any` — vite is the framework package and must not depend on the
        // website. The chat endpoint shape is validated at runtime by the server.
        const chatFetch = createSpiceflowFetch<any>(chatUrl.origin, {
          headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
        })
        const docsPayload = useInlineDocs
          ? {
              docsPages: Object.fromEntries(
                (await Promise.all(slugs.map(async (slug) => {
                  const mdx = await providers.getMdxSource(slug)
                  return mdx === undefined ? undefined : [`/docs/${slug}.mdx`, buildMarkdownSource(mdx)] as const
                }))).filter((page) => page !== undefined),
              ),
            }
          : { docsZipUrl: new URL(withBaseRoute(site.base, '/docs.zip'), request.url).toString() }
        const uiStream = await chatFetch('/api/holocron/chat', {
          method: 'POST',
          body: {
            messages,
            ...docsPayload,
            skillUrls: [],
            pageSlug: body.currentSlug,
          },
        })

        if (uiStream instanceof Error) {
          yield { type: 'tool-result' as const, toolCallId: 'holocron-chat', toolName: 'holocron-chat', output: '', error: uiStream.message }
          return
        }

        for await (const chunk of uiStream) {
          if (chunk.type === 'notice') {
            yield chunk
            continue
          }

          if (chunk.type === 'text-delta') {
            textBuffer += chunk.delta
            continue
          }

          if (chunk.type === 'text-end') {
            if (textBuffer.trim()) {
              let jsx: React.ReactNode
              try {
                const mdast = mdxParse(textBuffer)
                jsx = (
                  <ChatRenderNodes
                    markdown={textBuffer}
                    nodes={mdast.children}
                  />
                )
              } catch {
                jsx = <P className='whitespace-pre-wrap'>{textBuffer}</P>
              }
              yield { type: 'text' as const, jsx, text: textBuffer }
            }
            textBuffer = ''
            continue
          }

          if (chunk.type === 'tool-input-available') {
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
                { role: 'user', content: body.message },
                ...chunk.messages,
              ],
            }
            continue
          }
        }
      }

      return await encodeFederationPayload({ stream: generateParts() })
    })
  }

  // Per-slug .loader/.layout/.page with shared fn references for client identity
  for (const slug of slugs) {
    const pageHref = slugToHref(slug)
    const pageHandler = makePageHandler(slug, pageHref)

    for (const route of new Set([pageHref, withBaseRoute(site.base, pageHref)])) {
      app = app
        .loader(route, loaderFn)
        .layout(route, layoutFn)
        .page(route, pageHandler)
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
