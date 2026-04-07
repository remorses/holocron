/**
 * Holocron app factory — creates the Spiceflow app with per-page routes.
 *
 * Architecture:
 *
 *   For each MDX page on disk:
 *     .page(href)    -> parses MDX, renders sections/hero as server JSX
 *
 *   Shared across all pages:
 *     .loader('/*')  -> per-request minimal data (current page, headings, etc.)
 *     .layout('/*')  -> HTML shell with SiteHead + theme
 *
 *   Explicit GET routes (no catch-all needed — registered per-page):
 *     .get('/<page>.md')   -> raw markdown for AI agents
 *     .get('/sitemap.xml') -> XML sitemap
 *     .get('/api/search')  -> search API
 *
 *   Middleware (cross-cutting):
 *     .use(serveStatic)    -> public files
 *     .use(redirects)      -> config-driven redirects
 *     .use(agentRedirect)  -> 302 AI agents to .md URLs
 */

import './styles/globals.css'
import React from 'react'
import { Spiceflow, type AnySpiceflow, serveStatic, redirect } from 'spiceflow'
import { Head } from 'spiceflow/react'
import { mdxParse } from 'safe-mdx/parse'
import { parse as parseCookies } from 'cookie'
import type { Root } from 'mdast'
import mdxContent from 'virtual:holocron-mdx'
import { EditorialPage, type EditorialSection } from './components/markdown/editorial-page.tsx'
import { NotFound } from './components/not-found.tsx'
import {
  findPageBySlug,
  collectAllPages,
  slugToHref,
  buildHrefToSlugMap,
  type NavHeading,
} from './navigation.ts'
import {
  base,
  config,
  navigation,
  firstPage,
  collectAncestorGroupKeys,
  resolveActiveTabHref,
} from './data.ts'
import { deduplicateRedirects, interpolateDestination } from './lib/redirects.ts'
import { isAgentRequest } from './lib/raw-markdown.ts'
import { buildSections, isHeroNode } from './lib/mdx-sections.ts'
import { RenderNodes } from './lib/mdx-components-map.tsx'
import { SiteHead } from './lib/site-head.tsx'

export type HolocronLoaderData = {
  currentPageHref: string | undefined
  currentPageTitle: string | undefined
  currentPageDescription: string | undefined
  currentHeadings: NavHeading[]
  ancestorGroupKeys: string[]
  activeTabHref: string | undefined
  notFoundPath: string | undefined
  headTitle: string
  headRobots: string | undefined
}

const POWERED_BY_FOOTER = '\n\n---\n\n*Powered by [holocron.so](https://holocron.so)*\n'

function withBaseRoute(base: string, route: string): string[] {
  if (!base) return [route]
  return [route, `${base}${route === '/' ? '' : route}`]
}

function stripBaseFromSlug(rawSlug: string, base: string): string {
  if (!base) return rawSlug
  const withSlash = `/${rawSlug}`
  const hasBase = withSlash === base || withSlash.startsWith(base + '/')
  if (!hasBase) return rawSlug
  return withSlash.slice(base.length).replace(/^\//, '')
}

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

export function createHolocronApp() {
  let app: AnySpiceflow = new Spiceflow().use(serveStatic({ root: './public' }))

  for (const rule of deduplicateRedirects(config.redirects)) {
    for (const route of withBaseRoute(base, rule.source)) {
      app = app.get(route, ({ request, params }: { request: Request; params: Record<string, string> }) => {
        const url = new URL(request.url)
        const allParams = { ...params, splat: params['*'] ?? '' }
        let dest = interpolateDestination(rule.destination, allParams)
        if (!dest.includes('?') && url.search) dest += url.search
        throw redirect(dest, { status: rule.permanent ? 301 : 302 })
      })
    }
  }

  const hrefToSlug = buildHrefToSlugMap(mdxContent)
  app = app.use(({ request }: { request: Request }) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return
    if (!isAgentRequest(request)) return

    const url = new URL(request.url)
    let pathname = url.pathname
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }
    if (pathname.endsWith('.md') || pathname.endsWith('.xml') || pathname.startsWith('/api')) return

    const hasBase = !!base && (pathname === base || pathname.startsWith(base + '/'))
    const stripped = hasBase ? pathname.slice(base.length) || '/' : pathname
    if (!hrefToSlug.has(stripped)) return

    const mdPath = stripped === '/' ? '/index.md' : `${stripped}.md`
    return Response.redirect(new URL(base + mdPath + url.search, url.origin).href, 302)
  })

  for (const route of withBaseRoute(base, '/sitemap.xml')) {
    app = app.get(route, ({ request }: { request: Request }) => {
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
          'x-content-type-options': 'nosniff',
        },
      })
    })
  }

  for (const slug of Object.keys(mdxContent)) {
    const href = slugToHref(slug)
    const mdPath = href === '/' ? '/index.md' : `${href}.md`
    const mdx = mdxContent[slug]!

    for (const route of withBaseRoute(base, mdPath)) {
      app = app.get(route, () => {
        return new Response(mdx + POWERED_BY_FOOTER, {
          headers: {
            'content-type': 'text/markdown; charset=utf-8',
            'cache-control': 's-maxage=300, stale-while-revalidate=86400',
            'x-content-type-options': 'nosniff',
          },
        })
      })
    }
  }

  for (const route of withBaseRoute(base, '/api/search')) {
    app = app.get(route, ({ request }: { request: Request }) => {
      const url = new URL(request.url)
      const query = url.searchParams.get('q') || ''
      const allPages = collectAllPages(navigation)
      const results = allPages
        .flatMap((page) => [
          { title: page.title, href: `${base}${page.href}`, type: 'page' as const },
          ...page.headings.map((h) => ({
            title: h.text,
            href: `${base}${page.href}#${h.slug}`,
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
  }

  app = app.loader('/*', async ({ params, response }): Promise<HolocronLoaderData> => {
    const rawSlug = params['*'] || ''
    const strippedSlug = stripBaseFromSlug(rawSlug, base)
    const slug = strippedSlug === '' ? 'index' : strippedSlug

    const currentPage = findPageBySlug(navigation, slug, mdxContent)
    const hasMdx = mdxContent[slug] !== undefined

    if (!currentPage && (slug === 'index' || slug === '') && firstPage) {
      throw redirect(firstPage.href)
    }

    if (!currentPage || !hasMdx) {
      response.status = 404
      return {
        currentPageHref: undefined,
        currentPageTitle: undefined,
        currentPageDescription: undefined,
        currentHeadings: [],
        ancestorGroupKeys: firstPage ? collectAncestorGroupKeys(firstPage.href) : [],
        activeTabHref: resolveActiveTabHref(firstPage?.href),
        notFoundPath: '/' + strippedSlug,
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

  app = app.layout('/*', async ({ children, request, loaderData: rawLoaderData }) => {
    const loaderData = rawLoaderData as HolocronLoaderData
    const cookies = parseCookies(request.headers.get('cookie') || '')
    const cookieTheme = config.appearance.strict
      ? null
      : (cookies['holocron-theme'] as 'light' | 'dark' | undefined) ?? null
    const isDark =
      cookieTheme === 'dark' ||
      (!cookieTheme && config.appearance.default === 'dark')

    const isNotFound = children === null
    const bannerJsx = getBannerJsx(request)
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
        data-default-theme={config.appearance.default}
        {...(config.appearance.strict ? { 'data-strict-theme': '' } : {})}
      >
        <SiteHead
          config={config}
          titleOverride={isNotFound ? (loaderData?.headTitle ?? `Page not found — ${config.name}`) : undefined}
        />
        {isNotFound && (
          <Head>
            <Head.Meta name='robots' content='noindex' />
          </Head>
        )}
        <body>{children ?? notFoundContent}</body>
      </html>
    )
  })

  for (const slug of Object.keys(mdxContent)) {
    const pageHref = slugToHref(slug)

    for (const route of withBaseRoute(base, pageHref)) {
      app = app.page(route, async ({ loaderData: rawLoaderData, request }) => {
        const loaderData = rawLoaderData as HolocronLoaderData
        const bannerJsx = getBannerJsx(request)
        return renderMdxPage(slug, loaderData, bannerJsx)
      })
    }
  }

  return app
}

export type HolocronApp = ReturnType<typeof createHolocronApp>
