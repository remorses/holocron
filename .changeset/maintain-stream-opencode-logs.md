---
'@holocron.so/cli': patch
---

`holocron maintain` now streams what OpenCode does instead of only printing `Starting OpenCode...`. It subscribes to the OpenCode server event stream and prints task sessions, assistant messages, and every finished tool call with its duration. Failed tool calls (for example a denied `git push`) show the error inline. OpenCode server warnings and errors, such as provider rate limits, are printed too.

```
  ◆ task 1 Update index.mdx (@general subagent)
  [task 1] └ read cli/src/maintain.ts 34ms
  [task 1] └ edit website/src/pages/maintain/index.mdx 2ms
  ✗ bash git push origin main 3ms → The user has specified a rule which prevents you from using this specific tool call.
  opencode ERROR stream error providerID=holocron agent=general error.error=AI_APICallError: Rate limit exceeded.
```
