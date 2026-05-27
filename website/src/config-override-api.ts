// Config override API — stores and retrieves live docs.json overrides.
//
// POST /api/v0/config-override — store an override, returns { key: "<doId>:<hash>" }
// GET  /api/v0/config-override/:doId/:hash — retrieve an override by doId + hash
//
// Overrides are stored in ConfigOverrideDO (one DO per customization session).
// The doId is a random unique ID (unguessable). The hash is SHA-256 of the
// override JSON (content-addressable). Both are required to read an override.
//
// The override schema is strict: only visual/theming fields are accepted.
// Arbitrary JSON is rejected. Payload is capped at 16 KB.

import { env } from 'cloudflare:workers'
import { json, Spiceflow } from 'spiceflow'
import { z } from 'zod'
import type { ConfigOverrideDO } from './config-override-do.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const MAX_PAYLOAD_BYTES = 16 * 1024 // 16 KB

const hexColor = z.string().regex(/^#([a-fA-F0-9]{3}|[a-fA-F0-9]{6})$/)

const configOverrideSchema = z.object({
  colors: z.object({
    primary: hexColor.optional(),
    light: hexColor.optional(),
    dark: hexColor.optional(),
  }).strict().optional(),
  appearance: z.object({
    default: z.enum(['system', 'light', 'dark']).optional(),
    strict: z.boolean().optional(),
  }).strict().optional(),
  decorativeLines: z.enum(['none', 'lines', 'dashed', 'lines-with-dots']).optional(),
  layout: z.object({
    maxWidth: z.number().min(400).max(4000).optional(),
    sidebarWidth: z.number().min(100).max(500).optional(),
    columnGap: z.number().min(0).max(200).optional(),
    radius: z.number().min(0).max(30).optional(),
  }).strict().optional(),
  fonts: z.object({
    fontSize: z.number().min(10).max(24).optional(),
    heading: z.object({
      fontSize: z.number().min(10).max(36).optional(),
    }).strict().optional(),
  }).strict().optional(),
  assistant: z.object({
    enabled: z.boolean().optional(),
  }).strict().optional(),
  banner: z.object({
    content: z.string().max(2000).optional(),
    dismissible: z.boolean().optional(),
  }).strict().optional(),
}).strict()

const storeBodySchema = z.object({
  override: configOverrideSchema,
  doId: z.string().optional(),
})

export const configOverrideApp = new Spiceflow()
  // CORS preflight for cross-origin POST from docs sites on other domains
  .use(async ({ request, response }, next) => {
    for (const [k, v] of Object.entries(CORS_HEADERS)) {
      response.headers.set(k, v)
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: response.headers })
    }
    return next()
  })
  .get('/api/v0/config-override/:doId/:hash', async ({ params, response }) => {
    try {
      const id = env.CONFIG_OVERRIDE.idFromString(params.doId)
      const stub = env.CONFIG_OVERRIDE.get(id) as DurableObjectStub<ConfigOverrideDO>
      const config = await stub.get(params.hash)
      if (!config) {
        throw json({ error: 'not found' }, { status: 404 })
      }
      return config
    } catch (err) {
      if (err instanceof Response) throw err
      throw json({ error: 'invalid override key' }, { status: 400 })
    }
  })
  .post('/api/v0/config-override', async ({ request, response }) => {
    // Reject oversized payloads before parsing
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      throw json({ error: 'payload too large' }, { status: 413 })
    }

    const rawBody = await request.text()
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      throw json({ error: 'payload too large' }, { status: 413 })
    }

    const body = storeBodySchema.parse(JSON.parse(rawBody))

    let id: ReturnType<typeof env.CONFIG_OVERRIDE.newUniqueId>
    if (body.doId) {
      try {
        id = env.CONFIG_OVERRIDE.idFromString(body.doId)
      } catch {
        // Invalid doId format, create a new one
        id = env.CONFIG_OVERRIDE.newUniqueId()
      }
    } else {
      id = env.CONFIG_OVERRIDE.newUniqueId()
    }

    const stub = env.CONFIG_OVERRIDE.get(id) as DurableObjectStub<ConfigOverrideDO>
    const hash = await stub.store(body.override as Record<string, unknown>)
    return { key: `${id.toString()}:${hash}` }
  })
