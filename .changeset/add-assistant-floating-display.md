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
