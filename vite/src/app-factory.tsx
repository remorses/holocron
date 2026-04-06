/**
 * Holocron app factory — creates the Spiceflow app with per-page routes.
 *
 * Architecture:
 *
 *   For each MDX page on disk:
 *     .page(href)    → parses MDX, renders sections/hero as server JSX
 *
 *   Shared across all pages:
 *     .loader('/*')  → per-request minimal data (current page, headings, etc.)
 *     .layout('/*')  → HTML shell with SiteHead + theme
 *
 *   Explicit GET routes (no catch-all needed — registered per-page):
 *     .get('/<page>.md')   → raw markdown for AI agents
 *     .get('/sitemap.xml') → XML sitemap
 *     .get('/api/search')  → search API
 *
 *   Middleware (cross-cutting):
 *     .use(serveStatic)     → public files
 *     .use(redirects)       → config-driven redirects
 *     .use(agentRedirect)   → 302 AI agents to .md URLs
 *
 * Static site data (navigation tree, tabs, header links, search entries)
 * lives in `./data.ts` and is bundled into the client chunk ONCE — never
 * re-shipped through the per-request loader payload.
 */

import './styles/globals.css'
import React from 'react'
import { Spiceflow, serveStatic, redirect } from 'spiceflow'
import { Head } from 'spiceflow/react'
import { mdxParse } from 'safe-mdx/parse'
import { parse as parseCookies } from 'cookie'
import type { Root } from 'mdast'
import mdxContent from 'virtual:holocron-mdx'
import {
  EditorialPage,
  type EditorialSection,
} from './components/markdown/index.tsx'
import { NotFound } from './components/not-found.tsx'
import {
  findPageBySlug,
  collectAllPages,
  slugToHref,
  buildHrefToSlugMap,
  type NavHeading,
} from './navigation.ts'
import {
  config,
  navigation,
  firstPage,
  collectAncestorGroupKeys,
  resolveActiveTabHref,
} from './data.ts'
import { registerRedirects } from './lib/redirects.ts'
import { isAgentRequest } from './lib/raw-markdown.ts'
import { buildSections, isHeroNode } from './lib/mdx-sections.ts'
import { RenderNodes } from './lib/mdx-components-map.tsx'
import { SiteHead } from './lib/site-head.tsx'

/* ── Loader data type ────────────────────────────────────────────────── */

/**
 * Per-request data produced by `.loader('/*')`. Serialized via RSC flight
 * to both the page handler (via `loaderData`) and every client component
 * (via `useHolocronData()` from `@holocron.so/vite/react`).
 *
 * Intentionally MINIMAL — static data (navigation tree, tabs, header
 * links, search entries) lives in `./data.ts` and is bundled into the
 * client chunk once. Only per-request state flows through this payload.
 */
export type HolocronLoaderData = {
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
  /** Original requested path when a 404 occurred (includes leading slash). */
  notFoundPath: string | undefined
  /** Fully-composed `<title>` text (includes site name suffix). */
  headTitle: string
  /** Value for `<meta name="robots">`, or `undefined` to omit the tag. */
  headRobots: string | undefined
}

/* ── Constants ───────────────────────────────────────────────────────── */

const POWERED_BY_FOOTER = '\n\n---\n\n*Powered by [holocron.so](https://holocron.so)*\n'

/* ── Shared helpers ──────────────────────────────────────────────────── */

function getBannerJsx(request: Request): React.ReactNode | undefined {
  if (!config.banner) return undefined
  const pageCookies = parseCookies(request.headers.get('cookie') || '')
  if (pageCookies['holocron-banner-dismissed'] === config.banner.content) return undefined
  const bannerMdx = config.banner.content
  const bannerMdast = mdxParse(bannerMdx) as Root
  return <RenderNodes markdown={bannerMdx} nodes={bannerMdast.children} />
}

function renderMdxPage(
  slug: string,
  loaderData: HolocronLoaderData,
  bannerJsx: React.ReactNode | undefined,
) {
  const pageMdx = mdxContent[slug]!

  const mdast = mdxParse(pageMdx) as Root
  const heroNodes = mdast.children.filter(isHeroNode)
  const contentChildren = mdast.children.filter((node) => !isHeroNode(node))
  const contentMdast: Root = { type: 'root', children: contentChildren }
  const mdastSections = buildSections(contentMdast)

  const sections: EditorialSection[] = mdastSections.map((section) => {
    const aside =
      section.asideNodes.length > 0 ? (
        <RenderNodes markdown={pageMdx} nodes={section.asideNodes} />
      ) : undefined
    return {
      content: <RenderNodes markdown={pageMdx} nodes={section.contentNodes} />,
      aside,
      fullWidth: section.fullWidth,
      asideRowSpan: section.asideRowSpan,
    }
  })

  const hero =
    heroNodes.length > 0 ? (
      <RenderNodes markdown={pageMdx} nodes={heroNodes} />
    ) : undefined

  return (
    <>
      <Head>
        <Head.Title>{loaderData.headTitle}</Head.Title>
        {loaderData.currentPageDescription && (
          <>
            <Head.Meta name='description' content={loaderData.currentPageDescription} />
            <Head.Meta property='og:description' content={loaderData.currentPageDescription} />
          </>
        )}
      </Head>
      <EditorialPage sections={sections} hero={hero} bannerContent={bannerJsx} />
    </>
  )
}

/* ── App factory ─────────────────────────────────────────────────────── */

export function createHolocronApp() {
  // Use `any` during the imperative route-registration loop, then cast
  // back to a properly-typed Spiceflow chain at the end so HolocronApp
  // (used by createRouter<HolocronApp>()) retains loader type info.
  let app: any = new Spiceflow().use(serveStatic({ root: './public' }))

  // ── Middleware ──────────────────────────────────────────────────
  app = registerRedirects(app, config.redirects)

  // Base path from Vite config (e.g. '/docs' or '/'). Used to build
  // public-facing URLs for sitemaps and agent redirects. Spiceflow strips
  // the base before routing, so route paths are base-less (e.g. '/intro'),
  // but external URLs must include the base (e.g. '/docs/intro').
  const rawBase = import.meta.env.BASE_URL || '/'
  const base = rawBase === '/' ? '' : rawBase.replace(/\/$/, '')

  // Agent redirect: detect AI agents on normal page URLs → 302 to .md
  const hrefToSlug = buildHrefToSlugMap(mdxContent)
  app = app.use(({ request }: { request: Request }) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return
    if (!isAgentRequest(request)) return

    const url = new URL(request.url)
    let pathname = url.pathname
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }
    // Don't redirect .md, .xml, or /api requests
    if (pathname.endsWith('.md') || pathname.endsWith('.xml') || pathname.startsWith('/api')) return

    // Strip base from pathname for lookup (spiceflow may or may not
    // strip the base depending on middleware vs route context)
    const stripped = base && pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname
    if (!hrefToSlug.has(stripped)) return

    const mdPath = stripped === '/' ? '/index.md' : `${stripped}.md`
    return Response.redirect(new URL(base + mdPath + url.search, url.origin).href, 302)
  })

  // ── Explicit GET routes ────────────────────────────────────────

  // /sitemap.xml
  app = app.get('/sitemap.xml', ({ request }: { request: Request }) => {
    const url = new URL(request.url)
    const hrefs = Array.from(hrefToSlug.keys()).sort()
    const urls = hrefs
      .map((href: string) => `  <url><loc>${url.origin}${base}${href}</loc></url>`)
      .join('\n')
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!-- To get the raw markdown content of any page, append .md to the URL. -->',
      `<!-- Example: ${url.origin}${base}/getting-started.md -->`,
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls,
      '</urlset>',
    ].join('\n')
    return new Response(xml, {
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 's-maxage=3600, stale-while-revalidate=86400',
      },
    })
  })

  // Per-page .md routes
  for (const slug of Object.keys(mdxContent)) {
    const href = slugToHref(slug)
    const mdPath = href === '/' ? '/index.md' : `${href}.md`
    const mdx = mdxContent[slug]!

    app = app.get(mdPath, () => {
      return new Response(mdx + POWERED_BY_FOOTER, {
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'cache-control': 's-maxage=300, stale-while-revalidate=86400',
        },
      })
    })
  }

  // /api/search
  app = app.get('/api/search', ({ request }: { request: Request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('q') || ''
    const allPages = collectAllPages(navigation)
    const results = allPages
      .flatMap((page) => [
        { title: page.title, href: page.href, type: 'page' as const },
        ...page.headings.map((h) => ({
          title: h.text,
          href: `${page.href}#${h.slug}`,
          type: 'heading' as const,
        })),
      ])
      .filter((item) => item.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 20)

    return new Response(JSON.stringify(results), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=86400',
      },
    })
  })

  // ── Shared loader + layout ─────────────────────────────────────

  app = app.loader('/*', async ({ params, response }: any): Promise<HolocronLoaderData> => {
    const rawSlug = (params as Record<string, string>)['*'] || ''
    const slug = rawSlug === '' ? 'index' : rawSlug

    const currentPage = findPageBySlug(navigation, slug, mdxContent)
    const hasMdx = mdxContent[slug] !== undefined

    // Root path with no index page → redirect to first page in navigation
    if (!currentPage && (slug === 'index' || slug === '') && firstPage) {
      throw redirect(firstPage.href)
    }

    // 404 case
    if (!currentPage || !hasMdx) {
      response.status = 404
      return {
        currentPageHref: undefined,
        currentPageTitle: undefined,
        currentPageDescription: undefined,
        currentHeadings: [],
        ancestorGroupKeys: firstPage ? collectAncestorGroupKeys(firstPage.href) : [],
        activeTabHref: resolveActiveTabHref(firstPage?.href),
        notFoundPath: '/' + rawSlug,
        headTitle: `Page not found — ${config.name}`,
        headRobots: 'noindex',
      }
    }

    return {
      currentPageHref: currentPage.href,
      currentPageTitle: currentPage.title,
      currentPageDescription: currentPage.description ?? config.description,
      currentHeadings: currentPage.headings,
      ancestorGroupKeys: collectAncestorGroupKeys(currentPage.href),
      activeTabHref: resolveActiveTabHref(currentPage.href),
      notFoundPath: undefined,
      headTitle: `${currentPage.title} — ${config.name}`,
      headRobots: undefined,
    }
  })

  app = app.layout('/*', async ({ children, request }: any) => {
    const cookies = parseCookies(request.headers.get('cookie') || '')
    const cookieTheme = config.appearance.strict
      ? null
      : (cookies['holocron-theme'] as 'light' | 'dark' | undefined) ?? null
    const isDark =
      cookieTheme === 'dark' ||
      (!cookieTheme && config.appearance.default === 'dark')
    return (
      <html
        lang='en'
        className={isDark ? 'dark' : undefined}
        data-default-theme={config.appearance.default}
        {...(config.appearance.strict ? { 'data-strict-theme': '' } : {})}
      >
        <SiteHead config={config} />
        <body>{children}</body>
      </html>
    )
  })

  // ── Per-page .page() routes ────────────────────────────────────
  for (const slug of Object.keys(mdxContent)) {
    const pageHref = slugToHref(slug)

    app = app.page(pageHref, async ({ loaderData: rawLoaderData, request }: any) => {
      const loaderData = rawLoaderData as unknown as HolocronLoaderData
      const bannerJsx = getBannerJsx(request)
      return renderMdxPage(slug, loaderData, bannerJsx)
    })
  }

  // Cast to a typed chain so HolocronApp (used by createRouter) keeps
  // the loader('/*') type → useLoaderData('/*') returns HolocronLoaderData.
  return app as ReturnType<typeof createTypedChain>
}

/** Type-only helper: a minimal Spiceflow chain with the loader typed.
 *  Never called at runtime — only used for `ReturnType<>` extraction. */
function createTypedChain() {
  return new Spiceflow()
    .loader('/*', async (_ctx: any): Promise<HolocronLoaderData> => {
      return undefined as any
    })
    .layout('/*', async (_ctx: any) => {
      return undefined as any
    })
    .page('/*', async (_ctx: any) => {
      return undefined as any
    })
}

/* ── Public type for the client router ───────────────────────────────── */

/**
 * The fully-typed Spiceflow app instance. Use this with `createRouter<App>()`
 * in client code to get typed `useLoaderData`, `href`, and `router` bindings.
 * The actual router module (`./router.ts`) already does this — client
 * components should import from `@holocron.so/vite/react` directly.
 */
export type HolocronApp = ReturnType<typeof createHolocronApp>
