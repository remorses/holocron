// Hosted Holocron AI chat route (/api/chat). Validates holo_xxx API
// keys, reads docs from either the caller's docs.zip or inline localhost pages,
// creates the docs bash tool, and streams AI SDK UI chunks through Spiceflow's
// typed SSE generator support.
//
// Provider architecture: all models are accessed via @ai-sdk/gateway (Vercel AI
// Gateway) which proxies to upstream providers (Moonshot, Anthropic, OpenAI,
// etc.). ai-fallback wraps the primary model with fallbacks so if one provider
// is down we automatically try the next. The AI_GATEWAY_API_KEY secret
// authenticates with Vercel's gateway; it covers all providers in one key.
//
// Usage tracking: authenticated requests are counted in a per-org Durable Object
// (UsageCounter). checkLimit() runs before streaming; recordUsage() inserts the
// full row after streaming via waitUntil so it survives after the response closes.
//
// Unauthenticated requests are rate-limited by IP via the CHAT_RATE_LIMITER
// binding (5 req / 60s). The rate limiter also applies to invalid API keys
// so spamming bogus keys can't bypass the IP limit. When the limit is hit we
// yield a friendly notice chunk (rendered as a card) instead of a raw 429.

import { streamText, generateText, jsonSchema, tool as aiTool, type LanguageModelUsage, type ModelMessage, type UIMessageChunk } from 'ai'
import { createGateway } from '@ai-sdk/gateway'
import { createFallback } from 'ai-fallback'
import { captureException, getLogger } from '@strada.sh/sdk'
import { env, waitUntil } from 'cloudflare:workers'
import { unzipSync, strFromU8 } from 'fflate'
import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import { validateApiKey, getProjectBillingContext } from './db.ts'
import { shouldShowHolocronPromotion } from './lib/billing-rules.ts'
import { ALLOWED_MODELS, DEFAULT_MODEL, MODEL_USD_PER_1M_TOKENS } from './lib/ai-models.ts'
import { computeUsdCost, creditsToUsd, monthlyCreditBudget, usdToCredits } from './lib/credits.ts'
import { createChatBashTool } from './chat-bash-tool.ts'
import { NOTICE_USAGE_LIMIT_REACHED, type UsageCounter } from './usage-counter-do.ts'
import { MAX_SNAPSHOT_BYTES, type ChatSessionDO } from './chat-session-do.ts'

const chatLogger = getLogger('chat')

const TEMPORARY_MODEL = DEFAULT_MODEL
const TITLE_MODEL = DEFAULT_MODEL
const DOCS_ZIP_CACHE_MS = 5 * 60 * 1000

// All fallback models tried in order when the primary fails. The first model
// in the ALLOWED_MODELS map is always the primary; the rest are fallbacks.
// ai-fallback automatically switches to the next model on retryable errors
// (rate limits, timeouts, 5xx) and resets to the primary after 60s.
const FALLBACK_MODEL_NAMES = Object.keys(ALLOWED_MODELS)

// Mirrors the `notice` ChatPart in @holocron.so/vite (chat/chat-store.ts).
// Both sides must stay in sync — this crosses a network boundary.
export type HolocronChatNoticeChunk = {
  type: 'notice'
  code: string
  title: string
  message: string
  command?: string
  cta?: { label: string; href: string }
  ownerNote?: { text: string; linkLabel: string; href: string }
  /** Visual weight only. `promotion` uses the site's primary color. */
  severity?: 'info' | 'error' | 'promotion'
  /** Repetition policy, independent of severity. `once` is for standing
   *  content re-sent every turn (such as the Holocron promotion). `always`
   *  (default) is for per-turn outcomes — limits and errors — which must
   *  render every time or the turn looks like it silently hung. */
  display?: 'once' | 'always'
}

/**
 * User-facing text for a provider failure.
 *
 * Raw provider errors can carry internal URLs, request ids and response body
 * excerpts, and they are streamed to visitors of customer docs sites. The AI
 * SDK masks them by default for exactly this reason. The real message always
 * goes to Strada; only these curated strings are sent to the browser.
 */
function safeProviderMessage(raw: string): string {
  if (/no output generated/i.test(raw)) {
    return 'The AI model did not return a response. This usually means the provider is temporarily unavailable. Please try again.'
  }
  if (/rate.?limit|429|too many requests/i.test(raw)) {
    return 'The AI provider is rate limited right now. Please try again in a moment.'
  }
  if (/timeout|timed out|etimedout/i.test(raw)) {
    return 'The AI provider timed out. Please try again.'
  }
  if (/abort/i.test(raw)) {
    return 'The response was interrupted before it finished.'
  }
  return 'The AI provider failed to return a response. Please try again.'
}

/** Error notice shown in the chat UI when a turn fails. */
function streamErrorNotice(rawMessage: string): HolocronChatNoticeChunk {
  const isNoOutput = /no output generated/i.test(rawMessage)
  return {
    type: 'notice',
    severity: 'error',
    display: 'always',
    code: 'HOLOCRON_STREAM_ERROR',
    title: isNoOutput ? 'AI model unavailable' : 'Something went wrong',
    message: safeProviderMessage(rawMessage),
  }
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

// AI-generated conversation title, yielded once after the first turn of a
// session. The widget stores it in its local session list (localStorage).
export type HolocronChatTitleChunk = {
  type: 'title'
  title: string
}

export type HolocronChatChunk = UIMessageChunk | HolocronChatNoticeChunk
  | HolocronChatUsageChunk
  | HolocronChatTitleChunk
  | { type: 'model-messages'; messages: ModelMessage[] }

// Shown in the chat UI (as a yellow notice card) when an unauthenticated
// caller hits the per-IP rate limit. Nudges them to add a HOLOCRON_KEY for
// higher limits instead of surfacing a raw 429 error.
const NOTICE_RATE_LIMIT_REACHED = {
  type: 'notice',
  code: 'HOLOCRON_RATE_LIMIT_REACHED',
  title: 'Rate limit reached',
  message: 'Too many AI chat requests. Wait a minute and try again, or add a HOLOCRON_KEY for higher limits.',
  command: 'npx -y "@holocron.so/cli" keys create --name production --project <projectId>',
} as const satisfies HolocronChatNoticeChunk

// Client tool names are re-validated server-side — the widget's defineTool()
// validation cannot be trusted since anyone can POST here directly.
const toolSchemaItem = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  description: z.string(),
  inputJsonSchema: z.record(z.string(), z.any()),
})

// Persistent chat session id — a 256-bit CSPRNG bearer token generated by the
// vite proxy (chs_ + 43 base64url chars). Knowing the id grants access to the
// conversation; the format regex rejects garbage before any DO lookup.
const sessionIdSchema = z.string().regex(/^chs_[A-Za-z0-9_-]{43}$/)

const chatRequestSchema = z.object({
  messages: z.array(z.any()),
  docsZipUrl: z.string().url().optional(),
  docsPages: z.record(z.string(), z.string()).optional(),
  skillUrls: z.array(z.string().url()).optional(),
  pageSlug: z.string().optional(),
  toolSchemas: z.array(toolSchemaItem).optional(),
  sessionId: sessionIdSchema.optional(),
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

function getChatSessionStub(siteKey: string): DurableObjectStub<ChatSessionDO> {
  const id = env.CHAT_SESSION.idFromName(siteKey)
  return env.CHAT_SESSION.get(id) as DurableObjectStub<ChatSessionDO>
}

// One Durable Object per docs site. Authenticated callers key by projectId
// (stable across domain changes); unauthenticated callers key by the docs
// site host sent by the vite proxy (x-holocron-site), falling back to the
// docsZipUrl host, which the proxy derives from the same request URL.
// Scoping sessions per site means a leaked session id from one site can
// never be resolved through another site's key space.
function resolveSiteKey(args: {
  projectId?: string | null
  siteHeader?: string | null
  docsZipUrl?: string
}): string | null {
  if (args.projectId) return `project:${args.projectId}`
  if (args.siteHeader) return `host:${args.siteHeader}`
  if (args.docsZipUrl) {
    try {
      return `host:${new URL(args.docsZipUrl).host}`
    } catch {
      return null
    }
  }
  return null
}

// Trim oldest messages until the snapshot fits the DO's byte cap. Keeps the
// tail of the conversation (most recent context) rather than failing the save.
// Measures real UTF-8 bytes — string.length counts UTF-16 code units and
// undercounts non-ASCII content.
function trimSnapshot(messages: unknown[]): unknown[] {
  const encoder = new TextEncoder()
  let trimmed = messages
  while (trimmed.length > 1 && encoder.encode(JSON.stringify(trimmed)).byteLength > MAX_SNAPSHOT_BYTES) {
    trimmed = trimmed.slice(1)
  }
  return trimmed
}

/** Text of the first user message — the input for title generation. */
function firstUserText(messages: ModelMessage[]): string {
  const first = messages.find((m) => m.role === 'user')
  if (!first) return ''
  if (typeof first.content === 'string') return first.content
  return first.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
}

// Resolve a turn's exact usage and USD cost. result.usage sums every tool-call
// step and exposes cached prompt tokens, which computeUsdCost bills at the
// model's cheaper cached rate. Tolerates a rejected/absent usage promise
// (e.g. client abort before final usage) by returning zeros.
async function resolveUsageCost(
  usagePromise: PromiseLike<LanguageModelUsage>,
  modelName: string,
): Promise<{ inputTokens: number; outputTokens: number; costUsd: number }> {
  const usage = await Promise.resolve(usagePromise).catch(() => null)
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
    detail: { hide: true },
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

      // Org-scoped keys are control-plane only. Chat is always billed per site
      // via a project key; allowing org keys would skip usage limits.
      if (authResult?.scope === 'org') {
        throw new Response(
          'Org-scoped API keys cannot use AI chat. Use a project-scoped holo_ key instead.',
          { status: 403 },
        )
      }

      const body = chatRequestSchema.parse(await request.json())
      const messages: ModelMessage[] = body.messages
      const pageSlug = body.pageSlug ?? ''
      const chatProjectId = authResult?.projectId ?? null
      const siteKey = resolveSiteKey({
        projectId: chatProjectId,
        siteHeader: request.headers.get('x-holocron-site'),
        docsZipUrl: body.docsZipUrl,
      })

      // ── Authenticated: subscription + org plan (one D1 read) → credit limit (DO) ─
      // getProjectBillingContext joins project → org + subscriptions in a single
      // SQL statement, so this adds zero extra latency vs the old subscription-only query.
      const { subscription: subscriptionResult, orgPlan } = chatProjectId
        ? await getProjectBillingContext(chatProjectId)
        : { subscription: null, orgPlan: 'free' as const }
      const isPartner = orgPlan === 'partner'

      const limitCheck = authResult && chatProjectId
        ? await getUsageStub(authResult.orgId).checkLimit({
            projectId: chatProjectId,
            sinceMs: getMonthStartMs(),
            usdLimit: creditsToUsd(monthlyCreditBudget({ hasActiveSubscription: !!subscriptionResult, isPartner })),
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

      const usesTemporaryModel = !authResult
      const modelName = usesTemporaryModel ? TEMPORARY_MODEL : DEFAULT_MODEL

      // Build the AI model with automatic fallback across providers.
      // All models go through @ai-sdk/gateway (Vercel AI Gateway) which
      // proxies to the upstream provider (Moonshot, Anthropic, OpenAI, etc.).
      // ai-fallback tries models in order on retryable errors (rate limits,
      // timeouts, 5xx) and resets to the primary after 60s.
      const gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY })
      const primaryModelId = ALLOWED_MODELS[modelName] ?? ALLOWED_MODELS[DEFAULT_MODEL]!
      const fallbackModels = FALLBACK_MODEL_NAMES
        .filter((name) => name !== modelName)
        .map((name) => gateway(ALLOWED_MODELS[name]!))

      const model = fallbackModels.length > 0
        ? createFallback({
            models: [gateway(primaryModelId), ...fallbackModels],
            modelResetInterval: 60_000,
            onError: (error, failedModelId) => {
              captureException(error instanceof Error ? error : new Error(String(error)), {
                tags: { route: 'gateway', model: failedModelId, reason: 'ai-fallback' },
              })
            },
          })
        : gateway(primaryModelId)

      // Generate a short conversation title on the first message of a
      // persistent session. Runs in parallel with the main stream on the
      // cheapest model (one-shot generateText, ~$0.0001 — not usage-billed);
      // the title chunk is yielded after the stream so it never delays the
      // answer. Failures just leave the widget showing its preview label.
      const isFirstTurn = messages.filter((m) => m.role === 'user').length === 1
      const titlePromise = body.sessionId && isFirstTurn
        ? generateText({
            model: gateway(ALLOWED_MODELS[TITLE_MODEL]!),
            prompt: `Write a short title (at most 6 words) summarizing this documentation question. Reply with the title only — no quotes, no trailing punctuation.\n\nQuestion: ${firstUserText(messages).slice(0, 2000)}`,
            maxOutputTokens: 200,
            abortSignal: request.signal,
          })
            .then((result) => result.text.trim().replace(/^["']|["']$/g, '').slice(0, 80) || null)
            .catch(() => null)
        : null

      // Free sites promote Holocron once per conversation. Subscribed and
      // partner-entitled projects do not show it.
      const showHolocronPromotion = shouldShowHolocronPromotion({
        hasActiveSubscription: !!subscriptionResult,
        orgPlan,
      })

      if (showHolocronPromotion) {
        yield {
          type: 'notice',
          // Standing promotion re-sent every turn and shown once per conversation.
          display: 'once',
          severity: 'promotion',
          code: 'HOLOCRON_PROMOTION',
          title: 'delightful docs for humans & agents',
          message: 'Holocron',
          cta: {
            label: 'Start a Holocron site',
            href: 'https://holocron.so/',
          },
          ownerNote: {
            text: 'For site owner.',
            linkLabel: 'Upgrade to remove this.',
            href: 'https://holocron.so/docs/pricing',
          },
        } as const
      }

      // Register client tools as manual tools (no execute function).
      // AI SDK emits tool-call chunks but does NOT execute them — the client
      // widget handles execution and re-submits with results.
      // Filter out reserved server tool names to prevent client tools from
      // overriding bash or other server-side tools.
      const RESERVED_TOOL_NAMES = new Set(['bash'])
      const clientTools = Object.fromEntries(
        (body.toolSchemas ?? [])
          .filter((t) => !RESERVED_TOOL_NAMES.has(t.name))
          .map((t) => [
            t.name,
            aiTool({
              description: t.description,
              inputSchema: jsonSchema(t.inputJsonSchema as any),
            }),
          ]),
      )

      const result = streamText({
        model,
        tools: { bash, ...clientTools },
        messages,
        allowSystemInMessages: true,
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

      // ── Per-turn outcome tracking ─────────────────────────────────
      // Chat turns stream, so the request span ends long before the answer
      // does and tells us nothing. This counter block is the only signal
      // that says whether the user actually received text. A turn with
      // `textChars: 0` is the "the response never arrived" failure.
      const turnStartedAt = Date.now()
      const turn = {
        textChars: 0,
        textParts: 0,
        reasoningChars: 0,
        toolCalls: 0,
        /** Time to first text delta; -1 when the turn produced no text. */
        ttftMs: -1,
        sawTextEnd: false,
        /** An `error` chunk already told the user. Used to avoid a second
         *  notice when result.usage/result.response reject for the same
         *  failure right after. */
        sawErrorChunk: false,
        finishReason: '',
        errorText: '',
      }

      // One try covers streaming AND the post-stream bookkeeping. The finally
      // guarantees the turn is logged and billed even when the consumer
      // abandons the generator mid-stream (browser disconnect, stop button) —
      // exactly the turns worth observing. Nothing is yielded from finally:
      // after a `return()` the generator can no longer produce values.
      let phase: 'stream' | 'post-stream' = 'stream'
      try {
        for await (const chunk of result.toUIMessageStream({
          // The AI SDK masks provider errors as "An error occurred." by
          // default and converts them into `error` CHUNKS instead of
          // throwing — so without this hook a failed turn reached the user
          // as an unexplained empty answer and never reached Strada.
          onError: (error) => {
            const err = error instanceof Error ? error : new Error(String(error))
            turn.errorText = err.message
            turn.sawErrorChunk = true
            captureException(err, {
              tags: { route: 'gateway', model: modelName, reason: 'ui-stream-error' },
            })
            // Curated text only — the raw message is streamed to visitors of
            // customer docs sites and can leak provider internals.
            return safeProviderMessage(err.message)
          },
        })) {
          if (chunk.type === 'text-delta') {
            if (turn.ttftMs < 0) turn.ttftMs = Date.now() - turnStartedAt
            turn.textChars += chunk.delta?.length ?? 0
          } else if (chunk.type === 'text-end') {
            turn.sawTextEnd = true
            turn.textParts += 1
          } else if (chunk.type === 'reasoning-delta') {
            turn.reasoningChars += chunk.delta?.length ?? 0
          } else if (chunk.type === 'tool-input-available') {
            turn.toolCalls += 1
          } else if (chunk.type === 'finish') {
            turn.finishReason = chunk.finishReason ?? ''
          }
          yield chunk
        }

        // Everything below runs AFTER the model finished. A rejection here
        // (result.response, the session DO, the title model) must never take
        // down a turn whose text already streamed — it would look exactly
        // like a lost answer to the user.
        phase = 'post-stream'

        // Emit this turn's exact usage (authenticated only). Cost is tokens ×
        // the per-model rate table — synchronous, no gateway.
        if (authResult) {
          const { inputTokens, outputTokens, costUsd } = await resolveUsageCost(result.usage, modelName)
          yield {
            type: 'usage',
            inputTokens,
            outputTokens,
            costUsd,
            credits: usdToCredits(costUsd),
          } satisfies HolocronChatUsageChunk
        }
        const responseMessages = (await result.response).messages
        yield { type: 'model-messages', messages: responseMessages }

        // Persist the full conversation snapshot (system prompt excluded — it
        // is rebuilt by the proxy on every turn). Awaited so the write lands
        // before the stream closes: a page reload right after the answer must
        // find the snapshot already stored. Cost is one DO roundtrip after
        // all text has already streamed. Concurrent tabs on the same session
        // are last-write-wins by design (whole-snapshot replace). Runs BEFORE
        // awaiting the title so a slow title model can't delay persistence.
        if (body.sessionId && siteKey) {
          const snapshot = trimSnapshot([
            ...messages.filter((m) => m.role !== 'system'),
            ...responseMessages,
          ])
          try {
            await getChatSessionStub(siteKey).saveSnapshot({
              sessionId: body.sessionId,
              pageSlug,
              modelMessagesJson: JSON.stringify(snapshot),
            })
          } catch (error) {
            captureException(error instanceof Error ? error : new Error(String(error)), {
              tags: { route: 'gateway', reason: 'chat-session-save-failed' },
            })
          }
        }

        const title = titlePromise ? await titlePromise : null
        if (title) {
          yield { type: 'title', title } satisfies HolocronChatTitleChunk
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        turn.errorText ||= err.message
        captureException(err, {
          tags: { route: 'gateway', model: modelName, reason: `${phase}-error` },
        })
        // Tell the user only when nothing rendered AND the failure was not
        // already reported as an error chunk: result.usage and result.response
        // reject for the same provider failure, which would otherwise show the
        // identical notice twice.
        //
        // The AI SDK throws NoOutputGeneratedError when the model stream ends
        // without producing output (provider timeout, empty response, upstream
        // 5xx that exhausted fallbacks).
        if (turn.textChars === 0 && !turn.sawErrorChunk) {
          yield streamErrorNotice(err.message)
        }
      } finally {
        // ── One log line per turn (queryable in Strada) ────────────────
        // SELECT … FROM otel_logs WHERE LogAttributes['event'] = 'ai.chat.turn'
        //   AND LogAttributes['renderable'] = 'false'
        //
        // A turn is "renderable" when the user got text, reasoning, or a tool
        // call. Intermediate client-tool turns legitimately have no text, so
        // keying the failure signal on textChars alone would flood Strada.
        const hasRenderableOutput = turn.textChars > 0 || turn.reasoningChars > 0 || turn.toolCalls > 0
        const turnLog = {
          event: 'ai.chat.turn',
          model: modelName,
          projectId: chatProjectId ?? '',
          sessionId: body.sessionId ?? '',
          pageSlug,
          authenticated: !!authResult,
          durationMs: Date.now() - turnStartedAt,
          ttftMs: turn.ttftMs,
          textChars: turn.textChars,
          textParts: turn.textParts,
          reasoningChars: turn.reasoningChars,
          toolCalls: turn.toolCalls,
          sawTextEnd: turn.sawTextEnd,
          renderable: hasRenderableOutput,
          finishReason: turn.finishReason,
          clientTools: Object.keys(clientTools).length,
          errorText: turn.errorText,
        }
        if (!hasRenderableOutput) {
          chatLogger.error({ message: 'chat turn produced nothing renderable', ...turnLog })
          // Not covered by the error paths above: the model finished
          // "successfully" but emitted nothing at all.
          if (!turn.errorText) {
            captureException(
              new Error(`chat turn produced nothing renderable (model ${modelName}, finishReason ${turn.finishReason || 'none'})`),
              {
                tags: {
                  route: 'gateway',
                  model: modelName,
                  reason: 'empty-answer',
                  finishReason: turn.finishReason || 'none',
                },
              },
            )
          }
        } else {
          chatLogger.info({ message: 'chat turn', ...turnLog })
        }

        // Usage recording runs on every path (stream error, abort, disconnect)
        // because the model already cost money. waitUntil survives the response.
        if (authResult && chatProjectId) {
          const projectId = chatProjectId
          const orgId = authResult.orgId
          waitUntil(
            (async () => {
              const { inputTokens, outputTokens, costUsd } = await resolveUsageCost(result.usage, modelName)
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
  // ── Persistent chat sessions ─────────────────────────────────────────
  // Restore a conversation. Access control is capability-based: the session
  // id is a 256-bit random bearer token, and lookups are scoped to the
  // caller's site DO so an id can never be resolved through another site.
  // Invalid id formats are rejected before any DO invocation. No IP rate
  // limit here: reads are cheap DO lookups and sharing the 5/60s chat
  // limiter would break restore-then-ask flows for unauthenticated users.
  .route({
    method: 'GET',
    path: '/api/chat/session',
    detail: { hide: true },
    async handler({ request }) {
      const parsedSessionId = sessionIdSchema.safeParse(request.headers.get('x-holocron-chat-session'))
      if (!parsedSessionId.success) {
        throw new Response('Invalid or missing x-holocron-chat-session header', { status: 400 })
      }
      const authResult = await validateApiKey(request.headers.get('authorization'))
      if (authResult?.scope === 'org') {
        throw new Response(
          'Org-scoped API keys cannot use AI chat sessions. Use a project-scoped holo_ key instead.',
          { status: 403 },
        )
      }
      const siteKey = resolveSiteKey({
        projectId: authResult?.projectId ?? null,
        siteHeader: request.headers.get('x-holocron-site'),
      })
      if (!siteKey) {
        throw new Response('Missing x-holocron-site header', { status: 400 })
      }
      const snapshot = await getChatSessionStub(siteKey).getSnapshot({ sessionId: parsedSessionId.data })
      let modelMessages: Record<string, unknown>[] = []
      if (snapshot) {
        try {
          const parsed = JSON.parse(snapshot.modelMessagesJson)
          if (Array.isArray(parsed)) modelMessages = parsed
        } catch {
          // corrupt snapshot — treat as no session
        }
      }
      return { modelMessages }
    },
  })
  // Delete a conversation (user pressed "New chat" in the widget).
  .route({
    method: 'DELETE',
    path: '/api/chat/session',
    detail: { hide: true },
    async handler({ request }) {
      const parsedSessionId = sessionIdSchema.safeParse(request.headers.get('x-holocron-chat-session'))
      if (!parsedSessionId.success) {
        throw new Response('Invalid or missing x-holocron-chat-session header', { status: 400 })
      }
      const authResult = await validateApiKey(request.headers.get('authorization'))
      if (authResult?.scope === 'org') {
        throw new Response(
          'Org-scoped API keys cannot use AI chat sessions. Use a project-scoped holo_ key instead.',
          { status: 403 },
        )
      }
      const siteKey = resolveSiteKey({
        projectId: authResult?.projectId ?? null,
        siteHeader: request.headers.get('x-holocron-site'),
      })
      if (!siteKey) {
        throw new Response('Missing x-holocron-site header', { status: 400 })
      }
      await getChatSessionStub(siteKey).clearSession({ sessionId: parsedSessionId.data })
      return { deleted: true }
    },
  })
