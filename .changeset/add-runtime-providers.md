---
'@holocron.so/vite': minor
---

Add runtime provider system for custom tab content.

Tabs in `docs.json` can now reference a provider file that generates navigation groups and MDX pages at request time. The provider result is cached with configurable TTL and promise coalescing prevents thundering herd on concurrent requests.

```json
{
  "tab": "Blog",
  "provider": "./providers/blog.ts",
  "base": "blog"
}
```

The provider file default-exports a `CustomTabProvider` object:

```ts
import type { CustomTabProvider } from '@holocron.so/vite'

const provider: CustomTabProvider = {
  name: 'my-blog',
  static: false,
  ttlMs: 60_000,

  async generate({ tab }) {
    const articles = await fetchArticles()
    return {
      groups: [{ group: 'Posts', pages: articles.map(a => `blog/${a.slug}`) }],
      mdxContent: Object.fromEntries(
        articles.map(a => [`blog/${a.slug}`, `---\ntitle: "${a.title}"\n---\n\n${a.body}`])
      ),
    }
  },
}

export default provider
```

Sidebar titles are extracted from MDX frontmatter so runtime pages show real article titles instead of slug-derived fallbacks.

Set `static: true` on the tab to run the provider at build time instead (same pipeline as OpenAPI/changelog providers).
