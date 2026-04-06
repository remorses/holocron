/**
 * Raw markdown middleware + sitemap for AI agents.
 *
 * Serves the raw MDX source of any page as `text/markdown` when the URL
 * path ends with `.md`. When an AI agent is detected (via User-Agent,
 * Accept header, or Signature-Agent), the middleware 302-redirects to
 * the `.md` URL so every cache layer sees a single canonical URL per
 * content variant — no `Vary` header gymnastics needed.
 *
 * Also serves `/sitemap.xml` with all page URLs. An XML comment at
 * the top tells agents they can append `.md` to get raw markdown.
 *
 * Sitemap is in middleware (not a `.get()` route) because spiceflow's
 * `/*` catch-all page handler would match `/sitemap.xml` before a
 * specific `.get('/sitemap.xml')` route registered after it.
 *
 * Installed as a `.use()` middleware that runs AFTER redirects (so
 * `/old-path.md` redirects correctly) but BEFORE loader/layout/page
 * (so matching requests short-circuit the RSC pipeline entirely).
 *
 * Flow:
 *   1. `/sitemap.xml`        → serve XML sitemap
 *   2. Path ends with `.md`  → serve raw markdown directly
 *   3. Agent detected        → 302 redirect to `{path}.md`
 *   4. Normal browser        → fall through to RSC pipeline
 */
import type { Spiceflow } from 'spiceflow'
import { buildHrefToSlugMap } from '../navigation.ts'

/* ── Agent detection ─────────────────────────────────────────────────── */

/** UA substrings that identify known AI agents (case-insensitive). */
const AGENT_UA_PATTERNS = [
  /claudebot/i,
  /claude-user/i,
  /claude-searchbot/i,
  /claude-code/i,
  /claude-cli/i,
  /claude\/\d/i,
  /anthropic/i,
  /chatgpt-user/i,
  /gpt-?bot/i,
  /oai-searchbot/i,
  /opencode/i,
  /cohere-ai/i,
  /perplexitybot/i,
]

/** Check if the request comes from an AI agent or explicitly asks for markdown. */
export function isAgentRequest(request: Request): boolean {
  // Accept header contains text/markdown (case-insensitive per HTTP spec)
  const accept = (request.headers.get('accept') ?? '').toLowerCase()
  if (accept.includes('text/markdown')) return true

  // ChatGPT's RFC 9421 Signature-Agent header
  if (request.headers.has('signature-agent')) return true

  // User-Agent matches known AI agent patterns
  const ua = request.headers.get('user-agent') || ''
  return AGENT_UA_PATTERNS.some((pattern) => pattern.test(ua))
}

/* ── Sitemap ─────────────────────────────────────────────────────────── */

function buildSitemapXml(origin: string, hrefs: string[]): string {
  const urls = hrefs
    .map((href) => `  <url><loc>${origin}${href}</loc></url>`)
    .join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- To get the raw markdown content of any page, append .md to the URL. -->',
    '<!-- Example: ' + origin + '/getting-started.md -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
  ].join('\n')
}

const POWERED_BY_FOOTER = '\n\n---\n\n*Powered by [holocron.so](https://holocron.so)*\n'

/* ── Middleware ───────────────────────────────────────────────────────── */

/**
 * Install raw-markdown middleware + sitemap on a Spiceflow app.
 *
 * - `/sitemap.xml` → XML sitemap with all page URLs
 * - `.md` suffix → serve raw MDX content as `text/markdown`
 * - Agent request on normal path → 302 redirect to `{path}.md`
 */
export function registerRawMarkdown<App extends Spiceflow<any, any, any, any, any, any>>(
  app: App,
  mdxContent: Record<string, string>,
): App {
  // Pre-compute href→slug map once at startup using the shared
  // normalization from navigation.ts (slugToHref).
  const hrefToSlug = buildHrefToSlugMap(mdxContent)

  return app.use(({ request }: { request: Request }) => {
    // Only handle GET/HEAD — POST etc. should never serve markdown
    if (request.method !== 'GET' && request.method !== 'HEAD') return

    const url = new URL(request.url)
    let pathname = url.pathname

    // Strip trailing slash for consistency
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }

    // ── /sitemap.xml → XML sitemap ───────────────────────────────
    if (pathname === '/sitemap.xml') {
      const hrefs = Array.from(hrefToSlug.keys()).sort()
      const xml = buildSitemapXml(url.origin, hrefs)
      return new Response(xml, {
        headers: {
          'content-type': 'application/xml; charset=utf-8',
          'cache-control': 's-maxage=3600, stale-while-revalidate=86400',
        },
      })
    }

    // ── Path ends with .md → serve raw markdown directly ──────────
    // Only `.md` (not `.mdx`) — Vite intercepts `.mdx` in dev mode.
    if (pathname.endsWith('.md')) {
      const href = pathname.slice(0, -3)
      // `/index.md` → href `/index` → normalize to `/` (the canonical href).
      // Also handles nested `/section/index.md` → `/section`.
      const normalizedHref =
        href === '' || href === '/index' ? '/' : href.endsWith('/index') ? href.slice(0, -'/index'.length) : href
      const slug = hrefToSlug.get(normalizedHref)
      if (!slug) return // fall through → 404 handled by page handler

      const mdx = mdxContent[slug]
      if (!mdx) return

      return new Response(mdx + POWERED_BY_FOOTER, {
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'cache-control': 's-maxage=300, stale-while-revalidate=86400',
        },
      })
    }

    // ── Agent detected → 302 redirect to .md URL ─────────────────
    // This keeps caching simple: the `.md` URL is the single canonical
    // resource for raw markdown. CDNs and proxies don't need `Vary`.
    if (isAgentRequest(request)) {
      // Verify the page actually exists before redirecting
      if (!hrefToSlug.has(pathname)) return // fall through → normal 404

      const mdPath = pathname === '/' ? '/index.md' : `${pathname}.md`
      const destination = mdPath + url.search
      return Response.redirect(new URL(destination, url.origin).href, 302)
    }
  }) as App
}
