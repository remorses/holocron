---
'@holocron.so/vite': minor
---

**Compact sites use one frame for every page, so navigating never shifts the layout.** Before, `mode: center` and `mode: default` replaced the site-wide `compact`, so blog posts, changelogs and opt-out pages jumped to the wide 1200px frame.

Now `layout.mode: "compact"` puts every page in the narrow frame (930px by default). The frame holds two columns, and the page mode picks which:

```diagram
  ┌──────────┬──────────────────────┐     ┌──────────────────────┬──────────┐
  │ sidebar  │ content              │     │ content              │ aside    │
  └──────────┴──────────────────────┘     └──────────────────────┴──────────┘
  compact, default, wide, frame           center (blog posts, changelog tabs)
```

- **`center`** pages keep the right aside and the Ask AI widget, inside the narrow frame.
- **`default`**, `wide` and `frame` behave like `compact` on a compact site. Three columns do not fit in 930px, so their asides render inline.
- The content column is 660px in both shapes.
- OpenAPI and MCP tabs keep the wide frame for request examples. `custom` pages are unchanged.

```json
{ "layout": { "mode": "compact" } }
```

The compact sidebar font size now keys on a new `data-compact` attribute on `.slot-page`, so it applies to every page in the compact frame.
