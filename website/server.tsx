// Custom entry: mounts holocron as a child of a user Spiceflow app.
// Gateway routes (AI proxy) are mounted before holocron so they take priority.
// The /docs.json route serves the Holocron JSON Schema for docs.json IDE autocomplete.
// Cloudflare Workers fetch handler is provided by spiceflow/cloudflare-entrypoint.

import { Spiceflow } from 'spiceflow'
import { app as holocronApp } from '@holocron.so/vite/app'
import { gatewayApp } from './src/gateway'
import schema from '@holocron.so/vite/src/schema.json'

const schemaApp = new Spiceflow()
  .get('/docs.json', () => {
    return Response.json(schema, {
      headers: { 'access-control-allow-origin': '*' },
    })
  })

export const app = new Spiceflow().use(schemaApp).use(gatewayApp).use(holocronApp)

export default {
  async fetch(request: Request): Promise<Response> {
    return app.handle(request)
  },
} satisfies ExportedHandler
