// Server-side Strada SDK initialization for Cloudflare Workers.
// Import this module as a side effect in server.tsx so initStrada() runs
// at module evaluation time, before Spiceflow creates any spans.
//
// The `workerd` export condition resolves `@strada.sh/sdk` to the Cloudflare
// Workers entry, which uses BasicTracerProvider + AsyncLocalStorage context
// manager + auto-flush via waitUntil.

import { env } from 'cloudflare:workers'
import { initStrada } from '@strada.sh/sdk'

initStrada({
  projectId: env.STRADA_PROJECT_ID,
  service: 'holocron-website',
  token: env.STRADA_TOKEN,
  environment: 'production',
})
