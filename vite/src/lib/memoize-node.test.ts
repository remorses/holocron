/**
 * Node LRU memoize tests. Covers hit/miss, error skip, eviction,
 * and clone-on-read so cached mdast is not mutated by render.
 */

import { describe, expect, test } from 'vitest'
import { mdxParse } from 'safe-mdx/parse'
import { memoize } from './memoize-node.ts'

describe('memoize node LRU', () => {
  test('same markdown twice does not rerun the function', async () => {
    let calls = 0
    const parse = memoize({
      namespace: 'mdx-parse',
      key: (markdown: string) => markdown,
      fn: (markdown: string) => {
        calls += 1
        return mdxParse(markdown)
      },
    })

    const first = await parse('# Hello')
    const second = await parse('# Hello')

    expect(calls).toBe(1)
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
  })

  test('different markdown is a miss', async () => {
    let calls = 0
    const parse = memoize({
      namespace: 'mdx-parse',
      key: (markdown: string) => markdown,
      fn: (markdown: string) => {
        calls += 1
        return mdxParse(markdown)
      },
    })

    await parse('# One')
    await parse('# Two')

    expect(calls).toBe(2)
  })

  test('thrown parse errors are not stored', async () => {
    let calls = 0
    const parse = memoize({
      namespace: 'mdx-parse',
      key: (markdown: string) => markdown,
      fn: (markdown: string) => {
        calls += 1
        return mdxParse(markdown)
      },
    })

    const bad = '<Note>unclosed'
    await expect(parse(bad)).rejects.toThrow()
    await expect(parse(bad)).rejects.toThrow()
    expect(calls).toBe(2)
  })

  test('returned Error values are not stored', async () => {
    let calls = 0
    const parse = memoize({
      namespace: 'mdx-parse',
      fn: async () => {
        calls += 1
        return new Error('nope')
      },
    })

    expect(await parse()).toBeInstanceOf(Error)
    expect(await parse()).toBeInstanceOf(Error)
    expect(calls).toBe(2)
  })

  test('namespaces do not collide', async () => {
    let aCalls = 0
    let bCalls = 0
    const a = memoize({
      namespace: 'a',
      fn: async (value: string) => {
        aCalls += 1
        return `a:${value}`
      },
    })
    const b = memoize({
      namespace: 'b',
      fn: async (value: string) => {
        bCalls += 1
        return `b:${value}`
      },
    })

    expect(await a('x')).toBe('a:x')
    expect(await b('x')).toBe('b:x')
    expect(aCalls).toBe(1)
    expect(bCalls).toBe(1)
  })

  test('LRU evicts the oldest entry', async () => {
    let calls = 0
    const parse = memoize({
      namespace: 'mdx-parse',
      max: 2,
      key: (markdown: string) => markdown,
      fn: (markdown: string) => {
        calls += 1
        return markdown
      },
    })

    await parse('one')
    await parse('two')
    await parse('three')
    await parse('one')

    expect(calls).toBe(4)
  })

  test('clone-on-read keeps the cached tree clean', async () => {
    let calls = 0
    const parse = memoize({
      namespace: 'mdx-parse',
      key: (markdown: string) => markdown,
      fn: (markdown: string) => {
        calls += 1
        return { type: 'root', children: [{ type: 'text', value: markdown }] }
      },
    })

    const first = await parse('hi')
    first.children.push({ type: 'text', value: 'mutated' })
    const second = await parse('hi')

    expect(calls).toBe(1)
    expect(second.children).toEqual([{ type: 'text', value: 'hi' }])
  })
})
