// Hosted Holocron AI chat route. Validates holo_xxx API keys, reads docs from
// either the caller's docs.zip or inline localhost pages, creates the docs bash
// tool, and streams AI SDK UI chunks through Spiceflow's typed SSE generator support.

import { streamText, type ModelMessage, type UIMessageChunk } from 'ai'
import { env } from 'cloudflare:workers'
import { unzipSync, strFromU8 } from 'fflate'
import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import { createWorkersAI } from 'workers-ai-provider'
import type { WorkersAI } from 'workers-ai-provider'
import { getDb, hashApiKey } from './db.ts'
import { createChatBashTool } from './chat-bash-tool.ts'

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
  code: 'HOLOCRON_TEMPORARY_AI_MODEL'
  title: string
  message: string
  command: string
}

export type HolocronChatChunk = UIMessageChunk | HolocronChatNoticeChunk
  | { type: 'model-messages'; messages: ModelMessage[] }

const chatRequestSchema = z.object({
  messages: z.array(z.any()),
  docsZipUrl: z.string().url().optional(),
  docsPages: z.record(z.string(), z.string()).optional(),
  skillUrls: z.array(z.string().url()).optional(),
})

const docsZipCache = new Map<string, { expiresAt: number; promise: Promise<Record<string, string>> }>()

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
      if (authHeader && !authResult) {
        throw new Response('Missing or invalid API key. Use a holo_xxx key in the Authorization header.', { status: 401 })
      }

      const usageKey = authResult ? getUsageKey(authResult.orgId) : undefined
      const currentUsage = usageKey ? parseInt(await env.USAGE_KV.get(usageKey) || '0', 10) : 0
      if (usageKey && currentUsage >= MONTHLY_REQUEST_LIMIT) {
        throw new Response('Monthly request limit exceeded. Upgrade your plan for higher limits.', { status: 429 })
      }

      const body = chatRequestSchema.parse(await request.json())
      const messages: ModelMessage[] = body.messages
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

      if (usageKey) {
        env.USAGE_KV.put(usageKey, String(currentUsage + 1), { expirationTtl: 60 * 60 * 24 * 35 })
          .catch(() => {})
      }

      const workersai = createWorkersAI({ binding: env.AI })
      const usesTemporaryModel = !authResult
      const modelName = usesTemporaryModel ? TEMPORARY_MODEL : DEFAULT_MODEL
      const modelId = ALLOWED_MODELS[modelName] ?? ALLOWED_MODELS[DEFAULT_MODEL]!

      if (usesTemporaryModel) {
        yield {
          type: 'notice',
          code: 'HOLOCRON_TEMPORARY_AI_MODEL',
          title: 'Temporary AI model',
          message: 'Add HOLOCRON_API_KEY before deploying for reliable AI chat.',
          command: 'npx @holocron.so/cli keys create --name production',
        }
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
    },
  })
