/**
 * AI SDK cache middleware — wraps a LanguageModel to cache responses on disk.
 *
 * First call with a given prompt hits the real model and saves the response.
 * Subsequent calls with the same prompt replay from cache instantly.
 * Cache is stored as JSON files keyed by SHA-256 of the serialized params.
 *
 * Inspired by contesto's ai-cache.ts. Simplified to use plain fs + JSON
 * instead of unstorage + YAML to avoid extra dependencies.
 *
 * Usage:
 *   import { wrapLanguageModel } from 'ai'
 *   const cached = wrapLanguageModel({
 *     model: openai('gpt-4o-mini'),
 *     middleware: [createAiCacheMiddleware({ cacheDir: '.aicache' })],
 *   })
 */

import { simulateReadableStream } from 'ai'
import type {
  LanguageModelV3Middleware,
  LanguageModelV3StreamPart,
  LanguageModelV3,
} from '@ai-sdk/provider'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export type AiCacheOptions = {
  /** Directory to store cached responses. Defaults to `.aicache` relative to cwd. */
  cacheDir?: string
}

export function createAiCacheMiddleware({
  cacheDir = '.aicache',
}: AiCacheOptions = {}): LanguageModelV3Middleware {
  function getCacheDir(modelId: string): string {
    const base = path.isAbsolute(cacheDir)
      ? cacheDir
      : path.join(process.cwd(), cacheDir)
    return path.join(base, modelId.replace(/[/:]/g, '_'))
  }

  function readCache<T>(dir: string, key: string): T | null {
    const filePath = path.join(dir, `${key}.json`)
    if (!fs.existsSync(filePath)) return null
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T
    } catch {
      return null
    }
  }

  function writeCache(dir: string, key: string, data: unknown): void {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, `${key}.json`),
      JSON.stringify(data, null, 2),
    )
  }

  return {
    specificationVersion: 'v3',

    wrapGenerate: async ({ doGenerate, params, model }) => {
      const dir = getCacheDir(model.modelId)
      const key = hashParams(params)

      const cached = readCache<{
        result: Awaited<ReturnType<LanguageModelV3['doGenerate']>>
      }>(dir, key)

      if (cached?.result) {
        return {
          ...cached.result,
          response: {
            ...cached.result.response,
            timestamp: cached.result.response?.timestamp
              ? new Date(cached.result.response.timestamp as unknown as string)
              : undefined,
          },
        }
      }

      const result = await doGenerate()
      writeCache(dir, key, { result })
      return result
    },

    wrapStream: async ({ doStream, params, model }) => {
      const dir = getCacheDir(model.modelId)
      const key = hashParams(params)

      const cached = readCache<{ chunks: LanguageModelV3StreamPart[] }>(
        dir,
        key,
      )

      if (cached?.chunks) {
        const formattedChunks = cached.chunks.map((p) => {
          if (p.type === 'response-metadata' && p.timestamp) {
            return { ...p, timestamp: new Date(p.timestamp as unknown as string) }
          }
          return p
        })
        return {
          stream: simulateReadableStream({
            initialDelayInMs: 0,
            chunkDelayInMs: 0,
            chunks: formattedChunks,
          }),
        }
      }

      const { stream, ...rest } = await doStream()

      const fullResponse: LanguageModelV3StreamPart[] = []

      const transformStream = new TransformStream<
        LanguageModelV3StreamPart,
        LanguageModelV3StreamPart
      >({
        transform(chunk, controller) {
          fullResponse.push(chunk)
          controller.enqueue(chunk)
        },
        async flush() {
          writeCache(dir, key, { chunks: fullResponse })
        },
      })

      return {
        stream: stream.pipeThrough(transformStream),
        ...rest,
      }
    },
  }
}

/** Deep-sort all object keys for deterministic JSON serialization. */
function stableSortKeys(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(stableSortKeys)
  if (typeof value === 'object') {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = stableSortKeys((value as Record<string, unknown>)[key])
    }
    return sorted
  }
  return value
}

function hashParams(data: unknown): string {
  const jsonString = JSON.stringify(stableSortKeys(data))
  return createHash('sha256').update(jsonString).digest('hex')
}
