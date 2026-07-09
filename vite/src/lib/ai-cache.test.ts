/**
 * Unit tests for the AI cache middleware.
 *
 * Uses a fake LanguageModelV2 that returns fixed responses to verify
 * that the cache middleware correctly stores and replays both
 * doGenerate and doStream calls.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { streamText, generateText, wrapLanguageModel } from 'ai'
import type { LanguageModelV3 } from '@ai-sdk/provider'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createAiCacheMiddleware } from '../../../integration-tests/lib/ai-cache.ts'

/** Create a minimal fake model that counts how many times it's called. */
function createFakeModel(text: string) {
  const model = {
    specificationVersion: 'v3',
    provider: 'test',
    modelId: 'fake-model',
    supportedUrls: {},
    callCount: 0,

    async doGenerate() {
      model.callCount++
      return {
        content: [{ type: 'text' as const, text }],
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 5 },
        request: { body: '' },
        response: {
          id: 'gen-1',
          timestamp: new Date(),
          modelId: 'fake-model',
          headers: {},
        },
        warnings: [],
      }
    },

    async doStream() {
      model.callCount++
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'text-start', id: 't1' })
          controller.enqueue({ type: 'text-delta', id: 't1', delta: text })
          controller.enqueue({ type: 'text-end', id: 't1' })
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop' as const,
            usage: { inputTokens: 10, outputTokens: 5 },
            providerMetadata: {},
          })
          controller.close()
        },
      })
      return { stream }
    },
  } as unknown as LanguageModelV3 & { callCount: number }
  return model
}

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ai-cache-test-'))
}

describe('ai-cache middleware', () => {
  let cacheDir: string

  beforeEach(() => {
    cacheDir = makeTempDir()
  })

  test('generateText caches on first call and replays on second', async () => {
    const fakeModel = createFakeModel('Hello from cache')
    const middleware = createAiCacheMiddleware({ cacheDir })
    const model = wrapLanguageModel({
      model: fakeModel,
      middleware: [middleware],
    })

    const result1 = await generateText({ model, prompt: 'Say hello' })
    expect(result1.text).toBe('Hello from cache')
    expect(fakeModel.callCount).toBe(1)

    // Second call with same prompt should hit cache
    const result2 = await generateText({ model, prompt: 'Say hello' })
    expect(result2.text).toBe('Hello from cache')
    expect(fakeModel.callCount).toBe(1) // NOT incremented

    // Cache directory should have a file
    const modelDir = path.join(cacheDir, 'fake-model')
    const files = fs.readdirSync(modelDir)
    expect(files.length).toBe(1)
    expect(files[0]).toMatch(/\.json$/)
  })

  test('generateText with different prompts creates separate cache entries', async () => {
    const fakeModel = createFakeModel('Response')
    const middleware = createAiCacheMiddleware({ cacheDir })
    const model = wrapLanguageModel({
      model: fakeModel,
      middleware: [middleware],
    })

    await generateText({ model, prompt: 'Prompt A' })
    await generateText({ model, prompt: 'Prompt B' })
    expect(fakeModel.callCount).toBe(2)

    // Replay both
    await generateText({ model, prompt: 'Prompt A' })
    await generateText({ model, prompt: 'Prompt B' })
    expect(fakeModel.callCount).toBe(2) // No new calls
  })

  test('streamText caches chunks and replays them', async () => {
    const fakeModel = createFakeModel('Streamed hello')
    const middleware = createAiCacheMiddleware({ cacheDir })
    const model = wrapLanguageModel({
      model: fakeModel,
      middleware: [middleware],
    })

    // First call — streams from real model. Consume the full stream
    // so the TransformStream flushes and writes the cache file.
    const result1 = streamText({ model, prompt: 'Stream me' })
    let text1 = ''
    for await (const chunk of result1.textStream) {
      text1 += chunk
    }
    expect(text1).toBe('Streamed hello')
    expect(fakeModel.callCount).toBe(1)

    // Wait briefly for the async flush to write the cache
    await new Promise((r) => setTimeout(r, 50))

    // Second call — replays from cache
    const result2 = streamText({ model, prompt: 'Stream me' })
    let text2 = ''
    for await (const chunk of result2.textStream) {
      text2 += chunk
    }
    expect(text2).toBe('Streamed hello')
    expect(fakeModel.callCount).toBe(1)

    // Cache file exists
    const modelDir = path.join(cacheDir, 'fake-model')
    const files = fs.readdirSync(modelDir)
    expect(files.length).toBe(1)
  }, 15000)

  test('cache files are valid JSON', async () => {
    const fakeModel = createFakeModel('Check JSON')
    const middleware = createAiCacheMiddleware({ cacheDir })
    const model = wrapLanguageModel({
      model: fakeModel,
      middleware: [middleware],
    })

    await generateText({ model, prompt: 'Test JSON' })

    const modelDir = path.join(cacheDir, 'fake-model')
    const files = fs.readdirSync(modelDir)
    const content = JSON.parse(
      fs.readFileSync(path.join(modelDir, files[0]!), 'utf-8'),
    )
    expect(content).toHaveProperty('result')
    expect(content.result.content[0]).toEqual({ type: 'text', text: 'Check JSON' })
  })
})
