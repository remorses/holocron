/**
 * Raw markdown middleware for AI agents.
 *
 * Serves the raw MDX source of any page as `text/markdown` when the URL
 * path ends with `.md`. When an AI agent is detected (via User-Agent,
 * Accept header, or Signature-Agent), the middleware 302-redirects to
 * the `.md` URL so every cache layer sees a single canonical URL per
 * content variant — no `Vary` header gymnastics needed.
 *
 * Installed as a `.use()` middleware that runs AFTER redirects (so
 * `/old-path.md` redirects correctly) but BEFORE loader/layout/page
 * (so matching requests short-circuit the RSC pipeline entirely).
 *
 * Flow:
 *   1. Path ends with `.md`  → serve raw markdown directly
 *   2. Agent detected        → 302 redirect to `{path}.md`
 *   3. Normal browser        → fall through to RSC pipeline
 */
import type { Spiceflow } from 'spiceflow'

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
  /opencode/i,
  /cohere-ai/i,
  /perplexitybot/i,
]

/** Check if the request comes from an AI agent or explicitly asks for markdown. */
export function isAgentRequest(request: Request): boolean {
  // Accept header contains text/markdown
  const accept = request.headers.get('accept') || ''
  if (accept.includes('text/markdown')) return true

  // ChatGPT's RFC 9421 Signature-Agent header
  if (request.headers.has('signature-agent')) return true

  // User-Agent matches known AI agent patterns
  const ua = request.headers.get('user-agent') || ''
  return AGENT_UA_PATTERNS.some((pattern) => pattern.test(ua))
}

/* ── Middleware ───────────────────────────────────────────────────────── */

/**
 * Install raw-markdown middleware on a Spiceflow app.
 *
 * - `.md` suffix → serve raw MDX content as `text/markdown`
 * - Agent request on normal path → 302 redirect to `{path}.md`
 *   (keeps caching clean: one URL per content variant)
 */
export function registerRawMarkdown<App extends Spiceflow<any, any, any, any, any, any>>(
  app: App,
  mdxContent: Record<string, string>,
): App {
  return app.use(({ request }: { request: Request }) => {
    // Only handle GET/HEAD — POST etc. should never serve markdown
    if (request.method !== 'GET' && request.method !== 'HEAD') return

    const url = new URL(request.url)
    let pathname = url.pathname

    // Strip trailing slash for consistency
    if (pathname !== '/' && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }

    // ── Path ends with .md → serve raw markdown directly ──────────
    // Only `.md` (not `.mdx`) — Vite intercepts `.mdx` in dev mode.
    if (pathname.endsWith('.md')) {
      const stripped = pathname.slice(0, -3)
      const slug = stripped === '/' || stripped === '' ? 'index' : stripped.slice(1)

      const mdx = mdxContent[slug]
      if (!mdx) return // fall through → 404 handled by page handler

      return new Response(mdx, {
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
      const slug = pathname === '/' || pathname === '' ? 'index' : pathname.slice(1)
      if (!mdxContent[slug]) return // fall through → normal 404

      const mdPath = pathname === '/' ? '/index.md' : `${pathname}.md`
      const destination = mdPath + url.search + url.hash
      return Response.redirect(new URL(destination, url.origin).href, 302)
    }
  }) as App
}
