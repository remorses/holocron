'use client'

/**
 * Chat store — vanilla zustand state shared by the chat drawer, sidebar
 * widget, and mobile nav without depending on React hooks.
 *
 * Marked 'use client' because withViewTransition imports flushSync from
 * react-dom which is not available in the RSC server environment.
 */

import { createStore } from 'zustand'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'

export type DrawerState = 'closed' | 'open'

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
  isGenerating: boolean
  messages: ChatMessage[]
  /** Flue agent instance ID for session continuity. Generated per-visitor. */
  sessionId: string
  /** Last Flue stream offset for reconnection after page close. */
  streamOffset: string
  /** Shared textarea value — single source of truth for both sidebar widget and drawer input. */
  draftText: string
  /** When true, the drawer auto-submits draftText on open (user pressed Enter in sidebar). */
  pendingSubmit: boolean
  abortController: AbortController | null
  errorMessage: string | null
}

export const chatStore = createStore<ChatState>(() => ({
  drawerState: 'closed',
  isGenerating: false,
  messages: [],
  sessionId: '',
  streamOffset: '',
  draftText: '',
  pendingSubmit: false,
  abortController: null,
  errorMessage: null,
}))

/** VT name shared between sidebar widget (closed) and drawer panel (open). */
export const CHAT_CONTAINER_VT_NAME = 'holocron-chat-container'

/**
 * Wrap a DOM mutation in a view transition. `prepare` runs before the old
 * snapshot is captured (e.g. hide children so snapshot is a solid rectangle).
 */
export function withViewTransition(
  fn: () => void,
  prepare?: () => (() => void) | void,
): void {
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    const cleanup = prepare?.()
    const vt = (document as any).startViewTransition(() => {
      flushSync(fn)
      cleanup?.()
    })
    // Safety: also restore on transition skip/error
    vt.finished?.catch?.(() => cleanup?.())
  } else {
    fn()
  }
}
