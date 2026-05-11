// Memoize async functions via Cloudflare Cache API (caches.default).
// Cache keys include the spiceflow deployment ID so stale entries from old
// builds are never served. Supports stale-while-revalidate: within the SWR
// window, stale values return immediately while a background refresh runs
// via waitUntil().
//
// null, undefined, and Error results are NEVER cached. This prevents caching
// "not found" or "unauthorized" responses that would lock users out until
// the TTL expires. Memoized functions that indicate absence or failure MUST
// return null/undefined or throw.
//
// Requires a custom domain; does NOT work on *.workers.dev.

import { waitUntil } from 'cloudflare:workers'
import { getDeploymentId } from 'spiceflow'

const CACHE_BASE = 'https://0.0.0.0/'

interface CacheEnvelope<T> {
  value: T
  createdAt: number
}

export interface MemoizeOptions<Args extends unknown[], T> {
  namespace: string
  fn: (...args: Args) => Promise<T>
  /** Fresh window in seconds. Default: 300 (5 min) */
  ttl?: number
  /** Stale-while-revalidate window in seconds. Default: 600 (10 min) */
  swr?: number
}

function shouldCache<T>(value: T): boolean {
  if (value == null) return false
  if (value instanceof Error) return false
  return true
}

export function memoize<Args extends unknown[], T>(
  options: MemoizeOptions<Args, T>,
): (...args: Args) => Promise<T> {
  const { namespace, fn, ttl = 300, swr = 600 } = options

  return async (...args: Args): Promise<T> => {
    const cache = (caches as any).default as Cache
    const key = await buildCacheKey(namespace, args)
    const req = new Request(key)

    // Gracefully degrade to uncached D1 if Cache API is unavailable
    // (e.g. *.workers.dev, local dev, playground). Never turn a working
    // request into a 500 just because caching failed.
    let hit: Response | undefined
    try {
      hit = await cache.match(req)
    } catch {
      return fn(...args)
    }

    if (hit) {
      const envelope = JSON.parse(await hit.text()) as CacheEnvelope<T>
      const age = (Date.now() - envelope.createdAt) / 1000

      if (age < ttl) {
        return envelope.value
      }

      if (swr > 0 && age < ttl + swr) {
        waitUntil(refreshCache(cache, req, fn, args, ttl + swr))
        return envelope.value
      }
    }

    const value = await fn(...args)
    if (shouldCache(value)) {
      waitUntil(putCache(cache, req, value, ttl + swr))
    }
    return value
  }
}

async function refreshCache<Args extends unknown[], T>(
  cache: Cache,
  req: Request,
  fn: (...args: Args) => Promise<T>,
  args: Args,
  maxAge: number,
): Promise<void> {
  try {
    const value = await fn(...args)
    if (shouldCache(value)) {
      await putCache(cache, req, value, maxAge)
    } else {
      await cache.delete(req).catch(() => {})
    }
  } catch {
    // Background refresh failed; stale entry stays until it expires naturally
  }
}

async function putCache<T>(
  cache: Cache,
  req: Request,
  value: T,
  maxAge: number,
): Promise<void> {
  const envelope: CacheEnvelope<T> = { value, createdAt: Date.now() }
  const response = new Response(JSON.stringify(envelope), {
    headers: {
      'content-type': 'application/json',
      'cache-control': `s-maxage=${maxAge}`,
    },
  })
  await cache.put(req, response).catch(() => {})
}

export async function invalidate(namespace: string, ...args: unknown[]): Promise<boolean> {
  const cache = (caches as any).default as Cache
  const key = await buildCacheKey(namespace, args)
  return cache.delete(new Request(key))
}

async function buildCacheKey(namespace: string, args: unknown[]): Promise<string> {
  const id = await getDeploymentId()
  const prefix = id ? `${CACHE_BASE}${id}/` : CACHE_BASE
  const serialized = JSON.stringify(args)
  const hash = await sha256(serialized)
  return `${prefix}${namespace}/${hash}`
}

async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
