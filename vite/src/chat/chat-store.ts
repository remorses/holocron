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
  | {
      type: 'tool-approval-request'
      toolCallId: string
      toolName: string
      /** Human readable description of the action (model-provided `description`
       *  input field when available, otherwise stringified args). */
      description: string
      /** Optional custom confirmation message (e.g. from the
       *  data-holocron-requires-approval attribute value). */
      message?: string
      state: 'pending' | 'approved' | 'denied'
    }

export type ChatMessage = {
  role: 'user' | 'assistant'
  parts: ChatPart[]
}

export type ChatState = {
  drawerState: DrawerState
  isGenerating: boolean
  messages: ChatMessage[]
  /** AI SDK ModelMessage history sent back verbatim on the next request. */
  modelMessages: ChatModelMessage[]
  /** Shared textarea value — single source of truth for both sidebar widget and drawer input. */
  draftText: string
  /** When true, the drawer auto-submits draftText on open (user pressed Enter in sidebar). */
  pendingSubmit: boolean
  abortController: AbortController | null
  errorMessage: null | string
  /** Resolvers for pending tool approval prompts, keyed by toolCallId. */
  approvalResolvers: Record<string, (approved: boolean) => void>
}

export const chatStore = createStore<ChatState>(() => ({
  drawerState: 'closed',
  isGenerating: false,
  messages: [],
  modelMessages: [],
  draftText: '',
  pendingSubmit: false,
  abortController: null,
  errorMessage: null,
  approvalResolvers: {},
}))

/** Resolve a pending tool approval: flips the approval part's state in the
 *  message list and resumes the awaiting submitChat loop. */
export function respondToApproval(toolCallId: string, approved: boolean): void {
  const { approvalResolvers, messages } = chatStore.getState()
  const resolve = approvalResolvers[toolCallId]
  const { [toolCallId]: _removed, ...rest } = approvalResolvers
  chatStore.setState({
    approvalResolvers: rest,
    messages: messages.map((m) => ({
      ...m,
      parts: m.parts.map((p) =>
        p.type === 'tool-approval-request' && p.toolCallId === toolCallId && p.state === 'pending'
          ? { ...p, state: approved ? 'approved' : 'denied' }
          : p,
      ),
    })),
  })
  resolve?.(approved)
}

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
  if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
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
