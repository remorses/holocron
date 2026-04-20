// Custom entry: mounts holocron as a child of a user Spiceflow app.
// Add custom routes, middleware, or layouts above the .use(holocronApp) call.
// Cloudflare Workers fetch handler is provided by spiceflow/cloudflare-entrypoint.

import { Spiceflow } from 'spiceflow'
import { app as holocronApp } from '@holocron.so/vite/app'

export const app = new Spiceflow().use(holocronApp)

export default {
  async fetch(request: Request): Promise<Response> {
    return app.handle(request)
  },
} satisfies ExportedHandler
