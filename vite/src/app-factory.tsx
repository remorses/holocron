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
 *     .get('/holocron-api/search')  → search API
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
import { Spiceflow, type AnySpiceflow, serveStatic, redirect } from 'spiceflow'
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
  resolveActiveVersionHref,
  resolveActiveDropdownHref,
} from './data.ts'
import { deduplicateRedirects, interpolateDestination } from './lib/redirects.ts'
import { isAgentRequest } from './lib/raw-markdown.ts'
import { zipSync, strToU8 } from 'fflate'
import { buildSections, isHeroNode } from './lib/mdx-sections.ts'
import { RenderNodes } from './lib/mdx-components-map.tsx'
import {
  decodeGeneratedLogoText,
  type GeneratedLogoTheme,
} from './lib/generated-logo.tsx'
import { SiteHead } from './lib/site-head.tsx'
import { encodeFederationPayload } from 'spiceflow/federation'
import { ChatRenderNodes } from './lib/chat-render.tsx'
import dedent from 'string-dedent'
import { getAbsoluteOgImageUrl } from './lib/og-utils.ts'

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
  ogImageUrl: string,
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
        <Head.Meta property='og:title' content={loaderData.headTitle} />
        {loaderData.currentPageDescription && (
          <>
            <Head.Meta name='description' content={loaderData.currentPageDescription} />
            <Head.Meta property='og:description' content={loaderData.currentPageDescription} />
            <Head.Meta name='twitter:description' content={loaderData.currentPageDescription} />
          </>
        )}
        <Head.Meta property='og:image' content={ogImageUrl} />
        <Head.Meta name='twitter:image' content={ogImageUrl} />
        <Head.Meta name='twitter:card' content='summary_large_image' />
      </Head>
      <EditorialPage sections={sections} hero={hero} bannerContent={bannerJsx} />
    </>
  )
}

function parseGeneratedLogoTheme(theme: string | undefined): GeneratedLogoTheme | undefined {
  return theme === 'light' || theme === 'dark' ? theme : undefined
}

/* ── App factory ─────────────────────────────────────────────────────── */

export function createHolocronApp() {
  // AnySpiceflow during the imperative route-registration loop (TS can't
  // track type evolution across loop iterations), then cast back to a
  // typed chain at the end so HolocronApp retains loader type info.
  let app: AnySpiceflow = new Spiceflow().use(serveStatic({ root: './public' }))

  // ── Redirects ───────────────────────────────────────────────────
  // All redirects are .get() routes — spiceflow's trie router handles
  // specificity natively (exact beats :param beats *).
  for (const rule of deduplicateRedirects(config.redirects)) {
    app = app.get(rule.source, ({ request, params }: { request: Request; params: Record<string, string> }) => {
      const url = new URL(request.url)
      // Map spiceflow's * capture to :splat for destination interpolation
      const allParams = { ...params, splat: params['*'] ?? '' }
      let dest = interpolateDestination(rule.destination, allParams)
      if (!dest.includes('?') && url.search) dest += url.search
      throw redirect(dest, { status: rule.permanent ? 301 : 302 })
    })
  }

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
    // Don't redirect .md, .xml, or /holocron-api/ requests
    if (pathname.endsWith('.md') || pathname.endsWith('.xml') || pathname.endsWith('.zip') || pathname.startsWith('/holocron-api/')) return

    // Strip base from pathname for lookup (spiceflow may or may not
    // strip the base depending on middleware vs route context).
    // Use boundary check so /docsgetting-started doesn't match base=/docs.
    const hasBase = !!base && (pathname === base || pathname.startsWith(base + '/'))
    const stripped = hasBase ? pathname.slice(base.length) || '/' : pathname
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
        'x-content-type-options': 'nosniff',
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
          'x-content-type-options': 'nosniff',
        },
      })
    })
  }

  // /docs.zip — all markdown files in a single zip archive.
  // Agents can fetch this one endpoint to get the entire docs site.
  app = app.get('/docs.zip', () => {
    const files: Record<string, Uint8Array> = {}
    for (const [slug, mdx] of Object.entries(mdxContent)) {
      files[slug + '.md'] = strToU8(mdx + POWERED_BY_FOOTER)
    }
    const zipped = zipSync(files)
    return new Response(zipped.buffer as ArrayBuffer, {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': 'attachment; filename="docs.zip"',
        'cache-control': 's-maxage=300, stale-while-revalidate=86400',
        'x-content-type-options': 'nosniff',
      },
    })
  })

  app = app.get('/og', async ({ request }: { request: Request }) => {
    const { createOgImageResponse } = await import('./lib/og.tsx')
    const { resolveOgIconUrl } = await import('./lib/og-utils.ts')
    const requestUrl = new URL(request.url)
    const iconUrl = resolveOgIconUrl(config, request.url)
    const response = createOgImageResponse({
      title: config.name,
      description: config.description,
      iconUrl,
      siteName: config.name,
      pageLabel: `${requestUrl.host}/`,
    })
    response.headers.set('cache-control', 'public, max-age=3600, s-maxage=3600')
    return response
  })

  app = app.get('/og/*', async ({ request, params }: { request: Request; params: Record<string, string> }) => {
    const { createOgImageResponse } = await import('./lib/og.tsx')
    const { resolveOgIconUrl } = await import('./lib/og-utils.ts')
    const requestUrl = new URL(request.url)
    const rawSlug = params['*'] || ''
    const slug = rawSlug.replace(/^\//, '')
    const page = findPageBySlug(navigation, slug, mdxContent)

    if (!page) {
      return new Response('Not found', { status: 404 })
    }

    const iconUrl = resolveOgIconUrl(config, request.url)
    const response = createOgImageResponse({
      title: page.title,
      description: page.description ?? config.description,
      iconUrl,
      siteName: config.name,
      pageLabel: `${requestUrl.host}${page.href}`,
    })
    response.headers.set('cache-control', 'public, max-age=3600, s-maxage=3600')
    return response
  })

  // /holocron-api/logo/:theme/<text>.png — generated fallback logo images.
  app = app.get('/holocron-api/logo/:theme/*', async ({ params }: { params: Record<string, string> }) => {
    const theme = parseGeneratedLogoTheme(params.theme)
    if (!theme) {
      return new Response('Not found', { status: 404 })
    }

    const text = decodeGeneratedLogoText(params['*'] || '')
    const { createGeneratedLogoResponse } = await import('./lib/generated-logo.tsx')
    const response = createGeneratedLogoResponse({ text, theme })
    response.headers.set('cache-control', 'public, max-age=31536000, s-maxage=31536000, immutable')
    return response
  })

  // /holocron-api/search
  app = app.get('/holocron-api/search', ({ request }: { request: Request }) => {
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

  // /holocron-api/chat — AI assistant endpoint.
  // Streams server-rendered JSX parts via federation. The LLM uses
  // bash-tool to search/read docs in a virtual filesystem.
  app = app.post('/holocron-api/chat', async ({ request }: { request: Request }) => {
    const { streamText } = await import('ai')
    const { openai } = await import('@ai-sdk/openai')
    const { createBashTool } = await import('bash-tool')

    const body = (await request.json()) as {
      messages: Array<{ id?: string; role: string; parts: Array<{ type: string; text?: string }> }>
      previousMessages?: unknown[]
      currentSlug: string
    }

    // Build virtual filesystem with all docs
    const files: Record<string, string> = {}
    for (const [slug, mdx] of Object.entries(mdxContent)) {
      files[`/docs/${slug}.mdx`] = mdx
    }

    const { tools } = await createBashTool({ files })

    // Build system prompt
    const allPages = collectAllPages(navigation)
    const pageIndex = allPages
      .map((p) => `- /docs/${p.slug}.mdx  "${p.title}"`)
      .join('\n')
    const currentPageMdx = (() => {
      // Try to find the mdx content for the current page
      for (const [slug, mdx] of Object.entries(mdxContent)) {
        const href = slugToHref(slug)
        if (href === body.currentSlug || slug === body.currentSlug) {
          return mdx
        }
      }
      return ''
    })()

    const systemPrompt = dedent`
      You are a documentation assistant for ${config.name || 'this site'}.

      The user is currently reading: ${body.currentSlug}

      Current page content:
      ---
      ${currentPageMdx.slice(0, 4000)}
      ---

      All documentation files (use bash to search/read when you need more context):
      ${pageIndex}

      Use the bash tool to search and read documentation files.
      Files are at /docs/<slug>.mdx — use grep -rn "term" /docs/ to search, cat /docs/slug.mdx to read.
      Answer concisely based on the documentation. Include code examples when relevant.
    `

    // Convert new user messages from UIMessage parts format
    const newUserMessages = body.messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content:
        msg.parts
          ?.filter((p) => p.type === 'text' && p.text)
          .map((p) => p.text!)
          .join('\n') || '',
    }))

    const messages = [
      { role: 'system', content: systemPrompt },
      ...((body.previousMessages as unknown[]) || []),
      ...newUserMessages,
    ]

    const result = streamText({
      model: openai('gpt-5.4-nano'),
      tools: { bash: tools.bash },
      messages: messages as any,
      stopWhen: (event) => event.steps.length >= 30,
    })

    // Process UIMessageChunk stream — each chunk type maps 1:1 to a yield.
    // text-end marks the natural boundary for completed text parts.
    // Session snapshots are yielded after each completed piece for resumability.
    const uiStream = result.toUIMessageStream()
    let textBuffer = ''
    const toolNames = new Map<string, string>()
    // Accumulate raw AI SDK messages for session continuity
    const sessionMessages: unknown[] = [
      ...((body.previousMessages as unknown[]) || []),
      ...newUserMessages,
    ]

    async function* generateParts() {
      for await (const chunk of uiStream) {
        if (chunk.type === 'text-delta') {
          textBuffer += chunk.delta
          continue
        }

        if (chunk.type === 'text-end') {
          if (textBuffer.trim()) {
            const mdast = mdxParse(textBuffer) as Root
            const jsx = (
              <ChatRenderNodes
                markdown={textBuffer}
                nodes={mdast.children}
              />
            )
            yield { type: 'text' as const, jsx, text: textBuffer }
            sessionMessages.push({ role: 'assistant', content: textBuffer })
            yield { type: 'session' as const, messages: [...sessionMessages] }
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
            args: chunk.input as Record<string, unknown>,
          }
          // Push assistant tool-call message (don't snapshot yet — wait for result)
          sessionMessages.push({
            role: 'assistant',
            content: [{ type: 'tool-call', toolCallId: chunk.toolCallId, toolName: chunk.toolName, args: chunk.input }],
          })
          continue
        }

        if (chunk.type === 'tool-output-available') {
          const rawOutput = chunk.output as { stdout?: string; stderr?: string }
          yield {
            type: 'tool-result' as const,
            toolCallId: chunk.toolCallId,
            toolName: toolNames.get(chunk.toolCallId) || 'bash',
            output: (rawOutput?.stdout || '').slice(0, 500),
            ...(rawOutput?.stderr ? { error: rawOutput.stderr } : {}),
          }
          // Push tool result message + snapshot (tool round-trip complete)
          sessionMessages.push({
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId: chunk.toolCallId, result: chunk.output }],
          })
          yield { type: 'session' as const, messages: [...sessionMessages] }
          continue
        }
      }
    }

    return await encodeFederationPayload({ stream: generateParts() })
  })

  // ── Shared loader + layout ─────────────────────────────────────

  app = app.loader('/*', async ({ params, response }): Promise<HolocronLoaderData> => {
    const rawSlug = params['*'] || ''
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
        activeVersionHref: resolveActiveVersionHref(firstPage?.href),
        activeDropdownHref: resolveActiveDropdownHref(firstPage?.href),
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
      activeVersionHref: resolveActiveVersionHref(currentPage.href),
      activeDropdownHref: resolveActiveDropdownHref(currentPage.href),
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

    // When no page route matches, spiceflow passes children=null.
    // Render the custom 404 inside the editorial layout so users
    // can still navigate via the sidebar.
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

  // ── Per-page .page() routes ────────────────────────────────────
  for (const slug of Object.keys(mdxContent)) {
    const pageHref = slugToHref(slug)

    app = app.page(pageHref, async ({ loaderData: rawLoaderData, request }) => {
      const loaderData = rawLoaderData as HolocronLoaderData
      const bannerJsx = getBannerJsx(request)
      const ogImageUrl = getAbsoluteOgImageUrl(request.url, base, loaderData.currentPageHref ?? pageHref)
      return renderMdxPage(slug, loaderData, bannerJsx, ogImageUrl)
    })
  }

  return app
}


/* ── Public type for the client router ───────────────────────────────── */

/**
 * The fully-typed Spiceflow app instance. Use this with `createRouter<App>()`
 * in client code to get typed `useLoaderData`, `href`, and `router` bindings.
 * The actual router module (`./router.ts`) already does this — client
 * components should import from `@holocron.so/vite/react` directly.
 */
export type HolocronApp = ReturnType<typeof createHolocronApp>
