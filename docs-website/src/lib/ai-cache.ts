import stableString from 'fast-json-stable-stringify'
import { FlatCache } from 'flat-cache'

import {
    type LanguageModelV1,
    type LanguageModelV1Middleware,
    type LanguageModelV1StreamPart,
    simulateReadableStream,
} from 'ai'
import { createHash } from 'crypto'
import { existsSync } from 'fs'
import path, { dirname, join, resolve } from 'path'

export function createAiCacheMiddleware({
    cacheDir = '.aicache',
    lruSize = 300,
    cwd = process.cwd(),
    ttl = 1000 * 60 * 24 * 360,
    onParams = (x) => {},
} = {}) {
    const modelsCaches = new Map<string, FlatCache>()

    function getModelCache(modelId: string) {
        if (!path.isAbsolute(cacheDir)) {
            cacheDir = findUp(cacheDir, cwd) || cacheDir
        }
        if (!modelId) {
            throw new Error(`no modelId in ai generation`)
        }
        const cache = modelsCaches.get(modelId)

        if (!cache) {
            const cacheId = `${modelId}-cache.json`
            const cache = new FlatCache({
                cacheDir,
                cacheId,
                lruSize,

                ttl,
                serialize(data) {
                    return JSON.stringify(data)
                },
                deserialize(data) {
                    return JSON.parse(data)
                },
            })
            cache.load()
            modelsCaches.set(modelId, cache)
            return cache
        }
        return cache
    }
    const cacheMiddleware: LanguageModelV1Middleware = {
        wrapGenerate: async ({ doGenerate, params, model }) => {
            const cache = getModelCache(model.modelId)

            onParams?.(params)
            const cacheKey = hashKey(params)

            const cached = (await cache.get(cacheKey)) as Awaited<
                ReturnType<LanguageModelV1['doGenerate']>
            > | null

            if (cached) {
                return {
                    ...cached,
                    response: {
                        ...cached.response,
                        timestamp: cached?.response?.timestamp
                            ? new Date(cached?.response?.timestamp)
                            : undefined,
                    },
                }
            }

            const result = await doGenerate()

            cache.set(cacheKey, result)
            cache.save(true)

            return result
        },

        wrapStream: async ({ doStream, model, params }) => {
            const cacheKey = hashKey(params)
            const cache = getModelCache(model.modelId)
            onParams?.(params)
            // Check if the result is in the cache
            const cached = (await cache.get(
                cacheKey,
            )) as LanguageModelV1StreamPart[]

            // If cached, return a simulated ReadableStream that yields the cached result
            if (cached) {
                // Format the timestamps in the cached response
                const formattedChunks = cached.map((p) => {
                    if (p.type === 'response-metadata' && p.timestamp) {
                        return { ...p, timestamp: new Date(p.timestamp) }
                    } else return p
                })
                return {
                    stream: simulateReadableStream({
                        initialDelayInMs: 0,
                        chunkDelayInMs: 0,
                        chunks: formattedChunks,
                    }),

                    rawCall: { rawPrompt: null, rawSettings: {} },
                }
            }

            // If not cached, proceed with streaming
            const { stream, ...rest } = await doStream()

            const fullResponse: LanguageModelV1StreamPart[] = []

            const transformStream = new TransformStream<
                LanguageModelV1StreamPart,
                LanguageModelV1StreamPart
            >({
                transform(chunk, controller) {
                    fullResponse.push(chunk)
                    controller.enqueue(chunk)
                },

                flush() {
                    // Store the full response in the cache after streaming is complete
                    // console.log(`saving ai cache`)
                    cache.set(cacheKey, fullResponse)
                    cache.save(true)
                },
            })

            return {
                stream: stream.pipeThrough(transformStream),
                ...rest,
            }
        },
    }
    return cacheMiddleware
}

function hashKey(data: any): string {
    const jsonString = stableString(data)
    return createHash('sha256').update(jsonString).digest('hex')
}

function findUp(filename: string, startDir: string): string | null {
    let currentDir = resolve(startDir)

    while (true) {
        const filePath = join(currentDir, filename)

        if (existsSync(filePath)) {
            return filePath
        }

        const parentDir = dirname(currentDir)

        // If we've reached the root directory
        if (parentDir === currentDir) {
            return null
        }

        currentDir = parentDir
    }
}
