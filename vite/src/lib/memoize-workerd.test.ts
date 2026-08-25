/**
 * Cloudflare memoize tests. Uses an in-process Cache Storage stand-in
 * so the workerd file can run in Node vitest without cloudflare:workers.
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { mdxParse } from 'safe-mdx/parse'
import { memoize, rememberCacheOrigin, resetCacheOrigin } from './memoize-workerd.ts'

function findEstreeLiteral(node: unknown, pred: (value: unknown) => boolean): unknown {
  if (!node || typeof node !== 'object') return undefined
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findEstreeLiteral(item, pred)
      if (found !== undefined) return found
    }
    return undefined
  }
  const rec = node as Record<string, unknown>
  if (rec.type === 'Literal' && pred(rec.value)) return rec.value
  for (const value of Object.values(rec)) {
    const found = findEstreeLiteral(value, pred)
    if (found !== undefined) return found
  }
  return undefined
}

type CacheStore = Map<string, Response>

function installMemoryCaches() {
  const named = new Map<string, CacheStore>()
  const cachesApi = {
    async open(name: string) {
      let store = named.get(name)
      if (!store) {
        store = new Map()
        named.set(name, store)
      }
      return {
        async match(request: Request) {
          return store.get(new URL(request.url).href)
        },
        async put(request: Request, response: Response) {
          store.set(new URL(request.url).href, response)
        },
        async delete(request: Request) {
          return store.delete(new URL(request.url).href)
        },
      }
    },
  }
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    writable: true,
    value: cachesApi,
  })
}

beforeEach(() => {
  installMemoryCaches()
})

afterEach(() => {
  resetCacheOrigin()
  Reflect.deleteProperty(globalThis, 'caches')
})

describe('memoize workerd Cache API', () => {
  test('second instance hits Cache API without rerunning fn', async () => {
    rememberCacheOrigin('https://docs.example.com/page')

    let calls = 0
    const fn = async (markdown: string) => {
      calls += 1
      return { markdown }
    }
    const first = memoize({
      namespace: 'mdx-parse',
      key: (markdown: string) => markdown,
      fn,
    })
    const second = memoize({
      namespace: 'mdx-parse',
      key: (markdown: string) => markdown,
      fn,
    })

    expect(await first('# Hello')).toEqual({ markdown: '# Hello' })
    expect(await second('# Hello')).toEqual({ markdown: '# Hello' })
    expect(calls).toBe(1)
  })

  test('different markdown is a miss', async () => {
    rememberCacheOrigin('https://docs.example.com/page')

    let calls = 0
    const parse = memoize({
      namespace: 'mdx-parse',
      key: (markdown: string) => markdown,
      fn: async (markdown: string) => {
        calls += 1
        return { markdown }
      },
    })

    await parse('# One')
    await parse('# Two')
    expect(calls).toBe(2)
  })

  test('thrown errors are not stored in Cache API', async () => {
    rememberCacheOrigin('https://docs.example.com/page')

    let calls = 0
    const fn = async () => {
      calls += 1
      throw new Error('parse failed')
    }
    const first = memoize({ namespace: 'mdx-parse', fn })
    const second = memoize({ namespace: 'mdx-parse', fn })

    await expect(first()).rejects.toThrow('parse failed')
    await expect(second()).rejects.toThrow('parse failed')
    expect(calls).toBe(2)
  })

  test('skips Cache API when origin is unknown and still uses memory', async () => {
    let calls = 0
    const fn = async (value: string) => {
      calls += 1
      return value
    }
    const first = memoize({ namespace: 'mdx-parse-no-origin', fn })
    const second = memoize({ namespace: 'mdx-parse-no-origin', fn })

    expect(await first('a')).toBe('a')
    expect(await first('a')).toBe('a')
    expect(await second('a')).toBe('a')
    expect(calls).toBe(2)
  })

  test('Cache API keeps RegExp literals from mdxParse', async () => {
    rememberCacheOrigin('https://docs.example.com/page')
    let calls = 0
    const fn = (markdown: string) => {
      calls += 1
      return mdxParse(markdown)
    }
    const first = memoize({ namespace: 'mdx-parse-re', key: (md: string) => md, fn })
    const second = memoize({ namespace: 'mdx-parse-re', key: (md: string) => md, fn })
    const source = '{/abc/i.test("ABC")}'

    const regexLiteral = findEstreeLiteral(await first(source), (value) => value instanceof RegExp)
    const cachedLiteral = findEstreeLiteral(await second(source), (value) => value instanceof RegExp)

    expect(regexLiteral).toBeInstanceOf(RegExp)
    expect(cachedLiteral).toBeInstanceOf(RegExp)
    expect((cachedLiteral as RegExp).source).toBe('abc')
    expect((cachedLiteral as RegExp).flags).toBe('i')
    expect(calls).toBe(1)
  })

  test('Cache API keeps bigint literals from mdxParse', async () => {
    rememberCacheOrigin('https://docs.example.com/page')
    let calls = 0
    const fn = (markdown: string) => {
      calls += 1
      return mdxParse(markdown)
    }
    const first = memoize({ namespace: 'mdx-parse-bi', key: (md: string) => md, fn })
    const second = memoize({ namespace: 'mdx-parse-bi', key: (md: string) => md, fn })
    const source = '{123n}'

    expect(findEstreeLiteral(await first(source), (value) => typeof value === 'bigint')).toBe(123n)
    expect(findEstreeLiteral(await second(source), (value) => typeof value === 'bigint')).toBe(123n)
    expect(calls).toBe(1)
  })
})
