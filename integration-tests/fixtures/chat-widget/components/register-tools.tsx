/**
 * Client component that registers a `get_time` tool with the chat widget
 * for e2e testing of client-side tool execution. Imported in index.mdx.
 *
 * defineTool() auto-registers on document.modelContext (the WebMCP standard),
 * so the tool is discoverable by the chat widget and any browser AI agent.
 * Cleanup on unmount via unregisterTool().
 */

'use client'

import { useEffect } from 'react'
import { defineTool, unregisterTool } from '@holocron.so/vite/chat'
import { z } from 'zod'

const getTimeTool = defineTool({
  name: 'get_time',
  description: 'Get the current date and time from the browser',
  input: z.object({}),
  async run() {
    // Fixed timestamp so the follow-up model request (which includes this
    // tool result) hashes identically across runs — keeps the .aicache
    // deterministic instead of missing on every run.
    return { time: '2026-01-01T12:00:00.000Z', timezone: 'UTC' }
  },
})

export function RegisterTools() {
  useEffect(() => {
    return () => {
      unregisterTool('get_time')
    }
  }, [])
  return null
}
