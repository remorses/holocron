'use client'

/**
 * ChatDrawer — slide-in panel for AI chat.
 *
 * Fully ephemeral — no localStorage persistence. Chat resets on page
 * reload. Persistence can be added later server-side (JSX parts can't
 * be serialized to localStorage).
 *
 * Pure CSS transitions — no Radix, no framer-motion.
 * Portal target comes from chatWidgetStore (document.body for holocron,
 * shadow mount container for standalone widget).
 */

import React, { useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { chatStore, CHAT_CONTAINER_VT_NAME, withViewTransition } from './chat-store.ts'

function useChatStore<T>(selector: (s: import('./chat-store.ts').ChatState) => T): T {
  return useSyncExternalStore(chatStore.subscribe, () => selector(chatStore.getState()), () => selector(chatStore.getState()))
}
import { chatWidgetStore } from './chat-widget-store.ts'
import { submitChat } from './chat-submit.ts'
import {
  ChatMessages,
  ChatLoadingDots,
} from './chat-message.tsx'
import { ChatInput, hideChildrenForSnapshot } from './chat-input.tsx'
import { TrashIcon, CloseIcon } from './chat-icons.tsx'

// ── ChatDrawer ───────────────────────────────────────────────────────

// Module-level stable callbacks for useSyncExternalStore (see AGENTS.md rules)
const emptySubscribe = () => () => {}
const getTrue = () => true as const
const getFalse = () => false as const
const getNull = () => null

function getPortalTarget(): HTMLElement | null {
  return chatWidgetStore.getState().portalTarget || document.body
}

export function ChatDrawer() {
  const isMounted = useSyncExternalStore(emptySubscribe, getTrue, getFalse)
  if (!isMounted) return null
  return <ChatDrawerInner />
}

function ChatDrawerInner() {
  const drawerState = useChatStore((s) => s.drawerState)
  const isGenerating = useChatStore((s) => s.isGenerating)
  const messages = useChatStore((s) => s.messages)
  const errorMessage = useChatStore((s) => s.errorMessage)
  const draftText = useChatStore((s) => s.draftText)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const drawerPanelRef = useRef<HTMLDivElement>(null)

  /** Scroll the last user message to the top of the scroll area so the
   *  response streams in below it, matching fumabase's chat UX. */
  const scrollToLastUserMessage = useCallback(() => {
    const msgs = chatStore.getState().messages
    const lastUserIdx = msgs.findLastIndex((m) => m.role === 'user')
    if (lastUserIdx === -1) return
    const el = document.querySelector(`[data-message-id="msg-${lastUserIdx}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // ── Submit ──────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (text?: string) => {
      await submitChat(text, scrollToLastUserMessage)
    },
    [scrollToLastUserMessage],
  )

  // ── Stop ────────────────────────────────────────────────────────

  const handleStop = useCallback(() => {
    chatStore.getState().abortController?.abort()
  }, [])

  // ── Regenerate ──────────────────────────────────────────────────
  //
  // Regenerate from a specific assistant message index.
  // Finds the user message just before it, trims the local UI messages
  // from that point onward, and resubmits. Flue manages session state
  // server-side so we only trim the local display messages.

  const handleRegenerate = useCallback((assistantMsgIndex: number) => {
    if (chatStore.getState().isGenerating) return
    const msgs = chatStore.getState().messages

    // Find the user message that precedes this assistant message
    let userIdx = -1
    for (let j = assistantMsgIndex - 1; j >= 0; j--) {
      if (msgs[j]?.role === 'user') { userIdx = j; break }
    }
    if (userIdx === -1) return

    const userText = (msgs[userIdx]?.parts ?? [])
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('\n')
      .trim()
    if (!userText) return

    chatStore.setState({
      messages: msgs.slice(0, userIdx),
    })

    void handleSubmit(userText)
  }, [handleSubmit])

  // ── Clear / new chat ───────────────────────────────────────────

  const handleClear = useCallback(() => {
    handleStop()
    chatStore.setState({
      isGenerating: false,
      abortController: null,
      messages: [],
      sessionId: '',
      streamOffset: '',
      draftText: '',
      pendingSubmit: false,
      errorMessage: null,
    })
  }, [handleStop])

  // ── Close ──────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    withViewTransition(
      () => { chatStore.setState({ drawerState: 'closed' }) },
      () => hideChildrenForSnapshot(drawerPanelRef.current),
    )
  }, [])

  // ── Draft auto-submit (sidebar → drawer handoff) ───────────────

  const drawerInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (drawerState !== 'open') return
    const { pendingSubmit, draftText } = chatStore.getState()
    if (pendingSubmit && draftText.trim()) {
      void handleSubmit(draftText.trim())
    }
    // Focus the drawer textarea when opening
    const timer = setTimeout(() => drawerInputRef.current?.focus(), 100)
    return () => clearTimeout(timer)
  }, [drawerState, handleSubmit])

  // ── Disable body scroll when open ──────────────────────────────

  useEffect(() => {
    if (drawerState === 'open') {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerState])

  // Auto-close drawer when any link is clicked (internal navigation,
  // hash links, external links). Uses a document-level click listener
  // so every <a> in the page is covered without per-component wiring.
  useEffect(() => {
    if (drawerState !== 'open') return
    function onClickLink(e: MouseEvent) {
      const anchor = (e.target as HTMLElement)?.closest?.('a')
      if (!anchor) return
      chatStore.setState({ drawerState: 'closed' })
    }
    document.addEventListener('click', onClickLink)
    return () => document.removeEventListener('click', onClickLink)
  }, [drawerState])

  const isOpen = drawerState === 'open'

  // Portal target from widget store (reactive), fallback to document.body
  const portalTarget = useSyncExternalStore(chatWidgetStore.subscribe, getPortalTarget, getNull)
  if (!portalTarget) return null

  return createPortal(
    // Single wrapper — z-index 200 beats navbar's z-index 100
    <div style={{ position: 'relative', zIndex: 200 }}>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        aria-hidden='true'
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgb(0 0 0 / 0.3)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: isOpen
            ? 'opacity 250ms ease 150ms'
            : 'opacity 150ms ease',
        }}
      />

      {/* Drawer panel — VT morphs sidebar widget into this panel */}
      <div
        ref={drawerPanelRef}
        style={{
          position: 'fixed',
          right: 16,
          top: 16,
          bottom: 16,
          width: 'min(440px, calc(100vw - 32px))',
          pointerEvents: isOpen ? 'auto' : 'none',
          visibility: isOpen ? 'visible' : 'hidden',
          background: 'var(--background)',
          borderRadius: 'var(--radius-3xl)',
          display: isOpen ? 'flex' : 'none',
          flexDirection: 'column',
          overflow: 'hidden',
          viewTransitionName: isOpen ? CHAT_CONTAINER_VT_NAME : 'none',
        } as React.CSSProperties}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: '14px',
              color: 'var(--foreground)',
            }}
          >
            Chat
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type='button'
              onClick={handleClear}
              title='New chat'
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
              }}
              aria-label='New chat'
            >
              <TrashIcon />
            </button>
            <button
              type='button'
              onClick={handleClose}
              title='Close'
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
              }}
              aria-label='Close'
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div
          onClick={() => {
            const selection = window.getSelection()
            if (selection && selection.toString().length > 0) return
            drawerInputRef.current?.focus()
          }}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {!isGenerating && messages.length === 0 && <WelcomeMessage />}

          {messages.length > 0 && (
            <ChatMessages
              messages={messages}
              isGenerating={isGenerating}
              onRegenerate={handleRegenerate}
            />
          )}
          {isGenerating && <ChatLoadingDots />}

          {errorMessage && (
            <ChatErrorMessage message={errorMessage} />
          )}

          {/* Spacer — pushes content to the top while keeping the scroll
              area tall enough so the user can scroll the last message to
              the top of the viewport. */}
          <div style={{ minHeight: '300px', flexShrink: 0 }} />
          <div ref={messagesEndRef} />
        </div>

        {/* Footer — same muted frame as sidebar assistant.
         * Owns the view-transition-name when drawer is open so the browser
         * morphs the chat input from the sidebar position to here. */}
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              margin: '12px',
              borderRadius: '16px',
              background: 'var(--accent)',
              padding: '2px',
            }}
          >
            <ChatInput
              value={draftText}
              onChange={(v) => chatStore.setState({ draftText: v })}
              onSubmit={handleSubmit}
              onStop={handleStop}
              isGenerating={isGenerating}
              placeholder='How can I help?'
              textClassName='text-sm'
              textareaRef={drawerInputRef}
            />
          </div>
        </div>
      </div>
    </div>,
    portalTarget,
  )
}

function ChatErrorMessage({ message }: { message: string }) {
  return (
    <div
      style={{
        color: 'var(--destructive)',
        fontSize: '12px',
        padding: '8px 0',
      }}
    >
      Error: {message}
    </div>
  )
}

// ── Welcome message ──────────────────────────────────────────────────

function WelcomeMessage() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 20px',
      }}
    >
      <div
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--muted-foreground)',
          lineHeight: '1.4',
        }}
      >
        Hi, I can help you search and explain the docs
      </div>
    </div>
  )
}
