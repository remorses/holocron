/**
 * Runtime tab provider tests. Covers frontmatter icon extraction so
 * request-time pages can use URL icons without the build-time atlas.
 */

import { describe, expect, test } from 'vitest'
import { mergeRuntimeNavigation, resolveRuntimeResult, type CustomTabProvider } from './runtime-provider.ts'
import type { RuntimeCache } from './runtime-cache.ts'
import type { ConfigNavTab } from '../config.ts'

function memoryCache(): RuntimeCache {
  const store = new Map<string, unknown>()
  return {
    async get(key) {
      return store.get(key)
    },
    async set(key, value) {
      store.set(key, value)
    },
    async delete(key) {
      store.delete(key)
    },
  }
}

describe('mergeRuntimeNavigation', () => {
  test('copies frontmatter URL icons onto merged page metadata', async () => {
    const provider: CustomTabProvider = {
      name: 'blog',
      static: false,
      async generate() {
        return {
          groups: [{ group: 'Posts', pages: ['blog/hello'] }],
          mdxContent: {
            'blog/hello': `---
title: Hello
icon: https://cdn.example.com/rocket.svg
iconColor: blue
---

# Hello
`,
          },
        }
      },
    }
    const tabs: ConfigNavTab[] = [
      { tab: 'Blog', groups: [], base: 'blog' },
    ]
    const result = await mergeRuntimeNavigation(
      tabs,
      new Map([['Blog', provider]]),
      memoryCache(),
    )

    expect(result.pageMeta['blog/hello']).toMatchInlineSnapshot(`
      {
        "icon": "https://cdn.example.com/rocket.svg",
        "iconColor": "blue",
        "title": "Hello",
      }
    `)
  })

  test('rebuilds pageMeta from cached mdx when the old cache lacks it', async () => {
    const cache = memoryCache()
    await cache.set(
      'runtime-provider:legacy-blog:Blog',
      {
        groups: [{ group: 'Posts', pages: ['blog/hello'] }],
        mdxContent: {
          'blog/hello': `---
title: Hello
icon: https://cdn.example.com/rocket.svg
---
`,
        },
        pageTitles: { 'blog/hello': 'Hello' },
      },
      60_000,
    )

    const result = await resolveRuntimeResult(
      {
        name: 'legacy-blog',
        static: false,
        async generate() {
          throw new Error('should not regenerate')
        },
      },
      { tab: 'Blog', base: 'blog' },
      cache,
    )

    expect(result.pageMeta['blog/hello']?.icon).toBe('https://cdn.example.com/rocket.svg')
    expect(result.pageMeta['blog/hello']?.title).toBe('Hello')
  })
})
