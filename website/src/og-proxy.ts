// OG image proxy.
// Intercepts /api/og and forwards it to the dedicated og-worker via
// Cloudflare service binding. This keeps the takumi WASM (~5 MiB) out of
// the main website worker's bundle. Logos stay on /api/ai-logo in website.

import { Spiceflow } from 'spiceflow'
import { env } from 'cloudflare:workers'

export const ogProxyApp = new Spiceflow()
  .get('/api/og', async ({ request }: { request: Request }) => {
    return env.OG_WORKER.fetch(request)
  })

export type OgProxyApp = typeof ogProxyApp
