/**
 * Runtime cache for server-side providers that fetch content at request time.
 *
 * Auto-detects the environment:
 * - Cloudflare Workers (Cache API available): uses the Cache API with TTL
 *   via Cache-Control headers. Survives across isolate resets.
 * - Node.js / Bun (no Cache API): in-memory Map with TTL expiry. Lives
 *   for the lifetime of the process.
 *
 * A single module handles both environments so there's no need for
 * package.json imports conditions or separate build targets.
 */

export interface RuntimeCache {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, ttlMs: number): Promise<void>
  delete(key: string): Promise<void>
}

// ── In-memory implementation ─────────────────────────────────────────

type MemEntry = { value: unknown; expiresAt: number }
const memStore = new Map<string, MemEntry>()

const memoryCache: RuntimeCache = {
  async get<T>(key: string): Promise<T | undefined> {
    const entry = memStore.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      memStore.delete(key)
      return undefined
    }
    return entry.value as T
  },

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    memStore.set(key, { value, expiresAt: Date.now() + ttlMs })
  },

  async delete(key: string): Promise<void> {
    memStore.delete(key)
  },
}

// ── Cache API implementation (Cloudflare Workers) ────────────────────

const CF_CACHE_NAME = 'holocron-runtime-provider'

const cfCache: RuntimeCache = {
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const cache = await caches.open(CF_CACHE_NAME)
      const cacheKey = new Request(`https://holocron-cache/${encodeURIComponent(key)}`)
      const response = await cache.match(cacheKey)
      if (!response) return undefined
      return (await response.json()) as T
    } catch {
      return undefined
    }
  },

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    try {
      const cache = await caches.open(CF_CACHE_NAME)
      const cacheKey = new Request(`https://holocron-cache/${encodeURIComponent(key)}`)
      const ttlSeconds = Math.max(1, Math.round(ttlMs / 1000))
      const response = new Response(JSON.stringify(value), {
        headers: {
          'content-type': 'application/json',
          'cache-control': `s-maxage=${ttlSeconds}`,
        },
      })
      await cache.put(cacheKey, response)
    } catch {
      // Cache API unavailable or errored; skip silently
    }
  },

  async delete(key: string): Promise<void> {
    try {
      const cache = await caches.open(CF_CACHE_NAME)
      const cacheKey = new Request(`https://holocron-cache/${encodeURIComponent(key)}`)
      await cache.delete(cacheKey)
    } catch {
      // ignore
    }
  },
}

// ── Auto-detect and export ───────────────────────────────────────────

function hasCacheApi(): boolean {
  try {
    return typeof caches !== 'undefined' && typeof caches.open === 'function'
  } catch {
    return false
  }
}

/** The runtime cache instance. Uses Cache API on Cloudflare Workers,
 *  falls back to in-memory Map on Node.js / Bun. */
export const runtimeCache: RuntimeCache = hasCacheApi() ? cfCache : memoryCache
