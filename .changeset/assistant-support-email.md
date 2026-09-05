---
'@holocron.so/vite': minor
---

Add `assistant.supportEmail` in `docs.json` so the AI chat can send people to a human.

```json
{
  "assistant": {
    "supportEmail": "support@example.com"
  }
}
```

When this is set, the assistant system prompt tells the model to share that address if the user wants to talk to a human, or if the docs cannot answer the question.
