'use client'

/**
 * Chat store — vanilla zustand state shared by the chat drawer, sidebar
 * widget, and mobile nav without depending on React hooks.
 *
 * Marked 'use client' so client-only chat UI can import this module safely.
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
  /** Model reasoning (thinking) — rendered as a collapsed muted preview.
   *  Kept as a part so a turn whose answer lands entirely in reasoning is
   *  still visible instead of rendering an empty bubble. */
  | { type: 'reasoning'; text: string }
  | {
      type: 'notice'
      code: string
      title: string
      message: string
      command?: string
      cta?: { label: string; href: string }
      ownerNote?: { text: string; linkLabel: string; href: string }
      /** Visual weight only. `promotion` uses the site's primary color. */
      severity?: 'info' | 'error' | 'promotion'
      /** Repetition policy, independent of severity. `once` is for standing
       *  content re-sent on every turn (such as the Holocron promotion) and is
       *  de-duplicated by code across the conversation. `always` (default)
       *  is for per-turn outcomes — rate limits, credit limits, errors —
       *  which must render every time or the turn looks like it hung. */
      display?: 'once' | 'always'
    }
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

/**
 * Shared Motion layoutId for the pill/sidebar trigger ↔ drawer morph.
 * Works inside shadow DOM (unlike CSS view-transition-name).
 */
export const CHAT_LAYOUT_ID = 'holocron-chat-container'

/** Default spring used for the chat shell morph. */
export const CHAT_LAYOUT_TRANSITION = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 36,
  mass: 0.8,
}
