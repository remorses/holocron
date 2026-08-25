/**
 * In-memory LRU memoize. Vitest aliases `#memoize` here.
 * Workerd reuses the helpers for its isolate-local L1 cache.
 *
 * Bump CACHE_VERSION when the stored value shape or parser output changes.
 */

const CACHE_VERSION = 'v2'
const DEFAULT_MAX = 64

export interface MemoizeOptions<Args extends unknown[], T> {
  namespace: string
  fn: (...args: Args) => T | Promise<T>
  /** Raw key material. Hashed. Default is JSON.stringify(args). */
  key?: (...args: Args) => string
  /** Cache API fresh window in seconds. Ignored by the Node LRU. */
  ttl?: number
  /** Max LRU entries. Default 64. */
  max?: number
}

export function shouldCache<T>(value: T): boolean {
  if (value == null) return false
  if (value instanceof Error) return false
  return true
}

export async function hashKey(namespace: string, material: string): Promise<string> {
  const encoded = new TextEncoder().encode(material)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return `${namespace}/${CACHE_VERSION}/${hex}`
}

export class LruCache<T> {
  #map = new Map<string, T>()

  constructor(private max: number) {}

  get(key: string): T | undefined {
    if (!this.#map.has(key)) return undefined
    const value = this.#map.get(key)!
    this.#map.delete(key)
    this.#map.set(key, value)
    return value
  }

  set(key: string, value: T): void {
    if (this.#map.has(key)) this.#map.delete(key)
    this.#map.set(key, value)
    if (this.#map.size > this.max) {
      const oldest = this.#map.keys().next().value
      if (oldest !== undefined) this.#map.delete(oldest)
    }
  }
}

export function cloneCached<T>(value: T): T {
  if (typeof value !== 'object' || value === null) return value
  try {
    return structuredClone(value)
  } catch {
    return value
  }
}

export function rememberCacheOrigin(_requestUrl: string): void {}

export function memoize<Args extends unknown[], T>(
  options: MemoizeOptions<Args, T>,
): (...args: Args) => Promise<T> {
  const { namespace, fn, key, max = DEFAULT_MAX } = options
  const lru = new LruCache<T>(max)

  return async (...args: Args): Promise<T> => {
    const material = key ? key(...args) : JSON.stringify(args)
    const cacheKey = await hashKey(namespace, material)
    const hit = lru.get(cacheKey)
    if (hit !== undefined) return cloneCached(hit)

    const value = await fn(...args)
    if (shouldCache(value)) {
      lru.set(cacheKey, value)
      return cloneCached(value)
    }
    return value
  }
}
