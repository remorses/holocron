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

export const app = new Spiceflow().route({
  method: 'GET',
  path: '/api/og',
  query: ogQuerySchema,
  async handler({ query }) {
    const { createOgImageResponse } = await import('./og.tsx')
    const response = createOgImageResponse({
      title: query.title,
      description: query.description,
      iconUrl: query.icon,
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
