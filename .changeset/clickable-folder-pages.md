---
'@holocron.so/vite': patch
---

Make navigation groups with a `root` page behave as clickable folders.

The folder label opens its root page, while a separate chevron expands and collapses its children. Root pages now participate in search, previous/next navigation, sitemap and LLM output, internal-link validation, version ownership, and hidden-page filtering like normal navigation pages.

```json
{
  "group": "Guides",
  "root": "guides/index",
  "pages": ["guides/setup", "guides/deploy"]
}
```
