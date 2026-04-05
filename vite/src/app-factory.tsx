/**
 * Holocron app factory — creates the Spiceflow app with all routes
 * (.loader, .layout, .page, /api/search).
 *
 * Architecture:
 *
 *   .loader('/*')  → per-request minimal data (current page, headings,
 *                    ancestor keys). RSC-flight serialized to both server
 *                    page handler and client components (via useHolocronData).
 *
 *   .page('/*')    → parses MDX, renders sections/hero as server JSX,
 *                    hands them to EditorialPage.
 *
 * Static site data (navigation tree, tabs, header links, search entries)
 * lives in `./data.ts` and is bundled into the client chunk ONCE — never
 * re-shipped through the per-request loader payload.
 *
 * All MDX content and image metadata is pre-processed at build time.
 * Request-time rendering is just: parse mdast → render RSC components.
 * Zero file I/O, zero sharp, zero image-size — works on Cloudflare.
 */

import '@holocron.so/vite/styles/globals.css'
import React from 'react'
import { Spiceflow, serveStatic, redirect } from 'spiceflow'
import { Head } from 'spiceflow/react'
import { mdxParse } from 'safe-mdx/parse'
import type { Root } from 'mdast'
import mdxContent from 'virtual:holocron-mdx'
import {
  EditorialPage,
  type EditorialSection,
} from '@holocron.so/vite/components/markdown'
import { NotFound } from './components/not-found.tsx'
import {
  findPage,
  collectAllPages,
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

/* ── App factory ─────────────────────────────────────────────────────── */

export function createHolocronApp() {
  let app = new Spiceflow().use(serveStatic({ root: './public' }))

  // Install config-driven redirects as `.use()` middleware. Runs
  // before loader/layout/page — on match, throws a redirect Response
  // that short-circuits the request pipeline. See lib/redirects.ts
  // and MEMORY.md for why middleware + custom matcher instead of
  // spiceflow routes.
  app = registerRedirects(app, config.redirects)

  return app
    .loader('/*', async ({ params, response }): Promise<HolocronLoaderData> => {
      const rawSlug = (params as Record<string, string>)['*'] || ''
      const slug = rawSlug === '' ? 'index' : rawSlug

      const currentPage = findPage(navigation, slug)
      const hasMdx = currentPage ? mdxContent[slug] !== undefined : false

      // Root path with no index page → redirect to first page in navigation
      if (!currentPage && (slug === 'index' || slug === '') && firstPage) {
        throw redirect(firstPage.href)
      }

      // 404 case — either the page isn't in navigation, or its MDX is missing
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
    .layout('/*', async ({ children }) => {
      return (
        <html lang='en'>
          <SiteHead config={config} />
          <body>{children}</body>
        </html>
      )
    })
    .page('/*', async ({ params, loaderData: rawLoaderData }) => {
      // Spiceflow's page-handler context does not (yet) thread the loader
      // return type into its own `loaderData` slot — only the typed client
      // router exposes it. Cast once here so the rest of the handler is safe.
      const loaderData = rawLoaderData as unknown as HolocronLoaderData

      // 404 branch — render inside the normal shell so the user can navigate
      if (loaderData.notFoundPath) {
        return (
          <>
            <Head>
              <Head.Title>{loaderData.headTitle}</Head.Title>
              {loaderData.headRobots && (
                <Head.Meta name='robots' content={loaderData.headRobots} />
              )}
            </Head>
            <EditorialPage>
              <NotFound
                path={loaderData.notFoundPath}
                homeHref={firstPage?.href || '/'}
              />
            </EditorialPage>
          </>
        )
      }

      // Happy path — parse MDX and render sections + hero as server JSX
      const rawSlug = (params as Record<string, string>)['*'] || ''
      const slug = rawSlug === '' ? 'index' : rawSlug
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
          <EditorialPage sections={sections} hero={hero} />
        </>
      )
    })
    .get('/api/search', async ({ request }) => {
      const url = new URL(request.url)
      const query = url.searchParams.get('q') || ''

      const allPages = collectAllPages(navigation)
      const results = allPages
        .flatMap((page) => {
          return [
            { title: page.title, href: page.href, type: 'page' as const },
            ...page.headings.map((h) => {
              return {
                title: h.text,
                href: `${page.href}#${h.slug}`,
                type: 'heading' as const,
              }
            }),
          ]
        })
        .filter((item) => {
          return item.title.toLowerCase().includes(query.toLowerCase())
        })
        .slice(0, 20)

      return new Response(JSON.stringify(results), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 's-maxage=300, stale-while-revalidate=86400',
        },
      })
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
