// Paid OpenAI-compatible model access for Holocron Maintain.
// OpenCode talks to this worker. The Vercel AI Gateway key never leaves the worker.

import { createGateway } from '@ai-sdk/gateway'
import { env, waitUntil } from 'cloudflare:workers'
import { captureException } from '@strada.sh/sdk'
import { json, Spiceflow } from 'spiceflow'
import { ulid } from 'ulid'
import { z } from 'zod'
import { getProjectBillingContext } from './db.ts'
import { resolveCreateDeployAuth, requireDeployAccess } from './deploy-auth.ts'
import { subscriptionRequiredPayload } from './lib/billing-rules.ts'
import { ALLOWED_MODELS, DEFAULT_MODEL, buildUpstreamChatBody } from './lib/ai-models.ts'
import { computeUsdCost, creditsToUsd, monthlyCreditBudget } from './lib/credits.ts'
import type { UsageCounter } from './usage-counter-do.ts'

const ACCESS_LIFETIME_MS = 30 * 60 * 1000
const UPSTREAM_CHAT_COMPLETIONS = 'https://ai-gateway.vercel.sh/v1/chat/completions'
const TOKEN_PREFIX = 'mnt_'

type MaintainRunToken = {
  runId: string
  projectId: string
  orgId: string
  exp: number
}

function getMonthStartMs() {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
}

function getUsageStub(orgId: string) {
  const id = env.USAGE_COUNTER.idFromName(orgId)
  return env.USAGE_COUNTER.get(id) as DurableObjectStub<UsageCounter>
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let bin = ''
  for (const byte of view) bin += String.fromCharCode(byte)
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function base64UrlToBytes(value: string) {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacSign(secret: string, data: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return bytesToBase64Url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)))
}

export async function signMaintainRunToken(payload: MaintainRunToken, secret = env.BETTER_AUTH_SECRET) {
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await hmacSign(secret, body)
  return `${TOKEN_PREFIX}${body}.${signature}`
}

export async function verifyMaintainRunToken(token: string, secret = env.BETTER_AUTH_SECRET) {
  if (!token.startsWith(TOKEN_PREFIX)) return new Error('invalid maintain token')
  const encoded = token.slice(TOKEN_PREFIX.length)
  const dot = encoded.lastIndexOf('.')
  if (dot <= 0) return new Error('invalid maintain token')
  const body = encoded.slice(0, dot)
  const signature = encoded.slice(dot + 1)
  const expected = await hmacSign(secret, body)
  if (signature !== expected) return new Error('invalid maintain token')
  let payload: MaintainRunToken
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body)))
  } catch {
    return new Error('invalid maintain token')
  }
  if (!payload.runId || !payload.projectId || !payload.orgId || !payload.exp) return new Error('invalid maintain token')
  if (payload.exp <= Date.now()) return new Error('maintain token expired')
  return payload
}

async function assertPaidAndUnderLimit(projectId: string, orgId: string, origin: string) {
  const billing = await getProjectBillingContext(projectId)
  const isPaid = !!billing.subscription || billing.orgPlan === 'partner'
  if (!isPaid) {
    throw json(subscriptionRequiredPayload({
      reason: 'This project is on the free plan. Holocron Maintain needs Holocron Pro.',
      projectId,
      origin,
    }), { status: 402 })
  }
  const limit = await getUsageStub(orgId).checkLimit({
    projectId,
    sinceMs: getMonthStartMs(),
    usdLimit: creditsToUsd(monthlyCreditBudget({
      hasActiveSubscription: !!billing.subscription,
      isPartner: billing.orgPlan === 'partner',
    })),
  })
  if (!limit.allowed) {
    throw json({
      error: 'This project used all monthly AI credits for Holocron Maintain.',
      hint: 'Credits reset at the start of the next month. Check usage on the billing page.',
      upgradeUrl: `${origin}/dashboard/projects/${projectId}/billing`,
    }, { status: 429 })
  }
  return billing
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)/i.exec(header)
  return match?.[1] ?? ''
}

// OpenAI `id` is the Vercel generation id. Usage is looked up via GET /v1/generation.
export async function extractGenerationId(body: ReadableStream<Uint8Array> | null, stream: boolean) {
  if (!body) return null
  const text = await new Response(body).text()
  if (!stream) {
    try {
      const parsed = JSON.parse(text) as { id?: unknown }
      return typeof parsed.id === 'string' ? parsed.id : null
    } catch {
      return null
    }
  }
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const data = line.slice(6).trim()
    if (!data || data === '[DONE]') continue
    try {
      const chunk = JSON.parse(data) as { id?: unknown }
      if (typeof chunk.id === 'string') return chunk.id
    } catch {
      // incomplete SSE line
    }
  }
  return null
}

async function lookupGatewayGeneration(id: string) {
  const gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY })
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await gateway.getGenerationInfo({ id })
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  return null
}

function recordCompletionUsage({
  orgId,
  projectId,
  runId,
  generation,
  model,
}: {
  orgId: string
  projectId: string
  runId: string
  generation: { promptTokens: number; completionTokens: number; cachedTokens: number } | null
  model: string
}) {
  const inputTokens = generation?.promptTokens ?? 0
  const outputTokens = generation?.completionTokens ?? 0
  const cachedInputTokens = generation?.cachedTokens ?? 0
  const costUsd = computeUsdCost(model, { inputTokens, outputTokens, cachedInputTokens })
  if (inputTokens === 0 && outputTokens === 0) {
    captureException(new Error(`zero AI usage recorded for maintain run ${runId}`), {
      tags: { route: 'maintain', projectId, model },
    })
  }
  return getUsageStub(orgId).recordUsage({
    projectId,
    model,
    pageSlug: `maintain:${runId}`,
    inputTokens,
    outputTokens,
    costUsd,
  })
}

const createRunBody = z.object({ projectId: z.string().optional() })
const completeRunBody = z.object({
  projectId: z.string(),
  reportedCostUsd: z.number().nonnegative().optional(),
})

export const maintainApi = new Spiceflow()
  .route({
    method: 'POST',
    path: '/api/v0/maintain/runs',
    request: createRunBody,
    detail: { hide: true },
    async handler({ request }) {
      const body = createRunBody.parse(await request.json())
      const auth = await resolveCreateDeployAuth(request, body.projectId)
      await assertPaidAndUnderLimit(auth.projectId, auth.orgId, new URL(request.url).origin)
      if (!env.AI_GATEWAY_API_KEY) throw new Error('AI_GATEWAY_API_KEY is not configured.')
      const runId = `aut_${ulid()}`
      const expiresAt = Date.now() + ACCESS_LIFETIME_MS
      const apiKey = await signMaintainRunToken({
        runId,
        projectId: auth.projectId,
        orgId: auth.orgId,
        exp: expiresAt,
      })
      const origin = new URL(request.url).origin
      return {
        runId,
        projectId: auth.projectId,
        baseUrl: `${origin}/api/v0/maintain/v1`,
        apiKey,
        providerId: 'holocron',
        modelId: DEFAULT_MODEL,
        models: Object.keys(ALLOWED_MODELS),
        expiresAt,
      }
    },
  })
  .route({
    method: 'GET',
    path: '/api/v0/maintain/v1/models',
    detail: { hide: true },
    async handler({ request }) {
      const payload = await verifyMaintainRunToken(bearerToken(request))
      if (payload instanceof Error) {
        throw json({
          error: payload.message,
          hint: 'Run `npx -y "@holocron.so/cli" maintain` again. The model token expires after 30 minutes.',
        }, { status: 401 })
      }
      await assertPaidAndUnderLimit(payload.projectId, payload.orgId, new URL(request.url).origin)
      return {
        object: 'list',
        data: Object.keys(ALLOWED_MODELS).map((id) => ({ id, object: 'model' as const, owned_by: 'holocron' })),
      }
    },
  })
  .route({
    method: 'POST',
    path: '/api/v0/maintain/v1/chat/completions',
    detail: { hide: true },
    async handler({ request }) {
      const payload = await verifyMaintainRunToken(bearerToken(request))
      if (payload instanceof Error) {
        throw json({
          error: payload.message,
          hint: 'Run `npx -y "@holocron.so/cli" maintain` again. The model token expires after 30 minutes.',
        }, { status: 401 })
      }
      await assertPaidAndUnderLimit(payload.projectId, payload.orgId, new URL(request.url).origin)
      if (!env.AI_GATEWAY_API_KEY) throw new Error('AI_GATEWAY_API_KEY is not configured.')

      const incoming = await request.json()
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        throw json({ error: 'invalid JSON body' }, { status: 400 })
      }
      const { body: upstreamBody, friendlyModel, stream } = buildUpstreamChatBody(incoming)
      const upstream = await fetch(UPSTREAM_CHAT_COMPLETIONS, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.AI_GATEWAY_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(upstreamBody),
      })
      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text()
        captureException(new Error(`Maintain upstream failed (${upstream.status}): ${detail}`), {
          tags: { route: 'maintain', projectId: payload.projectId },
        })
        throw json({ error: 'Model request failed.' }, { status: 502 })
      }

      const [clientBody, usageBody] = upstream.body.tee()
      waitUntil(
        extractGenerationId(usageBody, stream)
          .then((id) => id ? lookupGatewayGeneration(id) : null)
          .then((generation) => recordCompletionUsage({
            orgId: payload.orgId,
            projectId: payload.projectId,
            runId: payload.runId,
            generation,
            model: friendlyModel,
          }))
          .catch((error) => {
            captureException(error instanceof Error ? error : new Error(String(error)), {
              tags: { route: 'maintain', reason: 'record-usage-failed' },
            })
          }),
      )
      throw new Response(clientBody, {
        status: upstream.status,
        headers: {
          'content-type': upstream.headers.get('content-type') ?? (stream ? 'text/event-stream' : 'application/json'),
        },
      })
    },
  })
  .route({
    method: 'POST',
    path: '/api/v0/maintain/runs/:runId/complete',
    params: z.object({ runId: z.string() }),
    request: completeRunBody,
    detail: { hide: true },
    async handler({ request }) {
      const body = completeRunBody.parse(await request.json())
      await requireDeployAccess(request, body.projectId)
      return { completed: true }
    },
  })
