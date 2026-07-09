/**
 * Client component that registers a `get_time` tool with the chat widget
 * for e2e testing of client-side tool execution. Imported in index.mdx.
 *
 * The tool is registered via chatWidgetStore on mount and cleaned up on
 * unmount. The mock chat server forwards tool schemas to the model, which
 * can then call `get_time` and receive the browser's current time.
 */

'use client'

import { useEffect } from 'react'
// Use the src/* export for internal modules not in the public API
import { chatWidgetStore } from '@holocron.so/vite/src/chat/chat-widget-store.ts'
import { defineTool } from '@holocron.so/vite/chat'
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
    const prev = chatWidgetStore.getState().tools
    chatWidgetStore.setState({ tools: [...prev, getTimeTool] })
    return () => {
      chatWidgetStore.setState({
        tools: chatWidgetStore.getState().tools.filter((t) => t.name !== 'get_time'),
      })
    }
  }, [])
  return null
}
