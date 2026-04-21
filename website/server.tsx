// Custom entry: mounts holocron as a child of a user Spiceflow app.
// Gateway routes (AI proxy) are mounted before holocron so they take priority.
// Cloudflare Workers fetch handler is provided by spiceflow/cloudflare-entrypoint.

import { Spiceflow } from 'spiceflow'
import { app as holocronApp } from '@holocron.so/vite/app'
import { gatewayApp } from './src/gateway'

export const app = new Spiceflow().use(gatewayApp).use(holocronApp)

export default {
  async fetch(request: Request): Promise<Response> {
    return app.handle(request)
  },
} satisfies ExportedHandler
