// Hosted Holocron AI chat route. Validates holo_xxx API keys, reads docs from
// either the caller's docs.zip or inline localhost pages, creates the docs bash
// tool, and streams AI SDK UI chunks through Spiceflow's typed SSE generator support.
//
// Usage tracking: authenticated requests are counted in a per-org Durable Object
// (UsageCounter). checkLimit() runs before streaming; recordUsage() inserts the
// full row after streaming via waitUntil so it survives after the response closes.
//
// Unauthenticated requests are rate-limited by IP via the CHAT_RATE_LIMITER
// binding (10 req / 60s). The rate limiter also applies to invalid API keys
// so spamming bogus keys can't bypass the IP limit.

import { streamText, type ModelMessage, type UIMessageChunk } from 'ai'
import { env, waitUntil } from 'cloudflare:workers'
import { unzipSync, strFromU8 } from 'fflate'
import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import { createWorkersAI } from 'workers-ai-provider'
import type { WorkersAI } from 'workers-ai-provider'
import { validateApiKey } from './db.ts'
import { createChatBashTool } from './chat-bash-tool.ts'
import { NOTICE_USAGE_LIMIT_REACHED, type UsageCounter } from './usage-counter-do.ts'

const ALLOWED_MODELS: Record<string, string> = {
  'gemma-4-26b': '@cf/google/gemma-4-26b-a4b-it',
  'glm-4.7-flash': '@cf/zai-org/glm-4.7-flash',
  'qwen3-30b': '@cf/qwen/qwen3-30b-a3b-fp8',
  'llama-3.1-8b': '@cf/meta/llama-3.1-8b-instruct-fast',
  'kimi-k2.5': '@cf/moonshotai/kimi-k2.5',
}

const DEFAULT_MODEL = 'glm-4.7-flash'
const TEMPORARY_MODEL = 'glm-4.7-flash'
const MONTHLY_REQUEST_LIMIT = 1000
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

export type HolocronChatChunk = UIMessageChunk | HolocronChatNoticeChunk
  | { type: 'model-messages'; messages: ModelMessage[] }

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
      const slug = name.replace(/\.md$/, '')
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
    path: '/api/holocron/chat',
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
          throw new Response('Rate limit exceeded. Try again later, or add a HOLOCRON_KEY for higher limits.', { status: 429 })
        }
        if (authHeader) {
          throw new Response('Missing or invalid API key. Use a holo_xxx key in the Authorization header.', { status: 401 })
        }
      }

      const body = chatRequestSchema.parse(await request.json())
      const messages: ModelMessage[] = body.messages
      const pageSlug = body.pageSlug ?? ''

      // ── Authenticated: check monthly usage limit via DO ──────────────
      if (authResult) {
        const stub = getUsageStub(authResult.orgId)
        const { allowed } = await stub.checkLimit({
          sinceMs: getMonthStartMs(),
          limit: MONTHLY_REQUEST_LIMIT,
        })
        if (!allowed) {
          yield NOTICE_USAGE_LIMIT_REACHED
          return
        }
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

      if (usesTemporaryModel) {
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

      for await (const chunk of result.toUIMessageStream()) {
        yield chunk
      }
      yield { type: 'model-messages', messages: (await result.response).messages }

      // ── Record usage via waitUntil (survives after response closes) ──
      if (authResult) {
        const usage = await result.usage
        const stub = getUsageStub(authResult.orgId)
        waitUntil(
          stub.recordUsage({
            projectId: authResult.projectId,
            model: modelName,
            pageSlug,
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
          }).catch(() => {}),
        )
      }
    },
  })
