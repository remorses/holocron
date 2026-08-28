---
'@holocron.so/vite': minor
---

Add a `compact` page mode that keeps the left navigation, removes the optional right aside, and narrows the full page frame without changing the reading column width.

Set it for the full site in `docs.json`:

```json
{
  "layout": {
    "mode": "compact"
  }
}
```

Or set it for one page with `mode: "compact"` in frontmatter. Pages with authored asides, table-of-contents panels, or generated API examples keep their required right rail automatically.
