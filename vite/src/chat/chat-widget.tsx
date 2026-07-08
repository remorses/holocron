'use client'

/**
 * ChatWidget — top-level drop-in AI chat component for any website.
 *
 * Point it at your holocron docs domain and get a working AI chat.
 * The widget fetches docs, streams responses via RSC federation, and
 * renders inside a Shadow DOM for style isolation.
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

// ── Default trigger — floating bubble button ────────────────────────

function DefaultTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-label='Open AI chat'
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: 'none',
        background: 'var(--foreground, #0a0a0a)',
        color: 'var(--background, #ffffff)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgb(0 0 0 / 0.15)',
        transition: 'transform 150ms ease, box-shadow 150ms ease',
        zIndex: 199,
      }}
    >
      <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
      </svg>
    </button>
  )
}

// ── ChatWidget ──────────────────────────────────────────────────────

export type ChatWidgetProps = {
  /** Domain of the holocron docs site (e.g. "docs.myapp.com") */
  domain: string
  /** Custom trigger component. Receives onClick to toggle the chat drawer. */
  trigger?: React.ComponentType<{ onClick: () => void }>
  /** Site name shown in the chat panel header */
  siteName?: string
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
}

export function ChatWidget({
  domain,
  trigger: TriggerComponent,
  siteName = '',
  currentSlug = '/',
  theme = 'system',
  style,
  className,
  tools,
  context,
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
      tools: propTools,
      context: context ?? {},
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
  }, [domain, currentSlug, siteName, tools, context])

  // Portal target is set reactively via onMountPoint callback from ChatShadowHost.
  // No setTimeout or querySelector needed.
  const handleMountPoint = useCallback((mount: HTMLElement) => {
    chatWidgetStore.setState({ portalTarget: mount })
  }, [])

  const handleToggle = useCallback(() => {
    const current = chatStore.getState().drawerState
    chatStore.setState({ drawerState: current === 'open' ? 'closed' : 'open' })
  }, [])

  const Trigger = TriggerComponent || DefaultTrigger

  return (
    <>
      {/* Trigger is outside shadow DOM so users can style it */}
      <Trigger onClick={handleToggle} />

      {/* Chat UI inside shadow DOM for style isolation.
       * The holocron-chat class provides default CSS variable values
       * via :where(.holocron-chat) in chat.css (zero specificity). */}
      <ChatShadowHost
        className={`holocron-chat ${className || ''}`}
        style={style}
        dark={isDark}
        onMountPoint={handleMountPoint}
      >
        <ChatDrawer />
      </ChatShadowHost>
    </>
  )
}
