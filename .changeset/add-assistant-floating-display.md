---
'@holocron.so/vite': minor
---

Add `assistant.display` in `docs.json` so the built-in AI chat can use the same floating bottom pill as the embeddable ChatWidget.

```json
{
  "assistant": {
    "display": "floating"
  }
}
```

`sidebar` (default) keeps the Ask AI widget in the right aside. `floating` hides that sidebar widget and shows the bottom-center textarea pill that morphs into the chat drawer.

Use `floating` with `layout.mode: "compact"`. Compact removes the right aside, so the default sidebar assistant is hidden unless you set `display` to `floating`.
