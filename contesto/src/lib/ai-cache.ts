import stableString from 'fast-json-stable-stringify'
import { createStorage, type Storage } from 'unstorage'
import fsDriverImport from 'unstorage/drivers/fs'
const fsDriver = fsDriverImport as unknown as (opts: { base?: string }) => any
import {
    simulateReadableStream,
} from 'ai'
import {
    type LanguageModelV2,
    type LanguageModelV2Middleware,
    type LanguageModelV2StreamPart,
} from '@ai-sdk/provider'
import { createHash } from 'node:crypto'
import path from 'node:path'
import * as yaml from 'js-yaml'

export function createAiCacheMiddleware({
    cacheDir = '.aicache',
    onParams = (x) => {},
} = {}) {
    const modelsCaches = new Map<string, Storage>()

    function getModelCache(modelId: string) {
        if (!modelId) {
            throw new Error(`no modelId in ai generation`)
        }
        const cache = modelsCaches.get(modelId)

        if (!cache) {
            // Use absolute path from current working directory
            const modelCacheDir = path.isAbsolute(cacheDir)
                ? path.join(cacheDir, modelId)
                : path.join(process.cwd(), cacheDir, modelId)
            const storage = createStorage({
                driver: fsDriver({ base: modelCacheDir }),
            })
            modelsCaches.set(modelId, storage)
            return storage
        }
        return cache
    }
    const cacheMiddleware: LanguageModelV2Middleware = {
        wrapGenerate: async ({ doGenerate, params,  model }) => {
            const storage = getModelCache(model.modelId)

            onParams?.(params)
            const cacheKey = hashKey(params)

            const cachedYaml = await storage.getItem(cacheKey) as string | null
            const cached = cachedYaml ? yaml.load(cachedYaml) as {
                params: any,
                result: Awaited<ReturnType<LanguageModelV2['doGenerate']>>
            } : null

            if (cached && cached.result) {
                // console.log(`using cache for ai request with model ${model.modelId}`)
                return {
                    ...cached.result,
                    response: {
                        ...cached.result.response,
                        timestamp: cached.result?.response?.timestamp
                            ? new Date(cached.result?.response?.timestamp)
                            : undefined,
                    },
                }
            }
            console.log(`skipping cache for ai request with model ${model.modelId}`)

            const result = await doGenerate()

            const yamlContent = yaml.dump({
                params,
                result,
            }, {
                indent: 2,
                lineWidth: 120,
                noRefs: true,
                sortKeys: false,
            })
            await storage.setItem(cacheKey, yamlContent)

            return result
        },

        wrapStream: async ({ doStream, model, params }) => {
            const cacheKey = hashKey(params)
            const storage = getModelCache(model.modelId)
            onParams?.(params)
            // Check if the result is in the cache
            const cachedYaml = await storage.getItem(cacheKey) as string | null
            const cached = cachedYaml ? yaml.load(cachedYaml) as {
                params: any,
                chunks: LanguageModelV2StreamPart[]
            } : null

            // If cached, return a simulated ReadableStream that yields the cached result
            if (cached && cached.chunks) {

                // Format the timestamps in the cached response
                const formattedChunks = cached.chunks.map((p) => {
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
            console.log(`skipping cache for ai request with model ${model.modelId}`)

            // If not cached, proceed with streaming
            const { stream, ...rest } = await doStream()

            const fullResponse: LanguageModelV2StreamPart[] = []

            const transformStream = new TransformStream<
                LanguageModelV2StreamPart,
                LanguageModelV2StreamPart
            >({
                transform(chunk, controller) {
                    fullResponse.push(chunk)
                    controller.enqueue(chunk)
                },

                async flush() {
                    // Store the full response in the cache after streaming is complete
                    const yamlContent = yaml.dump({
                        params,
                        chunks: fullResponse,
                    }, {
                        indent: 2,
                        lineWidth: 120,
                        noRefs: true,
                        sortKeys: false,
                    })
                    await storage.setItem(cacheKey, yamlContent)
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
