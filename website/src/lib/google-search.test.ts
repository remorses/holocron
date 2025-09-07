import { describe, test, expect } from 'vitest'
import { googleSearch } from './google-search'

describe('googleSearch', () => {
  test('returns search results from Google', async () => {
    const result = await googleSearch({
      query: 'vitest',
      limit: 5,
    })
    
    expect(result).toMatchInlineSnapshot(`
      {
        "items": [
          {
            "displayLink": "vitest.dev",
            "link": "https://vitest.dev/",
            "snippet": "A Vite-native testing framework. It's fast! Get Started Features Why Vitest? View on GitHub Vitest Vite Powered Reuse Vite's config and plugins.",
            "title": "Vitest | Next Generation testing framework",
          },
          {
            "displayLink": "github.com",
            "link": "https://github.com/vitest-dev/vitest",
            "snippet": "Next generation testing framework powered by Vite. Get involved! Documentation | Getting Started | Examples | Why Vitest?",
            "title": "vitest-dev/vitest: Next generation testing framework ... - GitHub",
          },
          {
            "displayLink": "vitest.dev",
            "link": "https://vitest.dev/guide/",
            "snippet": "May 5, 2025 ... You can try Vitest online on StackBlitz. It runs Vitest directly in the browser, and it is almost identical to the local setup but doesn't require installing ...",
            "title": "Getting Started | Guide | Vitest",
          },
          {
            "displayLink": "www.reddit.com",
            "link": "https://www.reddit.com/r/node/comments/1ioguv6/is_vitest_still_necessary_in_2025/",
            "snippet": "Feb 13, 2025 ... Vitest is functionally a superset of Jest's features, while being lighter weight and lower memory usage due to sharing the internals of Vite. If ...",
            "title": "Is Vitest still necessary in 2025? : r/node",
          },
          {
            "displayLink": "www.npmjs.com",
            "link": "https://www.npmjs.com/package/vitest",
            "snippet": "Jun 17, 2025 ... Next generation testing framework powered by Vite. Latest version: 3.2.4, last published: 3 months ago. Start using vitest in your project ...",
            "title": "vitest - npm",
          },
        ],
        "totalResults": "600000",
      }
    `)
  })
})