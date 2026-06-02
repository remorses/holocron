// Hosted Holocron AI chat route (/api/chat). Validates holo_xxx API
// keys, reads docs from either the caller's docs.zip or inline localhost pages,
// creates the docs bash tool, and streams AI SDK UI chunks through Spiceflow's
// typed SSE generator support.
//
// Usage tracking: authenticated requests are counted in a per-org Durable Object
// (UsageCounter). checkLimit() runs before streaming; recordUsage() inserts the
// full row after streaming via waitUntil so it survives after the response closes.
//
// Unauthenticated requests are rate-limited by IP via the CHAT_RATE_LIMITER
// binding (5 req / 60s). The rate limiter also applies to invalid API keys
// so spamming bogus keys can't bypass the IP limit. When the limit is hit we
// yield a friendly notice chunk (rendered as a card) instead of a raw 429.

import { streamText, type LanguageModelUsage, type ModelMessage, type UIMessageChunk } from 'ai'
import { captureException } from '@strada.sh/sdk'
import { env, waitUntil } from 'cloudflare:workers'
import { unzipSync, strFromU8 } from 'fflate'
import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import { createWorkersAI } from 'workers-ai-provider'
import type { WorkersAI } from 'workers-ai-provider'
import { validateApiKey, getProjectSubscription } from './db.ts'
import { shouldShowTempAiNotice } from './lib/billing-rules.ts'
import { ALLOWED_MODELS, computeUsdCost, creditsToUsd, monthlyCreditBudget, MODEL_USD_PER_1M_TOKENS, usdToCredits } from './lib/credits.ts'
import { createChatBashTool } from './chat-bash-tool.ts'
import { NOTICE_USAGE_LIMIT_REACHED, type UsageCounter } from './usage-counter-do.ts'

const DEFAULT_MODEL = 'glm-4.7-flash'
const TEMPORARY_MODEL = 'glm-4.7-flash'
const DOCS_ZIP_CACHE_MS = 5 * 60 * 1000

const THINKING_DISABLED = {
  reasoning_effort: null,
  chat_template_kwargs: { enable_thinking: false },
} satisfies NonNullable<Parameters<WorkersAI['chat']>[1]>

export type HolocronChatNoticeChunk = {
  type: 'notice'
  code: string
  title: string
  message: string
  command?: string
}

// Usage for THIS turn, yielded just before the stream closes. Cost is computed
// exactly from token counts × the per-model rate table (lib/credits.ts).
export type HolocronChatUsageChunk = {
  type: 'usage'
  inputTokens: number
  outputTokens: number
  costUsd: number
  credits: number
}

export type HolocronChatChunk = UIMessageChunk | HolocronChatNoticeChunk
  | HolocronChatUsageChunk
  | { type: 'model-messages'; messages: ModelMessage[] }

// Shown in the chat UI (as a yellow notice card) when an unauthenticated
// caller hits the per-IP rate limit. Nudges them to add a HOLOCRON_KEY for
// higher limits instead of surfacing a raw 429 error.
const NOTICE_RATE_LIMIT_REACHED = {
  type: 'notice',
  code: 'HOLOCRON_RATE_LIMIT_REACHED',
  title: 'Rate limit reached',
  message: 'Too many AI chat requests. Wait a minute and try again, or add a HOLOCRON_KEY for higher limits.',
  command: 'npx -y @holocron.so/cli keys create --name production --project <projectId>',
} as const satisfies HolocronChatNoticeChunk

const chatRequestSchema = z.object({
  messages: z.array(z.any()),
  docsZipUrl: z.string().url().optional(),
  docsPages: z.record(z.string(), z.string()).optional(),
  skillUrls: z.array(z.string().url()).optional(),
  pageSlug: z.string().optional(),
})

const docsZipCache = new Map<string, { expiresAt: number; promise: Promise<Record<string, string>> }>()

function getMonthStartMs(): number {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime()
}

function getUsageStub(orgId: string): DurableObjectStub<UsageCounter> {
  const id = env.USAGE_COUNTER.idFromName(orgId)
  return env.USAGE_COUNTER.get(id) as DurableObjectStub<UsageCounter>
}

// Resolve a turn's exact usage and USD cost. totalUsage sums every tool-call
// step (result.usage is only the last step) and exposes cached prompt tokens,
// which computeUsdCost bills at the model's cheaper cached rate. Tolerates a
// rejected/absent usage promise (e.g. client abort before final usage) by
// returning zeros.
async function resolveUsageCost(
  totalUsage: PromiseLike<LanguageModelUsage>,
  modelName: string,
): Promise<{ inputTokens: number; outputTokens: number; costUsd: number }> {
  const usage = await Promise.resolve(totalUsage).catch(() => null)
  const inputTokens = usage?.inputTokens ?? 0
  const outputTokens = usage?.outputTokens ?? 0
  const cachedInputTokens = usage?.inputTokenDetails?.cacheReadTokens ?? 0
  const costUsd = computeUsdCost(modelName, { inputTokens, outputTokens, cachedInputTokens })
  return { inputTokens, outputTokens, costUsd }
}

async function fetchDocsZip(url: string): Promise<Record<string, string>> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('docsZipUrl must use http or https')
  }

  const response = await fetch(parsed, {
    headers: { accept: 'application/zip' },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch docs.zip: ${response.status} ${response.statusText}`)
  }

  const zip = unzipSync(new Uint8Array(await response.arrayBuffer()))
  return Object.fromEntries(
    Object.entries(zip).map(([name, bytes]) => {
      const slug = name.replace(/\.mdx?$/, '')
      return [`/docs/${slug}.mdx`, strFromU8(bytes)]
    }),
  )
}

function getDocsZipFiles(url: string): Promise<Record<string, string>> {
  const now = Date.now()
  const cached = docsZipCache.get(url)
  if (cached && cached.expiresAt > now) return cached.promise

  const promise = fetchDocsZip(url)
  docsZipCache.set(url, { expiresAt: now + DOCS_ZIP_CACHE_MS, promise })
  promise.catch(() => docsZipCache.delete(url))
  return promise
}

export const gatewayApp = new Spiceflow()
  .route({
    method: 'POST',
    path: '/api/chat',
    request: chatRequestSchema,
    async *handler({ request }): AsyncGenerator<HolocronChatChunk> {
      const authHeader = request.headers.get('authorization')
      const authResult = await validateApiKey(authHeader)

      // ── Unauthenticated or invalid key: IP-based rate limit ─────────
      // Applied before the 401 so spamming bogus keys can't bypass it.
      if (!authResult) {
        const ip = request.headers.get('cf-connecting-ip') || 'unknown'
        const { success } = await env.CHAT_RATE_LIMITER.limit({ key: ip })
        if (!success) {
          // Yield a friendly notice (rendered as a card in the chat UI) instead
          // of throwing a raw 429 that would surface as a generic error.
          yield NOTICE_RATE_LIMIT_REACHED
          return
        }
        if (authHeader) {
          throw new Response('Missing or invalid API key. Use a holo_xxx key in the Authorization header.', { status: 401 })
        }
      }

      const body = chatRequestSchema.parse(await request.json())
      const messages: ModelMessage[] = body.messages
      const pageSlug = body.pageSlug ?? ''

      // ── Authenticated: subscription (D1) → per-project credit limit (DO) ─
      // The limit is per project and depends on the subscription (Pro gets a
      // bigger budget), so resolve the subscription first, then check spend.
      const subscriptionResult = authResult
        ? await getProjectSubscription(authResult.projectId)
        : null

      const limitCheck = authResult
        ? await getUsageStub(authResult.orgId).checkLimit({
            projectId: authResult.projectId,
            sinceMs: getMonthStartMs(),
            usdLimit: creditsToUsd(monthlyCreditBudget(!!subscriptionResult)),
          })
        : null

      if (limitCheck && !limitCheck.allowed) {
        yield NOTICE_USAGE_LIMIT_REACHED
        return
      }
      const filesPromise = (() => {
        if (body.docsPages) return Promise.resolve(body.docsPages)
        if (body.docsZipUrl) return getDocsZipFiles(body.docsZipUrl)
        throw new Response('Missing docsZipUrl or docsPages.', { status: 400 })
      })()
      const files = await filesPromise
      const bash = await createChatBashTool({
        files,
        skillUrls: body.skillUrls ?? [],
      })

      const workersai = createWorkersAI({ binding: env.AI })
      const usesTemporaryModel = !authResult
      const modelName = usesTemporaryModel ? TEMPORARY_MODEL : DEFAULT_MODEL
      const modelId = ALLOWED_MODELS[modelName] ?? ALLOWED_MODELS[DEFAULT_MODEL]!

      // Subscribed projects never see the upgrade nag. Unauthenticated callers
      // (no API key → no project to bill) still see it. Resolved above
      // concurrently with the usage-limit check.
      const showTempNotice = shouldShowTempAiNotice({
        authenticated: !!authResult,
        hasActiveSubscription: !!subscriptionResult,
      })

      if (showTempNotice) {
        yield {
          type: 'notice',
          code: 'HOLOCRON_TEMPORARY_AI_MODEL',
          title: 'Temporary AI model',
          message: 'Add HOLOCRON_KEY before deploying for reliable AI chat.',
          command: 'npx -y @holocron.so/cli keys create --name production --project <projectId>',
        } as const
      }

      const result = streamText({
        model: workersai(modelId, THINKING_DISABLED),
        tools: { bash },
        messages,
        providerOptions: {
          'workers-ai': THINKING_DISABLED,
        },
        stopWhen: (event) => event.steps.length >= 100,
        abortSignal: request.signal,
      })

      // A selectable model without a rate is a config bug (it would bill at the
      // glm fallback). A test asserts every ALLOWED_MODELS key has a rate; this
      // is the runtime backstop.
      if (!MODEL_USD_PER_1M_TOKENS[modelName]) {
        captureException(new Error(`no USD rate for model ${modelName} — billing at glm fallback rate`), {
          tags: { route: 'gateway', model: modelName },
        })
      }

      try {
        for await (const chunk of result.toUIMessageStream()) {
          yield chunk
        }
        // Emit this turn's exact usage (authenticated only). Cost is tokens ×
        // the per-model rate table — synchronous, no gateway.
        if (authResult) {
          const { inputTokens, outputTokens, costUsd } = await resolveUsageCost(result.totalUsage, modelName)
          yield {
            type: 'usage',
            inputTokens,
            outputTokens,
            costUsd,
            credits: usdToCredits(costUsd),
          } satisfies HolocronChatUsageChunk
        }
        yield { type: 'model-messages', messages: (await result.response).messages }
      } finally {
        // Record usage in `finally` so it runs even on stream error/abort —
        // the model already cost money, so skipping it would let a project keep
        // spending while checkLimit sees 0. waitUntil survives the response.
        if (authResult) {
          const projectId = authResult.projectId
          const orgId = authResult.orgId
          waitUntil(
            (async () => {
              const { inputTokens, outputTokens, costUsd } = await resolveUsageCost(result.totalUsage, modelName)
              // Zero tokens after a real stream means the provider dropped usage
              // and we'd bill nothing — surface it instead of silently under-billing.
              if (inputTokens === 0 && outputTokens === 0) {
                captureException(new Error(`zero AI usage recorded for project ${projectId} model ${modelName} — provider omitted usage?`), {
                  tags: { route: 'gateway', projectId, model: modelName },
                })
              }
              await getUsageStub(orgId).recordUsage({
                projectId,
                model: modelName,
                pageSlug,
                inputTokens,
                outputTokens,
                costUsd,
              })
            })().catch((error) => {
              captureException(error instanceof Error ? error : new Error(String(error)), {
                tags: { route: 'gateway', reason: 'record-usage-failed' },
              })
            }),
          )
        }
      }
    },
  })
