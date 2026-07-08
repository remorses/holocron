---
'@holocron.so/vite': minor
---

Adopt WebMCP `document.modelContext` for chat tool registration.

Custom tools defined via `defineTool()` are now auto-registered on `document.modelContext`,
the emerging browser standard for AI agent tool discovery (Chrome 150+). On browsers without
native support, a minimal polyfill is installed so everything keeps working.

```ts
import { defineTool } from '@holocron.so/vite/chat'
import { z } from 'zod'

// Auto-registered on document.modelContext — browser AI agents can discover it
const timeTool = defineTool({
  name: 'get_time',
  description: 'Get the current time',
  input: z.object({}),
  async run() {
    return { time: new Date().toISOString() }
  },
})

// Remove when no longer needed
unregisterTool('get_time')
```

Third-party tools already registered on the native `document.modelContext` by other code on the
page are automatically discovered and available in the AI chat at submit time.

New exports from `@holocron.so/vite/chat`:

- `unregisterTool(name)` — remove a tool from both registries
- `getRegisteredTools()` — list all custom tools
- `registerToolOnModelContext(tool)` — manual registration without Zod
- `getNativeModelContextTools()` — discover third-party WebMCP tools

Browser automation tools from `pageTools()` are intentionally not exposed on `document.modelContext`
(`exposeToModelContext: false`) so external agents cannot access internal navigation/form tools.
