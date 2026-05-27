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
import { env } from 'cloudflare:workers'
import { z } from 'zod'

const ogQuerySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  siteName: z.string().optional(),
  pageLabel: z.string().optional(),
})

import { extractPngFromIco, bytesToBase64DataUrl, isIcoResponse } from './ico-utils.ts'

/**
 * Fetch a remote resource and convert to a base64 data URL.
 * Satori/takumi fetches `<img src>` during rendering inside the Worker;
 * if that internal fetch fails the entire body stream errors silently and
 * the response is 200 with an empty body. Pre-fetching avoids this.
 *
 * ICO files are converted to PNG by extracting the embedded PNG from the
 * ICO container. If the ICO only contains BMP data, returns undefined.
 */
async function fetchAsDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return undefined
    const contentType = res.headers.get('content-type') || 'image/png'
    const buf = await res.arrayBuffer()
    if (buf.byteLength === 0) return undefined

    // ICO format: extract the embedded PNG so takumi can render it
    if (isIcoResponse(url, contentType)) {
      const png = extractPngFromIco(buf)
      if (!png) return undefined
      return bytesToBase64DataUrl(png, 'image/png')
    }

    return bytesToBase64DataUrl(new Uint8Array(buf), contentType)
  } catch {
    return undefined
  }
}

/** Fetch a local asset via the ASSETS binding and convert to data URL */
async function fetchAssetAsDataUrl(assets: Fetcher, path: string): Promise<string | undefined> {
  try {
    const res = await assets.fetch(new URL(path, 'https://assets.local'))
    if (!res.ok) return undefined
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buf = await res.arrayBuffer()
    if (buf.byteLength === 0) return undefined
    return bytesToBase64DataUrl(new Uint8Array(buf), contentType)
  } catch {
    return undefined
  }
}

export const app = new Spiceflow().route({
  method: 'GET',
  path: '/api/og',
  query: ogQuerySchema,
  async handler({ query }) {
    const { createOgImageResponse, hashTitle, BG_IMAGE_COUNT } = await import('./og.tsx')

    const bgIndex = hashTitle(query.title) % BG_IMAGE_COUNT
    const [iconDataUrl, bgDataUrl] = await Promise.all([
      query.icon ? fetchAsDataUrl(query.icon) : Promise.resolve(undefined),
      fetchAssetAsDataUrl(env.ASSETS, `/bg/${bgIndex}.jpg`),
    ])

    const response = createOgImageResponse({
      title: query.title,
      description: query.description,
      iconUrl: iconDataUrl,
      siteName: query.siteName,
      pageLabel: query.pageLabel,
      backgroundUrl: bgDataUrl,
    })

    // Only cache for 1h if all requested assets loaded successfully.
    // If the icon or background fetch failed, the image is degraded
    // (missing icon/background). Don't cache degraded images so the
    // next request retries and picks up the asset once it's available.
    const iconOk = !query.icon || iconDataUrl !== undefined
    const bgOk = bgDataUrl !== undefined
    if (iconOk && bgOk) {
      response.headers.set('cache-control', 's-maxage=3600')
    } else {
      response.headers.set('cache-control', 'no-store')
    }

    return response
  },
})

export default {
  fetch(request: Request) {
    return app.handle(request)
  },
} satisfies ExportedHandler<Env>
