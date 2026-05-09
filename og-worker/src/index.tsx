/**
 * OG image and generated logo worker.
 *
 * Runs takumi WASM (~5 MiB) in a dedicated Cloudflare Worker so the main
 * holocron website worker stays under the 10 MiB bundle limit. Called via
 * service binding from the website worker (near-zero latency, same thread).
 *
 * Routes:
 *   GET /api/og?title=...&description=...&icon=...&siteName=...&pageLabel=...
 *   GET /api/og/logo/:theme/:text.png
 */

import type { OgImageOptions } from './og.tsx'

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // OG image: GET /api/og?title=...
    if (url.pathname === '/api/og' && request.method === 'GET') {
      const title = url.searchParams.get('title')
      if (!title) {
        return new Response('Missing title parameter', { status: 400 })
      }

      const options: OgImageOptions = {
        title,
        description: url.searchParams.get('description'),
        iconUrl: url.searchParams.get('icon') || undefined,
        siteName: url.searchParams.get('siteName') || undefined,
        pageLabel: url.searchParams.get('pageLabel') || undefined,
      }

      const { createOgImageResponse } = await import('./og.tsx')
      const response = createOgImageResponse(options)
      response.headers.set('cache-control', 's-maxage=3600')
      return response
    }

    // Generated logo: GET /api/og/logo/:theme/:text.png
    const logoMatch = url.pathname.match(/^\/api\/og\/logo\/(light|dark)\/(.+)$/)
    if (logoMatch && request.method === 'GET') {
      const [, rawTheme, rawTextPath = ''] = logoMatch
      const theme = rawTheme === 'dark' ? 'dark' : 'light'
      const textPath = decodeURIComponent(rawTextPath).replace(/\.png$/i, '')
      const text = textPath.trim().replace(/\s+/g, ' ').toLowerCase() || 'documentation'

      const { createGeneratedLogoResponse } = await import('./generated-logo-response.tsx')
      const response = await createGeneratedLogoResponse({ text, theme })
      response.headers.set('cache-control', 's-maxage=31536000, immutable')
      return response
    }

    return new Response('Not found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
