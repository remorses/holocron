/**
 * OG image worker.
 *
 * Runs takumi WASM (~5 MiB) in a dedicated Cloudflare Worker so the main
 * holocron website worker stays under the 10 MiB bundle limit. Called via
 * service binding from the website worker (near-zero latency, same thread).
 *
 * Routes:
 *   GET /api/og?title=...&description=...&icon=...&siteName=...&pageLabel=...
 */

import { Spiceflow } from 'spiceflow'
import { z } from 'zod'

const ogQuerySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  siteName: z.string().optional(),
  pageLabel: z.string().optional(),
})

/**
 * Pre-fetch a remote icon and convert to a base64 data URL.
 * Satori/takumi fetches `<img src>` during rendering inside the Worker;
 * if that internal fetch fails the entire body stream errors silently and
 * the response is 200 with an empty body. Pre-fetching lets us fall back
 * to the built-in Holocron icon when the remote URL is broken or slow.
 */
async function fetchIconAsDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return undefined
    const contentType = res.headers.get('content-type') || 'image/png'
    const buf = await res.arrayBuffer()
    if (buf.byteLength === 0) return undefined
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const base64 = btoa(binary)
    return `data:${contentType};base64,${base64}`
  } catch {
    return undefined
  }
}

export const app = new Spiceflow().route({
  method: 'GET',
  path: '/api/og',
  query: ogQuerySchema,
  async handler({ query }) {
    const iconDataUrl = query.icon ? await fetchIconAsDataUrl(query.icon) : undefined

    const { createOgImageResponse } = await import('./og.tsx')
    const response = createOgImageResponse({
      title: query.title,
      description: query.description,
      iconUrl: iconDataUrl,
      siteName: query.siteName,
      pageLabel: query.pageLabel,
    })
    response.headers.set('cache-control', 's-maxage=3600')
    return response
  },
})

export default {
  fetch(request: Request) {
    return app.handle(request)
  },
} satisfies ExportedHandler<Env>
