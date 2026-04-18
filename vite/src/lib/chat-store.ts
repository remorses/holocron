/**
 * Chat store — vanilla zustand state shared by the chat drawer, sidebar
 * widget, and mobile nav without depending on React hooks.
 */

import type { ReactNode } from 'react'
import { createStore } from 'zustand'

export type DrawerState = 'closed' | 'open'

/** Part received from the federation stream.
 *  Text parts carry server-rendered JSX. Tool parts carry plain data —
 *  the client renders them with animated indicators. */
export type ChatPart =
  | { type: 'user-message'; text: string }
  | { type: 'text'; jsx: ReactNode; text: string }
  | {
      type: 'tool-call'
      toolCallId: string
      toolName: string
      args: Record<string, unknown>
    }
  | {
      type: 'tool-result'
      toolCallId: string
      toolName: string
      output: string
      error?: string
    }
  | {
      /** Opaque session snapshot — raw AI SDK messages for conversation
       *  continuity. Yielded after each completed piece (text, tool result).
       *  Client stores the latest and sends it back on next submit. */
      type: 'session'
      messages: unknown[]
    }

export type ChatState = {
  drawerState: DrawerState
  navDrawerOpen: boolean
  isGenerating: boolean
  parts: ChatPart[]
  /** Shared textarea value — single source of truth for both sidebar widget and drawer input. */
  draftText: string
  /** When true, the drawer auto-submits draftText on open (user pressed Enter in sidebar). */
  pendingSubmit: boolean
  abortController: AbortController | null
  errorMessage: string | null
}

export const chatStore = createStore<ChatState>(() => ({
  drawerState: 'closed',
  navDrawerOpen: false,
  isGenerating: false,
  parts: [],
  draftText: '',
  pendingSubmit: false,
  abortController: null,
  errorMessage: null,
}))
