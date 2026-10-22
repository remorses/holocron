'use client'

/**
 * Chat store — vanilla zustand state shared by the chat drawer, sidebar
 * widget, and mobile nav without depending on React hooks.
 *
 * Marked 'use client' so client-only chat UI can import this module safely.
 */

import { createStore } from 'zustand'
import type { ComponentType, ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { chatWidgetStore } from './chat-widget-store.ts'

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

/* ── Shell morph (native view transition) ─────────────────────────────
 *
 *   trigger shell (sidebar widget / pill)  ──startViewTransition──►  drawer panel
 *   part="holocron-chat-shell"                                      part="holocron-chat-shell"
 *
 * Only the shell that is visible in a state carries the part. The
 * view-transition-name is applied from a document stylesheet, and only while
 * <html data-holocron-chat-vt> is set, so other view transitions (React or
 * spiceflow navigations, host pages) never move the chat shell.
 * `::part()` reaches the standalone widget's shadow root: names set from
 * inside a shadow tree are tree-scoped and ignored by document transitions.
 */

export const CHAT_SHELL_PART = 'holocron-chat-shell'

const VT_ATTR = 'data-holocron-chat-vt'
const VT_STYLE_ATTR = 'data-holocron-chat-vt-style'
const OPEN_MS = 280
const CLOSE_MS = 220

const CHAT_VIEW_TRANSITION_CSS = `
:root[${VT_ATTR}] { view-transition-name: none; }
:root[${VT_ATTR}] [part~='${CHAT_SHELL_PART}'],
:root[${VT_ATTR}] ::part(${CHAT_SHELL_PART}) { view-transition-name: ${CHAT_SHELL_PART}; }
::view-transition { pointer-events: none; }
::view-transition-group(${CHAT_SHELL_PART}) {
  animation-duration: var(--holocron-chat-vt-duration);
  animation-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
}
::view-transition-image-pair(${CHAT_SHELL_PART}) {
  overflow: clip;
  background: var(--holocron-chat-vt-bg);
  animation: holocron-chat-vt-shell var(--holocron-chat-vt-duration) cubic-bezier(0.32, 0.72, 0, 1) both;
}
::view-transition-old(${CHAT_SHELL_PART}),
::view-transition-new(${CHAT_SHELL_PART}) {
  width: 100%;
  height: 100%;
  object-fit: none;
  object-position: left top;
  mix-blend-mode: normal;
}
::view-transition-old(${CHAT_SHELL_PART}) {
  animation: holocron-chat-vt-fade 80ms cubic-bezier(0.4, 0, 1, 1) var(--holocron-chat-vt-out-delay) both reverse;
}
::view-transition-new(${CHAT_SHELL_PART}) {
  animation: holocron-chat-vt-fade 140ms cubic-bezier(0.23, 1, 0.32, 1) 60ms both;
}
@keyframes holocron-chat-vt-fade { from { opacity: 0; } }
@keyframes holocron-chat-vt-shell {
  from { border-radius: var(--holocron-chat-vt-from-radius); box-shadow: var(--holocron-chat-vt-from-shadow); }
  to { border-radius: var(--holocron-chat-vt-to-radius); box-shadow: var(--holocron-chat-vt-to-shadow); }
}
`

let activeTransition: ViewTransition | null = null

/** The visible shell, in the page or in the widget's shadow root. */
function findShell(): HTMLElement | null {
  const selector = `[part~='${CHAT_SHELL_PART}']`
  const portalRoot = chatWidgetStore.getState().portalTarget?.getRootNode()
  const fromPortal = portalRoot instanceof ShadowRoot ? portalRoot.querySelector<HTMLElement>(selector) : null
  return fromPortal ?? document.querySelector<HTMLElement>(selector)
}

function readShellLook(): { radius: string; shadow: string; background: string } | null {
  const shell = findShell()
  if (!shell) return null
  const style = getComputedStyle(shell)
  return { radius: style.borderRadius, shadow: style.boxShadow, background: style.backgroundColor }
}

function ensureTransitionStyles() {
  if (document.head.querySelector(`style[${VT_STYLE_ATTR}]`)) return
  const style = document.createElement('style')
  style.setAttribute(VT_STYLE_ATTR, '')
  style.textContent = CHAT_VIEW_TRANSITION_CSS
  document.head.appendChild(style)
}

/* ── Drawer panel code split ──────────────────────────────────────────
 * The panel (messages, Radix session menu) is not in the page bundle.
 * Triggers call preloadChatDrawer() on hover/focus; setChatDrawerState()
 * waits for it so the view transition's new state already has the panel. */

let drawerPanel: ComponentType | null = null
let drawerPanelPromise: Promise<ComponentType> | null = null
const drawerPanelListeners = new Set<() => void>()

export function loadChatDrawerPanel(): Promise<ComponentType> {
  drawerPanelPromise ??= import('./chat-drawer-panel.tsx').then(
    (mod) => {
      drawerPanel = mod.ChatDrawerPanel
      for (const listener of drawerPanelListeners) listener()
      return mod.ChatDrawerPanel
    },
    (error: unknown) => {
      // Let the next open retry, e.g. after a flaky network
      drawerPanelPromise = null
      throw error
    },
  )
  return drawerPanelPromise
}

export function preloadChatDrawer(): void {
  loadChatDrawerPanel().catch(() => {})
}

export const getChatDrawerPanel = (): ComponentType | null => drawerPanel

export function subscribeChatDrawerPanel(listener: () => void): () => void {
  drawerPanelListeners.add(listener)
  return () => drawerPanelListeners.delete(listener)
}

/**
 * Open or close the chat drawer. The trigger shell morphs into the panel (and
 * back) with a native view transition. Browsers without view transitions, or
 * with reduced motion, switch instantly. Always open the drawer through this
 * function: it also loads the panel code.
 */
export function setChatDrawerState(drawerState: DrawerState, extra: Partial<ChatState> = {}): void {
  if (drawerState === 'open' && !drawerPanel) {
    loadChatDrawerPanel().then(
      () => setChatDrawerState(drawerState, extra),
      (error: unknown) => console.error('[holocron:chat] failed to load the chat drawer', error),
    )
    return
  }
  const update = { ...extra, drawerState }
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (
    chatStore.getState().drawerState === drawerState
    || typeof document === 'undefined'
    || !document.startViewTransition
    || reduceMotion
  ) {
    chatStore.setState(update)
    return
  }

  ensureTransitionStyles()
  const root = document.documentElement
  const opening = drawerState === 'open'
  const from = readShellLook()
  root.setAttribute(VT_ATTR, '')
  root.style.setProperty('--holocron-chat-vt-duration', `${opening ? OPEN_MS : CLOSE_MS}ms`)
  // Closing keeps the drawer messages until the shell is almost trigger-sized.
  root.style.setProperty('--holocron-chat-vt-out-delay', opening ? '0ms' : '140ms')

  const transition = document.startViewTransition(() => {
    flushSync(() => chatStore.setState(update))
    const to = readShellLook()
    const start = from ?? to
    const end = to ?? from
    if (!start || !end) return
    // The panel paints the background in both directions.
    root.style.setProperty('--holocron-chat-vt-bg', (opening ? end : start).background)
    root.style.setProperty('--holocron-chat-vt-from-radius', start.radius)
    root.style.setProperty('--holocron-chat-vt-to-radius', end.radius)
    root.style.setProperty('--holocron-chat-vt-from-shadow', start.shadow)
    root.style.setProperty('--holocron-chat-vt-to-shadow', end.shadow)
  })
  activeTransition = transition
  void transition.finished.finally(() => {
    // A newer transition skipped this one and owns the attribute now.
    if (activeTransition !== transition) return
    activeTransition = null
    root.removeAttribute(VT_ATTR)
  })
}
