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
 *
 *   Middleware (cross-cutting):
 *     .use(serveStatic)     → public files
 *     .use(redirects)       → config-driven redirects
 *     .use(agentRedirect)   → 302 AI agents to .md URLs
 *
 * Canonical site data (config, navigation, switchers, icons, base) is passed
 * in when the app is created. The root loader serializes the visible client
 * copy so both server and client components can read the same `site` object
 * through `useHolocronData()`.
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
import { getAbsoluteOgImageUrl, resolveOgIconUrl } from './lib/og-utils.ts'
import { getPageRobots, getPageSeoMeta, isIndexablePage, serializeKeywords, type PageFrontmatter } from './lib/page-frontmatter.ts'
import type { ModelMessage } from 'ai'
import {
  buildVisibleSiteData,
  type HolocronSiteData,
  collectAncestorGroupKeys,
  findFirstPage,
  resolveActiveDropdownHref,
  resolveActiveTabHref,
  resolveActiveVersionHref,
} from './site-data.ts'

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

/* ── Constants ───────────────────────────────────────────────────────── */

const POWERED_BY_FOOTER = '\n\n---\n\n*Powered by [holocron.so](https://holocron.so)*\n'

/* ── Shared helpers ──────────────────────────────────────────────────── */

function withBaseRoute(base: string, route: string): string {
  const normalizedBase = base === '/' ? '' : `/${base.replace(/^\/+|\/+$/g, '')}`
  if (!normalizedBase) return route
  if (route === '/') return normalizedBase
  return `${normalizedBase}${route}`
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
  return <RenderNodes markdown={bannerMdx} nodes={bannerMdast.children} />
}

function renderMdxPage(
  site: HolocronSiteData,
  slug: string,
  loaderData: HolocronLoaderData,
  bannerJsx: React.ReactNode | undefined,
  ogImageUrl: string,
) {
  const pageMdx = mdxContent[slug]!
  const pageSeoMeta = getPageSeoMeta(loaderData.currentPageFrontmatter)
  const pageKeywords = serializeKeywords(loaderData.currentPageFrontmatter?.keywords)
  const pageOgImage = pageSeoMeta['og:image'] ?? ogImageUrl
  const pageTwitterImage = pageSeoMeta['twitter:image'] ?? pageOgImage
  const pageOgDescription = pageSeoMeta['og:description'] ?? loaderData.currentPageDescription
  const pageTwitterDescription = pageSeoMeta['twitter:description'] ?? loaderData.currentPageDescription
  const pageOgTitle = pageSeoMeta['og:title'] ?? loaderData.headTitle
  const pageTwitterTitle = pageSeoMeta['twitter:title'] ?? loaderData.headTitle
  const pageTwitterCard = pageSeoMeta['twitter:card'] ?? 'summary_large_image'

  const mdast = mdxParse(pageMdx)
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
      <EditorialPage sections={sections} hero={hero} bannerContent={bannerJsx} />
    </>
  )
}

type ChatRequestPart = {
  type: string
  text?: string
}

type ChatRequestMessage = {
  id?: string
  role: 'user' | 'assistant'
  parts: ChatRequestPart[]
}

type ChatRequestBody = {
  messages: ChatRequestMessage[]
  previousMessages?: ModelMessage[]
  currentSlug: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isChatRole(role: unknown): role is ChatRequestMessage['role'] {
  return role === 'user' || role === 'assistant'
}

function isModelMessage(value: unknown): value is ModelMessage {
  return isRecord(value) && typeof value.role === 'string' && 'content' in value
}

function parseChatRequestBody(value: unknown): ChatRequestBody {
  if (!isRecord(value) || !Array.isArray(value.messages) || typeof value.currentSlug !== 'string') {
    throw new Error('Invalid chat request body')
  }

  const messages = value.messages.flatMap((message): ChatRequestMessage[] => {
    if (!isRecord(message) || !isChatRole(message.role) || !Array.isArray(message.parts)) {
      return []
    }
    const parts = message.parts.flatMap((part): ChatRequestPart[] => {
      if (!isRecord(part) || typeof part.type !== 'string') {
        return []
      }
      return [{ type: part.type, ...(typeof part.text === 'string' ? { text: part.text } : {}) }]
    })
    return [{
      role: message.role,
      ...(typeof message.id === 'string' ? { id: message.id } : {}),
      parts,
    }]
  })

  const previousMessages = Array.isArray(value.previousMessages)
    ? value.previousMessages.filter(isModelMessage)
    : undefined

  return {
    messages,
    currentSlug: value.currentSlug,
    ...(previousMessages ? { previousMessages } : {}),
  }
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

/* ── App factory ─────────────────────────────────────────────────────── */

export function createHolocronApp(site: HolocronSiteData) {
  // AnySpiceflow during the imperative route-registration loop (TS can't
  // track type evolution across loop iterations), then cast back to a
  // typed chain at the end so HolocronApp retains loader type info.
  let app: AnySpiceflow = new Spiceflow().use(serveStatic({ root: './public' }))
  const firstPage = findFirstPage(site)
  const clientSite = buildVisibleSiteData(site)
  const absoluteUrlBase = (() => {
    const routeBase = withBaseRoute(site.base, '/')
    return routeBase === '/' ? '' : routeBase
  })()

  // ── Redirects ───────────────────────────────────────────────────
  // All redirects are .get() routes — spiceflow's trie router handles
  // specificity natively (exact beats :param beats *).
  for (const rule of deduplicateRedirects(site.config.redirects)) {
    for (const source of new Set([rule.source, withBaseRoute(site.base, rule.source)])) {
      app = app.get(source, ({ request, params }: { request: Request; params: Record<string, string> }) => {
        const url = new URL(request.url)
        // Map spiceflow's * capture to :splat for destination interpolation
        const allParams = { ...params, splat: params['*'] ?? '' }
        let dest = interpolateDestination(rule.destination, allParams)
        if (!dest.includes('?') && url.search) dest += url.search
        throw redirect(dest, { status: rule.permanent ? 301 : 302 })
      })
    }
  }

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

    const baseRoute = withBaseRoute(site.base, '/')
    const normalizedBase = baseRoute === '/' ? '' : baseRoute
    const hasBase = !!normalizedBase && (pathname === normalizedBase || pathname.startsWith(normalizedBase + '/'))
    const stripped = hasBase ? pathname.slice(normalizedBase.length) || '/' : pathname
    if (!hrefToSlug.has(stripped)) return

    const mdPath = stripped === '/' ? '/index.md' : `${stripped}.md`
    return Response.redirect(new URL(withBaseRoute(site.base, mdPath) + url.search, url.origin).href, 302)
  })

  // ── Explicit GET routes ────────────────────────────────────────

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

  // Per-page .md routes
  for (const slug of Object.keys(mdxContent)) {
    const href = slugToHref(slug)
    const mdPath = href === '/' ? '/index.md' : `${href}.md`
    const mdx = mdxContent[slug]!

    for (const route of new Set([mdPath, withBaseRoute(site.base, mdPath)])) {
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

  // /docs.zip — all markdown files in a single zip archive.
  // Agents can fetch this one endpoint to get the entire docs site.
  for (const docsZipRoute of new Set(['/docs.zip', withBaseRoute(site.base, '/docs.zip')])) {
    app = app.get(docsZipRoute, () => {
      const files: Record<string, Uint8Array> = {}
      for (const [slug, mdx] of Object.entries(mdxContent)) {
        files[slug + '.md'] = strToU8(mdx + POWERED_BY_FOOTER)
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

  for (const ogRoute of new Set(['/og', withBaseRoute(site.base, '/og')])) {
    app = app.get(ogRoute, async ({ request }: { request: Request }) => {
      const { createOgImageResponse } = await import('./lib/og.tsx')
      const requestUrl = new URL(request.url)
      const iconUrl = resolveOgIconUrl(site.config, request.url)
      const response = createOgImageResponse({
        title: site.config.name,
        description: site.config.description,
        iconUrl,
        siteName: site.config.name,
        pageLabel: `${requestUrl.host}/`,
      })
      response.headers.set('cache-control', 's-maxage=3600')
      return response
    })
  }

  for (const ogWildcardRoute of new Set(['/og/*', withBaseRoute(site.base, '/og/*')])) {
    app = app.get(ogWildcardRoute, async ({ request, params }: { request: Request; params: Record<string, string> }) => {
      const { createOgImageResponse } = await import('./lib/og.tsx')
      const requestUrl = new URL(request.url)
      const rawSlug = params['*'] || ''
      const slug = stripBaseFromSlug(rawSlug, site.base).replace(/^\//, '')
      const page = findPageBySlug(site.navigation, slug, mdxContent)

      if (!page) {
        return new Response('Not found', { status: 404 })
      }

      const iconUrl = resolveOgIconUrl(site.config, request.url)
      const response = createOgImageResponse({
        title: page.title,
        description: page.description ?? site.config.description,
        iconUrl,
        siteName: site.config.name,
        pageLabel: `${requestUrl.host}${page.href}`,
      })
      response.headers.set('cache-control', 's-maxage=3600')
      return response
    })
  }

  // /holocron-api/logo/:theme/<text>.png — generated fallback logo images.
  app = app.get('/holocron-api/logo/:theme/*', async ({ params }: { params: Record<string, string> }) => {
    const theme: GeneratedLogoTheme | undefined = params.theme === 'light' || params.theme === 'dark' ? params.theme : undefined
    if (!theme) {
      return new Response('Not found', { status: 404 })
    }

    const text = decodeGeneratedLogoText(params['*'] || '')
    const { createGeneratedLogoResponse } = await import('./lib/generated-logo-response.tsx')
    const response = await createGeneratedLogoResponse({ text, theme })
    response.headers.set('cache-control', 's-maxage=31536000, immutable')
    return response
  })

  // /holocron-api/chat — AI assistant endpoint.
  // Streams server-rendered JSX parts via federation. The LLM uses
  // bash-tool to search/read docs in a virtual filesystem.
  for (const chatRoute of new Set(['/holocron-api/chat', withBaseRoute(site.base, '/holocron-api/chat')])) {
    app = app.post(chatRoute, async ({ request }: { request: Request }) => {
      const { streamText } = await import('ai')
      const { openai } = await import('@ai-sdk/openai')
      const { createBashTool } = await import('bash-tool')

      const body = parseChatRequestBody(await request.json())

      // Build virtual filesystem with all docs
      const files: Record<string, string> = {}
      for (const [slug, mdx] of Object.entries(mdxContent)) {
        files[`/docs/${slug}.mdx`] = mdx
      }

      const { tools } = await createBashTool({ files })

      // Build system prompt
      const allPages = collectAllPages(site.navigation)
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
        You are a documentation assistant for ${site.config.name || 'this site'}.

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
        role: msg.role,
        content:
          msg.parts
            ?.filter((p) => p.type === 'text' && p.text)
            .map((p) => p.text!)
            .join('\n') || '',
      }))

      const previousMessages = body.previousMessages ?? []
      const messages: ModelMessage[] = [
        { role: 'system', content: systemPrompt },
        ...previousMessages,
        ...newUserMessages,
      ]

      const result = streamText({
        model: openai('gpt-5.4-nano'),
        tools: { bash: tools.bash },
        messages,
        stopWhen: (event) => event.steps.length >= 30,
      })

      // Process UIMessageChunk stream — each chunk type maps 1:1 to a yield.
      // text-end marks the natural boundary for completed text parts.
      // Session snapshots are yielded after each completed piece for resumability.
      const uiStream = result.toUIMessageStream()
      let textBuffer = ''
      const toolNames = new Map<string, string>()
      // Accumulate raw AI SDK messages for session continuity
      const sessionMessages: ModelMessage[] = [
        ...previousMessages,
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
              const mdast = mdxParse(textBuffer)
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
              args: getToolArgs(chunk.input),
            }
            // Push assistant tool-call message (don't snapshot yet — wait for result)
            sessionMessages.push({
              role: 'assistant',
              content: [{ type: 'tool-call', toolCallId: chunk.toolCallId, toolName: chunk.toolName, input: chunk.input }],
            })
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
            // Push tool result message + snapshot (tool round-trip complete)
            sessionMessages.push({
              role: 'tool',
              content: [{
                type: 'tool-result',
                toolCallId: chunk.toolCallId,
                toolName: toolNames.get(chunk.toolCallId) || 'bash',
                output: { type: 'text', value: JSON.stringify(chunk.output) },
              }],
            })
            yield { type: 'session' as const, messages: [...sessionMessages] }
            continue
          }
        }
      }

      return await encodeFederationPayload({ stream: generateParts() })
    })
  }

  // ── Shared loader + layout ─────────────────────────────────────

  app = app.loader('/*', async ({ params, response }): Promise<HolocronLoaderData> => {
    const rawSlug = params['*'] || ''
    const strippedSlug = stripBaseFromSlug(rawSlug, site.base)
    const slug = strippedSlug === '' ? 'index' : strippedSlug

    const currentPage = findPageBySlug(site.navigation, slug, mdxContent)
    const hasMdx = mdxContent[slug] !== undefined

    // Root path with no index page → redirect to first page in navigation
    if (!currentPage && (slug === 'index' || slug === '') && firstPage) {
      throw redirect(withBaseRoute(site.base, firstPage.href))
    }

    // 404 case
    if (!currentPage || !hasMdx) {
      response.status = 404
      return {
        site: clientSite,
        currentPageHref: undefined,
        currentPageTitle: undefined,
        currentPageDescription: undefined,
        currentHeadings: [],
        ancestorGroupKeys: firstPage ? collectAncestorGroupKeys(site, firstPage.href) : [],
        activeTabHref: resolveActiveTabHref(site, firstPage?.href),
        activeVersionHref: resolveActiveVersionHref(site, firstPage?.href),
        activeDropdownHref: resolveActiveDropdownHref(site, firstPage?.href),
        notFoundPath: '/' + strippedSlug,
        headTitle: `Page not found — ${site.config.name}`,
        headRobots: 'noindex',
        currentPageFrontmatter: undefined,
      }
    }

    return {
      site: clientSite,
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
  })

  app = app.layout('/*', async ({ children, request, loaderData: rawLoaderData }) => {
    if (!isHolocronLoaderData(rawLoaderData)) {
      throw new Error('Holocron loader data missing in layout')
    }
    const loaderData = rawLoaderData
    const cookies = parseCookies(request.headers.get('cookie') || '')
    const cookieTheme = site.config.appearance.strict
      ? null
      : (cookies['holocron-theme'] === 'light' || cookies['holocron-theme'] === 'dark' ? cookies['holocron-theme'] : null)
    const isDark =
      cookieTheme === 'dark' ||
      (!cookieTheme && site.config.appearance.default === 'dark')

    // When no page route matches, spiceflow passes children=null.
    // Render the custom 404 inside the editorial layout so users
    // can still navigate via the sidebar.
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
        <body>{children ?? notFoundContent}</body>
      </html>
    )
  })

  // ── Per-page .page() routes ────────────────────────────────────
  for (const slug of Object.keys(mdxContent)) {
    const pageHref = slugToHref(slug)

    for (const route of new Set([pageHref, withBaseRoute(site.base, pageHref)])) {
      app = app.page(route, async ({ loaderData: rawLoaderData, request }) => {
        if (!isHolocronLoaderData(rawLoaderData)) {
          throw new Error('Holocron loader data missing in page route')
        }
        const loaderData = rawLoaderData
        const bannerJsx = getBannerJsx(site, request)
        const ogImageUrl = getAbsoluteOgImageUrl(request.url, absoluteUrlBase, loaderData.currentPageHref ?? pageHref)
        return renderMdxPage(site, slug, loaderData, bannerJsx, ogImageUrl)
      })
    }
  }

  return app
}


/* ── Public type for the client router ───────────────────────────────── */

/**
 * The fully-typed Spiceflow app instance. Use this with `getRouter<App>()`
 * in client code to get typed `useLoaderData`, `href`, and `router` bindings.
 * The actual router module (`./router.ts`) already does this — client
 * components should import from `@holocron.so/vite/react` directly.
 */
export type HolocronApp = ReturnType<typeof createHolocronApp>
