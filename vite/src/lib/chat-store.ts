/**
 * Chat store — vanilla zustand state shared by the chat drawer, sidebar
 * widget, and mobile nav without depending on React hooks.
 */

import { createStore } from 'zustand'
import type { ReactNode } from 'react'

export type DrawerState = 'closed' | 'open'

/** Opaque AI SDK ModelMessage JSON. Holocron keeps this separate from the
 *  custom render messages so tool history can be resumed without lossy
 *  conversion through UI-only parts. */
export type ChatModelMessage = Record<string, unknown>

/** Superset of AI SDK message parts used by the drawer.
 *  Text parts can carry server-rendered JSX for display, while the plain
 *  `text` field remains serializable and is sent back in future requests. */
export type ChatPart =
  | { type: 'text'; text: string; jsx?: ReactNode }
  | { type: 'notice'; code: string; title: string; message: string; command?: string }
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

export type ChatMessage = {
  role: 'user' | 'assistant'
  parts: ChatPart[]
}

export type ChatState = {
  drawerState: DrawerState
  navDrawerOpen: boolean
  isGenerating: boolean
  messages: ChatMessage[]
  /** AI SDK ModelMessage history sent back verbatim on the next request. */
  modelMessages: ChatModelMessage[]
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
  messages: [],
  modelMessages: [],
  draftText: '',
  pendingSubmit: false,
  abortController: null,
  errorMessage: null,
}))
