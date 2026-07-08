---
'@holocron.so/vite': patch
---

Human readable tool call labels in the AI chat. Every tool input schema now carries a `description` field the model fills with a short summary of the action (e.g. "Searching docs for navigation config"). The chat UI shows that description as the tool call label, with the actual command or selector in a dimmer `⎿` detail line underneath. Tools without a description fall back to a `toolName(primary-arg)` title instead of dumping raw JSON arguments.

`defineTool` automatically injects the `description` property into the generated JSON schema (unless the tool already defines one) and marks it required, so user-defined client tools get readable labels for free. The server-side `bash` docs tool and `browser_navigate` gained the same field.

Also fixes a stream ordering bug where assistant text announcing a tool call ("I'll get the current time for you") rendered BELOW the tool call instead of above it — the pending text buffer is now flushed before any tool part is emitted.
