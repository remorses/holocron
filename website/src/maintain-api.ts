// Paid OpenAI-compatible model access for Holocron Maintain.
// OpenCode talks to this worker. The Vercel AI Gateway key never leaves the worker.

import { env, waitUntil } from 'cloudflare:workers'
import { captureException } from '@strada.sh/sdk'
import { createParser } from 'eventsource-parser'
import { json, Spiceflow } from 'spiceflow'
import { ulid } from 'ulid'
import { z } from 'zod'
import { getProjectBillingContext } from './db.ts'
import { resolveCreateDeployAuth, requireDeployAccess } from './deploy-auth.ts'
import { subscriptionRequiredPayload } from './lib/billing-rules.ts'
import { DEFAULT_MODEL, MAINTAIN_MODELS, MAX_OUTPUT_TOKENS, buildMaintainChatBody } from './lib/ai-models.ts'
import { computeUsdCost, creditsToUsd, monthlyCreditBudget } from './lib/credits.ts'
import type { UsageCounter } from './usage-counter-do.ts'

const ACCESS_LIFETIME_MS = 30 * 60 * 1000
const UPSTREAM_CHAT_COMPLETIONS = 'https://ai-gateway.vercel.sh/v1/chat/completions'
const TOKEN_PREFIX = 'mnt_'
const TOKEN_SIGNING_PREFIX = 'holocron.maintain.run-token.v1.'
const MAX_BODY_BYTES = 1_500_000

type MaintainRunToken = {
  runId: string
  projectId: string
  orgId: string
  exp: number
}

export type ChatUsage = {
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  costUsd?: number
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

async function hmacSign(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return bytesToBase64Url(await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${TOKEN_SIGNING_PREFIX}${body}`),
  ))
}

function timingSafeEqualString(left: string, right: string) {
  const encoder = new TextEncoder()
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  const n = Math.max(a.byteLength, b.byteLength)
  let diff = a.byteLength ^ b.byteLength
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
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
  if (!timingSafeEqualString(signature, expected)) return new Error('invalid maintain token')
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
      error: {
        message: 'This project used all monthly AI credits for Holocron Maintain.',
        type: 'insufficient_quota',
      },
      hint: 'Credits reset at the start of the next month. Check usage on the billing page.',
      upgradeUrl: `${origin}/dashboard/projects/${projectId}/billing`,
    }, { status: 402 })
  }
  return billing
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)/i.exec(header)
  return match?.[1] ?? ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function chatUsageFromUnknown(value: unknown): ChatUsage | null {
  if (!isRecord(value) || !isRecord(value.usage)) return null
  const promptTokens = value.usage.prompt_tokens
  const completionTokens = value.usage.completion_tokens
  if (typeof promptTokens !== 'number' || typeof completionTokens !== 'number') return null
  const details = value.usage.prompt_tokens_details
  const cached = isRecord(details) ? details.cached_tokens : 0
  const cost = value.usage.cost
  return {
    inputTokens: promptTokens,
    outputTokens: completionTokens,
    cachedInputTokens: typeof cached === 'number' ? cached : 0,
    costUsd: typeof cost === 'number' ? cost : undefined,
  }
}

export async function extractChatUsage(body: ReadableStream<Uint8Array> | null, stream: boolean) {
  if (!body) return null
  try {
    const text = await new Response(body).text()
    if (!stream) return chatUsageFromUnknown(JSON.parse(text))
    let last: ChatUsage | null = null
    const parser = createParser({
      onEvent(event) {
        if (!event.data || event.data === '[DONE]') return
        try {
          const parsed = chatUsageFromUnknown(JSON.parse(event.data))
          if (parsed) last = parsed
        } catch {
          // incomplete SSE JSON
        }
      },
    })
    parser.feed(text)
    parser.reset({ consume: true })
    return last
  } catch {
    return null
  }
}

export function estimateMaintainUsage(upstreamBody: object) {
  const inputTokens = Math.max(1, Math.floor(JSON.stringify(upstreamBody).length / 4))
  const maxTokens = Reflect.get(upstreamBody, 'max_tokens')
  const outputTokens = typeof maxTokens === 'number' && Number.isFinite(maxTokens)
    ? Math.min(Math.max(1, Math.floor(maxTokens)), MAX_OUTPUT_TOKENS)
    : MAX_OUTPUT_TOKENS
  return { inputTokens, outputTokens, cachedInputTokens: 0 }
}

export function billedMaintainUsage({
  usage,
  model,
  upstreamBody,
}: {
  usage: ChatUsage | null
  model: string
  upstreamBody: object
}) {
  if (!usage) {
    const estimated = estimateMaintainUsage(upstreamBody)
    return {
      ...estimated,
      costUsd: computeUsdCost(model, estimated),
      estimated: true as const,
    }
  }
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    costUsd: Math.max(computeUsdCost(model, usage), usage.costUsd ?? 0),
    estimated: false as const,
  }
}

const createRunBody = z.object({ projectId: z.string().optional() })
const completeRunBody = z.object({
  projectId: z.string(),
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
        models: Object.keys(MAINTAIN_MODELS),
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
        data: Object.keys(MAINTAIN_MODELS).map((id) => ({ id, object: 'model' as const, owned_by: 'holocron' })),
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

      const { success } = await env.CHAT_RATE_LIMITER.limit({ key: `maintain:${payload.runId}` })
      if (!success) {
        throw json({ error: { message: 'Rate limit exceeded.', type: 'rate_limit_exceeded' } }, { status: 429 })
      }

      const raw = await request.text()
      if (raw.length > MAX_BODY_BYTES) {
        throw json({ error: { message: 'Request body too large.', type: 'invalid_request_error' } }, { status: 413 })
      }
      let incoming: unknown
      try {
        incoming = JSON.parse(raw)
      } catch {
        throw json({ error: 'invalid JSON body' }, { status: 400 })
      }
      if (!isRecord(incoming)) {
        throw json({ error: 'invalid JSON body' }, { status: 400 })
      }
      const built = buildMaintainChatBody(incoming)
      if (!built) {
        throw json({ error: { message: 'Unknown model.', type: 'invalid_request_error' } }, { status: 400 })
      }
      const { body: upstreamBody, friendlyModel, stream } = built
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
        extractChatUsage(usageBody, stream)
          .then((usage) => {
            const billed = billedMaintainUsage({ usage, model: friendlyModel, upstreamBody })
            if (billed.estimated) {
              captureException(new Error(`missing AI usage for maintain run ${payload.runId}; billed estimate`), {
                tags: { route: 'maintain', projectId: payload.projectId, model: friendlyModel },
              })
            }
            return getUsageStub(payload.orgId).recordUsage({
              projectId: payload.projectId,
              model: friendlyModel,
              pageSlug: `maintain:${payload.runId}`,
              inputTokens: billed.inputTokens,
              outputTokens: billed.outputTokens,
              costUsd: billed.costUsd,
            })
          })
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
