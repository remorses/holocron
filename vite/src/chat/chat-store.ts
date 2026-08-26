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

/** Shared layoutId prefix. Key per page via chatShellLayoutId so client nav cannot pair two widgets. */
export const CHAT_LAYOUT_ID = 'holocron-chat-container'

export function chatShellLayoutId(pageKey: string): string {
  return `${CHAT_LAYOUT_ID}:${pageKey || '/'}`
}

/** Drawer open spring. */
export const CHAT_LAYOUT_TRANSITION = {
  type: 'spring' as const,
  duration: 0.28,
  bounce: 0,
}

/** Drawer close spring. */
export const CHAT_LAYOUT_COLLAPSE = {
  type: 'spring' as const,
  duration: 0.22,
  bounce: 0,
}

/** Content fade-in after the shell is roughly panel-sized. */
export const CHAT_CONTENT_ENTER = {
  duration: 0.14,
  delay: 0.06,
  ease: [0.23, 1, 0.32, 1] as const,
}

export const CHAT_CONTENT_EXIT = {
  duration: 0.08,
  ease: [0.4, 0, 1, 1] as const,
}

/** Drawer messages stay visible until the shell is almost widget-sized. */
export const CHAT_DRAWER_CONTENT_EXIT = {
  duration: 0.08,
  delay: 0.14,
  ease: [0.4, 0, 1, 1] as const,
}
