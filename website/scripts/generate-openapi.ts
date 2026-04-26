// Generate openapi.json from the Zod schemas on apiApp routes.
//
// Run: pnpm generate-openapi
//
// The spiceflow/openapi plugin on apiApp serves the spec at /openapi.json.
// This script imports the app, hits that endpoint, and writes the result
// to website/openapi.json. A custom ESM loader stubs `cloudflare:workers`
// so the import works outside Cloudflare Workers (handlers are never called,
// only route metadata is read).

import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiApp } from '../src/api.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(__dirname, '..', 'openapi.json')

const response = await apiApp.handle(
  new Request('http://localhost/openapi.json'),
)

if (!response.ok) {
  console.error(`openapi endpoint returned ${response.status}`)
  process.exit(1)
}

const spec = await response.json()
const json = JSON.stringify(spec, null, 2)
writeFileSync(outPath, json + '\n')
console.log(`wrote ${outPath} (${json.length} bytes)`)
