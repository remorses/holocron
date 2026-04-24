// Thin AI Gateway proxy — forwards OpenAI-compatible chat requests to
// Cloudflare AI Gateway's Workers AI endpoint with minimal mutation.
//
// Validates holo_xxx API keys from the Authorization header against D1.
// Tracks per-org monthly usage in KV (key: usage:<orgId>:<YYYY-MM>).
//
// The only request change is normalizing short model aliases to full `@cf/`
// IDs. Request/response bodies and streaming are otherwise passed through
// untouched so tools, message parts, and SSE framing stay Cloudflare-owned.

import { Spiceflow } from 'spiceflow'
import { env } from 'cloudflare:workers'
import { getDb, hashApiKey } from './db.ts'

const AI_GATEWAY_ID = 'holocron'

const ALLOWED_MODELS: Record<string, string> = {
  'glm-4.7-flash': '@cf/zai-org/glm-4.7-flash',
  'qwen3-30b': '@cf/qwen/qwen3-30b-a3b-fp8',
  'llama-3.1-8b': '@cf/meta/llama-3.1-8b-instruct-fast',
  'kimi-k2.5': '@cf/moonshotai/kimi-k2.5',
}

const DEFAULT_MODEL = 'glm-4.7-flash'

// Monthly request limit per org (free tier). Will be configurable per plan later.
const MONTHLY_REQUEST_LIMIT = 1000

function resolveModel(requested?: string): string {
  if (!requested) return ALLOWED_MODELS[DEFAULT_MODEL]!
  if (ALLOWED_MODELS[requested]) return ALLOWED_MODELS[requested]!
  const fullId = Object.values(ALLOWED_MODELS).find((id) => id === requested)
  if (fullId) return fullId
  return ALLOWED_MODELS[DEFAULT_MODEL]!
}

function buildCorsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
  }
}

function corsJson(body: Record<string, unknown>, status: number) {
  return Response.json(body, { status, headers: buildCorsHeaders() })
}

function getUsageKey(orgId: string): string {
  const now = new Date()
  const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  return `usage:${orgId}:${month}`
}

async function validateApiKey(authHeader: string | null): Promise<{ orgId: string; keyId: string } | null> {
  if (!authHeader) return null
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (!token.startsWith('holo_')) return null

  const hash = await hashApiKey(token)
  const db = getDb()
  const found = await db.query.apiKey.findFirst({
    where: { hash },
    columns: { id: true, orgId: true },
  })
  if (!found) return null

  return { orgId: found.orgId, keyId: found.id }
}

async function getWorkersAiCompatUrl() {
  const providerUrl = await env.AI.gateway(AI_GATEWAY_ID).getUrl('workers-ai')
  return `${providerUrl.replace(/\/$/, '')}/v1/chat/completions`
}

export const gatewayApp = new Spiceflow()
  .post('/api/ai/v1/chat/completions', async ({ request }) => {
    // Validate the holo_xxx API key
    const authResult = await validateApiKey(request.headers.get('authorization'))
    if (!authResult) {
      return corsJson({ error: 'Missing or invalid API key. Use a holo_xxx key in the Authorization header.' }, 401)
    }

    // Check monthly usage in KV
    const usageKey = getUsageKey(authResult.orgId)
    const currentUsage = parseInt(await env.USAGE_KV.get(usageKey) || '0', 10)
    if (currentUsage >= MONTHLY_REQUEST_LIMIT) {
      return corsJson({ error: 'Monthly request limit exceeded. Upgrade your plan for higher limits.' }, 429)
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return corsJson({ error: 'Invalid JSON body' }, 400)
    }

    const normalizedBody = {
      ...body,
      model: resolveModel(typeof body.model === 'string' ? body.model : undefined),
    }

    const upstreamHeaders = new Headers(request.headers)
    upstreamHeaders.set('authorization', `Bearer ${env.CF_API_TOKEN}`)
    upstreamHeaders.set('cf-aig-authorization', `Bearer ${env.AIG_GATEWAY_TOKEN}`)
    upstreamHeaders.set('content-type', request.headers.get('content-type') || 'application/json')
    upstreamHeaders.delete('content-length')
    upstreamHeaders.delete('host')

    const upstream = await fetch(await getWorkersAiCompatUrl(), {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(normalizedBody),
    })

    // Increment usage counter (non-blocking, 30-day TTL so old months auto-expire)
    env.USAGE_KV.put(usageKey, String(currentUsage + 1), { expirationTtl: 60 * 60 * 24 * 35 })
      .catch(() => {})

    const headers = new Headers(upstream.headers)
    for (const [key, value] of Object.entries(buildCorsHeaders())) {
      headers.set(key, value)
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    })
  })
  .route({
    method: 'OPTIONS',
    path: '/api/ai/v1/chat/completions',
    handler() {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(),
      })
    },
  })
  .get('/api/ai/v1/models', () => {
    const models = Object.entries(ALLOWED_MODELS).map(([name, id]) => ({
      id: name,
      object: 'model' as const,
      created: 0,
      owned_by: 'cloudflare',
      _cf_model_id: id,
    }))
    return Response.json({ object: 'list', data: models }, {
      headers: { 'access-control-allow-origin': '*' },
    })
  })
