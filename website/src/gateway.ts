// Hosted Holocron AI chat route (/api/chat). Validates holo_xxx API keys,
// forwards prompts to the Flue docs-chat agent via @flue/sdk, maps Flue
// events to HolocronChatChunk, and streams them through Spiceflow's typed
// SSE generator support.
//
// Usage tracking: authenticated requests are counted in a per-org Durable Object
// (UsageCounter). checkLimit() runs before streaming; recordUsage() inserts the
// full row after streaming via waitUntil so it survives after the response closes.
//
// Unauthenticated requests are rate-limited by IP via the CHAT_RATE_LIMITER
// binding (5 req / 60s). The rate limiter also applies to invalid API keys
// so spamming bogus keys can't bypass the IP limit. When the limit is hit we
// yield a friendly notice chunk (rendered as a card) instead of a raw 429.

import { createFlueClient, type FlueEvent } from '@flue/sdk'
import { captureException } from '@strada.sh/sdk'
import { env, waitUntil } from 'cloudflare:workers'
import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import { validateApiKey, getProjectSubscription } from './db.ts'
import { shouldShowTempAiNotice } from './lib/billing-rules.ts'
import { creditsToUsd, monthlyCreditBudget, usdToCredits } from './lib/credits.ts'
import { NOTICE_USAGE_LIMIT_REACHED, type UsageCounter } from './usage-counter-do.ts'

const FLUE_AGENT_NAME = 'docs-chat'

export type HolocronChatNoticeChunk = {
  type: 'notice'
  code: string
  title: string
  message: string
  command?: string
}

// Usage for THIS turn, yielded just before the stream closes.
export type HolocronChatUsageChunk = {
  type: 'usage'
  inputTokens: number
  outputTokens: number
  costUsd: number
  credits: number
}

export type HolocronChatTextChunk = {
  type: 'text'
  text: string
}

export type HolocronChatToolCallChunk = {
  type: 'tool-call'
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
}

export type HolocronChatToolResultChunk = {
  type: 'tool-result'
  toolCallId: string
  toolName: string
  output: string
  error?: string
}

export type HolocronChatChunk =
  | HolocronChatNoticeChunk
  | HolocronChatUsageChunk
  | HolocronChatTextChunk
  | HolocronChatToolCallChunk
  | HolocronChatToolResultChunk

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
  message: z.string().min(1),
  visitorId: z.string().min(1),
  chatSessionId: z.string().min(1),
  currentSlug: z.string().optional(),
  docsZipUrl: z.string().url().optional(),
  docsPages: z.record(z.string(), z.string()).optional(),
})

function getMonthStartMs(): number {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).getTime()
}

function getUsageStub(orgId: string): DurableObjectStub<UsageCounter> {
  const id = env.USAGE_COUNTER.idFromName(orgId)
  return env.USAGE_COUNTER.get(id) as DurableObjectStub<UsageCounter>
}

function getFlueClient() {
  const baseUrl = (env as any).FLUE_CHAT_URL || 'https://holocron-chat.remorses.workers.dev'
  const token = (env as any).FLUE_CHAT_TOKEN || ''
  // Wrap fetch to preserve workerd's `this` binding — passing the bare
  // `fetch` reference to the SDK causes "Illegal invocation" in Workers.
  return createFlueClient({ baseUrl, token, fetch: (input, init) => fetch(input, init) })
}

/** Extract plain text from a Flue LlmAssistantMessage. */
function extractAssistantText(message: any): string {
  if (!message || message.role !== 'assistant' || !Array.isArray(message.content)) return ''
  return message.content
    .filter((c: any) => c.type === 'text')
    .map((c: any) => c.text)
    .join('')
}

export const gatewayApp = new Spiceflow()
  .route({
    method: 'POST',
    path: '/api/chat',
    request: chatRequestSchema,
    detail: { hide: true },
    async *handler({ request }): AsyncGenerator<HolocronChatChunk> {
      const authHeader = request.headers.get('authorization')
      const authResult = await validateApiKey(authHeader)

      // ── Unauthenticated or invalid key: IP-based rate limit ─────────
      if (!authResult) {
        const ip = request.headers.get('cf-connecting-ip') || 'unknown'
        const { success } = await env.CHAT_RATE_LIMITER.limit({ key: ip })
        if (!success) {
          yield NOTICE_RATE_LIMIT_REACHED
          return
        }
        if (authHeader) {
          throw new Response('Missing or invalid API key. Use a holo_xxx key in the Authorization header.', { status: 401 })
        }
      }

      const body = chatRequestSchema.parse(await request.json())
      const pageSlug = body.currentSlug ?? ''

      // ── Authenticated: subscription (D1) → per-project credit limit (DO) ─
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

      // ── Send prompt to Flue agent ──────────────────────────────────
      const client = getFlueClient()
      const projectId = authResult?.projectId ?? 'anonymous'
      const instanceId = `${projectId}:${body.chatSessionId}`

      // The vite plugin prepends personalized site context (site name,
      // current page content, page index) to body.message. Forward as-is.
      const agentStream = client.agents.invoke(FLUE_AGENT_NAME, instanceId, {
        mode: 'stream',
        payload: { message: body.message },
        signal: request.signal,
      })

      // ── Stream Flue events and map to HolocronChatChunk ────────────
      let textBuffer = ''
      let totalInputTokens = 0
      let totalOutputTokens = 0
      let totalCostUsd = 0

      try {
        for await (const event of agentStream) {
          switch (event.type) {
            case 'text_delta':
              textBuffer += (event as any).text ?? ''
              break

            case 'message_end': {
              const text = extractAssistantText((event as any).message) || textBuffer
              if (text.trim()) {
                yield { type: 'text', text }
              }
              textBuffer = ''
              break
            }

            case 'tool_execution_start':
              yield {
                type: 'tool-call',
                toolCallId: (event as any).toolCallId ?? '',
                toolName: (event as any).toolName ?? 'bash',
                args: (event as any).args ?? {},
              }
              break

            case 'tool_execution_end': {
              const result = (event as any).result
              const output = typeof result === 'string' ? result : JSON.stringify(result ?? '')
              yield {
                type: 'tool-result',
                toolCallId: (event as any).toolCallId ?? '',
                toolName: (event as any).toolName ?? 'bash',
                output: output.slice(0, 500),
                ...((event as any).isError ? { error: output } : {}),
              }
              break
            }

            case 'turn': {
              // Accumulate usage from each turn for billing
              const usage = (event as any).usage
              if (usage) {
                totalInputTokens += usage.input ?? 0
                totalOutputTokens += usage.output ?? 0
                totalCostUsd += usage.cost?.total ?? 0
              }
              break
            }

            case 'idle':
              // Agent has no more pending work; stop streaming
              break

            default:
              break
          }

          if (event.type === 'idle') break
        }

        // Emit final text if message_end was missed (e.g. stream interrupted)
        if (textBuffer.trim()) {
          yield { type: 'text', text: textBuffer }
          textBuffer = ''
        }

        // Emit usage for authenticated requests
        if (authResult && (totalInputTokens > 0 || totalOutputTokens > 0)) {
          yield {
            type: 'usage',
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            costUsd: totalCostUsd,
            credits: usdToCredits(totalCostUsd),
          } satisfies HolocronChatUsageChunk
        }
      } finally {
        // Record usage via waitUntil so it survives after the response closes
        if (authResult && (totalInputTokens > 0 || totalOutputTokens > 0)) {
          const pId = authResult.projectId
          const orgId = authResult.orgId
          waitUntil(
            (async () => {
              if (totalInputTokens === 0 && totalOutputTokens === 0) {
                captureException(new Error(`zero AI usage from Flue for project ${pId}`), {
                  tags: { route: 'gateway', projectId: pId },
                })
              }
              await getUsageStub(orgId).recordUsage({
                projectId: pId,
                model: FLUE_AGENT_NAME,
                pageSlug,
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
                costUsd: totalCostUsd,
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
