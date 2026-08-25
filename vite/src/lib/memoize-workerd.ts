/**
 * Cloudflare `#memoize` target. L1 is an isolate LRU. L2 is a named
 * Cache Storage (`caches.open`), not `caches.default`.
 *
 * Do not import `cloudflare:workers`. Dynamic Workers used by holocron.so
 * hosting stub `caches` and may not expose that module. Await `cache.put`
 * on the request instead of `waitUntil`.
 *
 * Cache API needs a custom domain. Keys use the request origin recorded
 * by `rememberCacheOrigin`. Never guess a hostname. `cache.put` succeeds
 * even when the entry is dropped, so a bad origin looks like a 100% miss.
 */

import {
  cloneCached,
  hashKey,
  LruCache,
  shouldCache,
  type MemoizeOptions,
} from './memoize-node.ts'

const CACHE_NAME = 'holocron-memoize'
const DEFAULT_TTL = 7 * 24 * 60 * 60
const DEFAULT_MAX = 64

let cacheOrigin: string | undefined

export function rememberCacheOrigin(requestUrl: string): void {
  if (cacheOrigin) return
  cacheOrigin = new URL(requestUrl).origin
}

export function resetCacheOrigin(): void {
  cacheOrigin = undefined
}

async function openMemoizeCache(): Promise<Cache | undefined> {
  try {
    if (typeof caches === 'undefined' || typeof caches.open !== 'function') return undefined
    return await caches.open(CACHE_NAME)
  } catch {
    return undefined
  }
}

function cacheRequest(cacheKey: string): Request | undefined {
  if (!cacheOrigin) return undefined
  return new Request(`${cacheOrigin}/__memoize/${cacheKey}`)
}

const REGEXP_TAG = '$hc:re'
const BIGINT_TAG = '$hc:bi'

function replacer(_key: string, value: string | number | boolean | object | null | bigint) {
  if (typeof value === 'bigint') return { [BIGINT_TAG]: value.toString() }
  if (value instanceof RegExp) return { [REGEXP_TAG]: [value.source, value.flags] }
  return value
}

function reviver(_key: string, value: string | number | boolean | object | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  if (REGEXP_TAG in value) {
    const regex = value[REGEXP_TAG]
    if (Array.isArray(regex) && typeof regex[0] === 'string' && typeof regex[1] === 'string') {
      return new RegExp(regex[0], regex[1])
    }
  }
  if (BIGINT_TAG in value && typeof value[BIGINT_TAG] === 'string') {
    return BigInt(value[BIGINT_TAG])
  }
  return value
}

export function memoize<Args extends unknown[], T>(
  options: MemoizeOptions<Args, T>,
): (...args: Args) => Promise<T> {
  const { namespace, fn, key, ttl = DEFAULT_TTL, max = DEFAULT_MAX } = options
  const lru = new LruCache<T>(max)

  return async (...args: Args): Promise<T> => {
    const material = key ? key(...args) : JSON.stringify(args)
    const cacheKey = await hashKey(namespace, material)

    const memoryHit = lru.get(cacheKey)
    if (memoryHit !== undefined) return cloneCached(memoryHit)

    const cache = await openMemoizeCache()
    const req = cacheRequest(cacheKey)
    if (cache && req) {
      try {
        const hit = await cache.match(req)
        if (hit) {
          const cached = (JSON.parse(await hit.text(), reviver) as { value: T }).value
          if (shouldCache(cached)) {
            lru.set(cacheKey, cached)
            return cloneCached(cached)
          }
        }
      } catch {}
    }

    const value = await fn(...args)
    if (shouldCache(value)) {
      lru.set(cacheKey, value)
      if (cache && req) {
        try {
          await cache.put(req, new Response(JSON.stringify({ value }, replacer), {
            headers: {
              'content-type': 'application/json',
              'cache-control': `s-maxage=${ttl}`,
            },
          }))
        } catch {}
      }
      return cloneCached(value)
    }
    return value
  }
}
