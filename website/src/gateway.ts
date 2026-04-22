// Thin AI Gateway proxy — forwards OpenAI-compatible chat requests to
// Cloudflare AI Gateway's Workers AI endpoint with minimal mutation.
//
// The only request change is normalizing short model aliases to full `@cf/`
// IDs. Request/response bodies and streaming are otherwise passed through
// untouched so tools, message parts, and SSE framing stay Cloudflare-owned.

import { Spiceflow } from 'spiceflow'
import { env } from 'cloudflare:workers'

const AI_GATEWAY_ID = 'holocron'

const ALLOWED_MODELS: Record<string, string> = {
  'glm-4.7-flash': '@cf/zai-org/glm-4.7-flash',
  'qwen3-30b': '@cf/qwen/qwen3-30b-a3b-fp8',
  'llama-3.1-8b': '@cf/meta/llama-3.1-8b-instruct-fast',
  'kimi-k2.5': '@cf/moonshotai/kimi-k2.5',
}

const DEFAULT_MODEL = 'glm-4.7-flash'

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

async function getWorkersAiCompatUrl() {
  const providerUrl = await env.AI.gateway(AI_GATEWAY_ID).getUrl('workers-ai')
  return `${providerUrl.replace(/\/$/, '')}/v1/chat/completions`
}

export const gatewayApp = new Spiceflow()
  .post('/api/ai/v1/chat/completions', async ({ request }) => {
    // TODO: Extract and validate holo_xxx API key from Authorization header.
    // Keep that separate from the upstream CF token — this proxy overwrites
    // Authorization when forwarding to AI Gateway.

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'Invalid JSON body' }, {
        status: 400,
        headers: buildCorsHeaders(),
      })
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

// TODO: Stripe checkout, webhook, usage, status, cancel, plans endpoints.
// TODO: KV storage for API keys, usage tracking, subscriptions.
