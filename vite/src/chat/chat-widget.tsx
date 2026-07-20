'use client'

/**
 * ChatWidget — top-level drop-in AI chat component for any website.
 *
 * Point it at your holocron docs domain and get a working AI chat.
 * The widget fetches docs, streams responses via RSC federation, and
 * renders inside a Shadow DOM for style isolation. Pill ↔ drawer morph
 * uses Motion layoutId (Chrome ignores CSS view-transition-name in shadow).
 *
 * Usage:
 *   import { ChatWidget } from '@holocron.so/vite/chat'
 *
 *   <ChatWidget domain="docs.myapp.com" />
 *   <ChatWidget domain="docs.myapp.com" trigger={MyCustomBubble} />
 */

import React, { useEffect, useCallback, useSyncExternalStore } from 'react'
import { chatWidgetStore } from './chat-widget-store.ts'
import { chatStore } from './chat-store.ts'
import { ChatDrawer } from './chat-drawer.tsx'
import { ChatPill } from './chat-pill.tsx'
import { ChatShadowHost } from './chat-shadow-host.tsx'
import { ensureSessionRestored, hasExistingSession } from './chat-submit.ts'
import { registerToolOnModelContext, unregisterTool } from './define-tool.ts'
import type { ChatToolDefinition } from './define-tool.ts'

// ── System dark mode detection (stable callbacks for useSyncExternalStore) ──

const darkMediaQuery =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

function subscribeSystemDark(cb: () => void) {
  darkMediaQuery?.addEventListener('change', cb)
  return () => darkMediaQuery?.removeEventListener('change', cb)
}

function getSystemDark() {
  return darkMediaQuery?.matches ?? false
}

const getServerSystemDark = () => false

// ── ChatWidget ──────────────────────────────────────────────────────

export type ChatWidgetProps = {
  /** Domain of the holocron docs site (e.g. "docs.myapp.com") */
  domain: string
  /** Custom trigger component. Receives onClick to toggle the chat drawer.
   *  When omitted, the default fin.ai-style textarea pill is shown
   *  (bottom-right on desktop, bottom-center on mobile). */
  trigger?: React.ComponentType<{ onClick: () => void }>
  /** Site name shown in the chat panel header */
  siteName?: string
  /** Suggested prompts shown on the empty chat screen. Suggestions ending
   *  with "..." fill the input instead of submitting. Defaults based on
   *  siteName are shown when omitted. */
  suggestions?: string[]
  /** Current page slug for context (e.g. "/quickstart") */
  currentSlug?: string
  /** Color theme for the chat widget.
   * - 'light': always light mode
   * - 'dark': always dark mode
   * - 'system': follows OS prefers-color-scheme (default) */
  theme?: 'light' | 'dark' | 'system'
  /** CSS variable overrides applied on the shadow host container */
  style?: React.CSSProperties
  /** Class name for the shadow host container */
  className?: string
  /** Client-side tools that execute in the browser when the model calls them. */
  tools?: ChatToolDefinition[]
  /** Arbitrary context object injected into the system prompt as XML. */
  context?: Record<string, unknown>
  /** Client-side navigation function for browser_navigate tool.
   *
   *  Examples:
   *    - Next.js: `(path) => router.push(path)`
   *    - React Router: `(path) => navigate(path)`
   *    - Spiceflow: `(path) => router.push(path)` */
  navigate: (path: string) => void | Promise<void>
}

export function ChatWidget({
  domain,
  trigger: TriggerComponent,
  siteName = '',
  suggestions,
  currentSlug = '/',
  theme = 'system',
  style,
  className,
  tools,
  context,
  navigate,
}: ChatWidgetProps) {
  const systemDark = useSyncExternalStore(
    subscribeSystemDark,
    getSystemDark,
    getServerSystemDark,
  )
  const isDark = theme === 'dark' || (theme === 'system' && systemDark)

  // Initialize widget store with config and eagerly restore any persisted
  // session (localStorage in widget mode) so the drawer shows the previous
  // conversation immediately when opened.
  //
  // Prop-based tools are stored in chatWidgetStore (for browser automation
  // tools from pageTools()) AND registered on document.modelContext (for
  // custom tools passed via props for backward compat). On cleanup,
  // previously registered prop tools are unregistered.
  useEffect(() => {
    const protocol = domain.startsWith('localhost') ? 'http' : 'https'
    const propTools = tools ?? []
    chatWidgetStore.setState({
      chatApiUrl: `${protocol}://${domain}/holocron-api/chat`,
      currentSlug,
      siteName,
      suggestions: suggestions ?? [],
      tools: propTools,
      context: context ?? {},
      navigate,
    })
    // Register prop tools on document.modelContext for agent discovery.
    // Tools with exposeToModelContext: false (browser automation) are skipped.
    // Track which tools we actually registered so cleanup only removes ours.
    const registered: string[] = []
    for (const t of propTools) {
      if (t.exposeToModelContext !== false) {
        registerToolOnModelContext(t)
        registered.push(t.name)
      }
    }
    if (hasExistingSession()) {
      void ensureSessionRestored()
    }
    return () => {
      for (const name of registered) {
        unregisterTool(name)
      }
    }
  }, [domain, currentSlug, siteName, suggestions, tools, context, navigate])

  // Portal target is set reactively via onMountPoint callback from ChatShadowHost.
  const handleMountPoint = useCallback((mount: HTMLElement) => {
    chatWidgetStore.setState({ portalTarget: mount })
  }, [])

  const handleToggle = useCallback(() => {
    const current = chatStore.getState().drawerState
    chatStore.setState({ drawerState: current === 'open' ? 'closed' : 'open' })
  }, [])

  return (
    <>
      {/* Custom trigger stays outside shadow so users can style it with page CSS */}
      {TriggerComponent ? <TriggerComponent onClick={handleToggle} /> : null}

      {/* Pill + drawer inside shadow DOM for style isolation. Motion layoutId
       * morphs pill ↔ drawer (works in shadow; CSS view transitions do not). */}
      <ChatShadowHost
        className={className}
        style={style}
        dark={isDark}
        onMountPoint={handleMountPoint}
      >
        {!TriggerComponent && <ChatPill />}
        <ChatDrawer />
      </ChatShadowHost>
    </>
  )
}
