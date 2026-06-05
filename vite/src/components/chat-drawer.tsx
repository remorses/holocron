'use client'

/**
 * ChatDrawer — slide-in panel for AI chat.
 *
 * Fully ephemeral — no localStorage persistence. Chat resets on page
 * reload. Persistence can be added later server-side (JSX parts can't
 * be serialized to localStorage).
 *
 * Pure CSS transitions — no Radix, no framer-motion.
 * Portals to <body> to sit above navbar stacking context.
 */

import React, { useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { decodeFederationPayload } from 'spiceflow/react'
import { chatState } from '../lib/chat-state.ts'
import type { ChatMessage, ChatModelMessage, ChatPart } from '../lib/chat-store.ts'
import { CHAT_CONTAINER_VT_NAME, withViewTransition } from '../lib/chat-store.ts'
import { useHolocronData } from '../router.ts'
import {
  ChatMessages,
  ChatLoadingDots,
} from './chat-message.tsx'
import { ChatInput, hideChildrenForSnapshot } from './sidebar-assistant.tsx'
import { TrashIcon, CloseIcon } from './chat-icons.tsx'

// ── ChatDrawer ───────────────────────────────────────────────────────

// Module-level stable callbacks for useSyncExternalStore (see AGENTS.md rules)
const emptySubscribe = () => () => {}
const getTrue = () => true as const
const getFalse = () => false as const
const getBody = () => document.body
const getNull = () => null

function appendAssistantPart(messages: ChatMessage[], part: ChatPart): ChatMessage[] {
  const lastMessage = messages.at(-1)
  if (lastMessage?.role === 'assistant') {
    return [
      ...messages.slice(0, -1),
      { role: 'assistant', parts: [...lastMessage.parts, part] },
    ]
  }
  return [...messages, { role: 'assistant', parts: [part] }]
}

export function ChatDrawer() {
  const isMounted = useSyncExternalStore(emptySubscribe, getTrue, getFalse)
  if (!isMounted) return null
  return <ChatDrawerInner />
}

function ChatDrawerInner() {
  const drawerState = chatState((s) => s.drawerState)
  const isGenerating = chatState((s) => s.isGenerating)
  const messages = chatState((s) => s.messages)
  const errorMessage = chatState((s) => s.errorMessage)
  const draftText = chatState((s) => s.draftText)
  const { currentPageHref, site } = useHolocronData()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const drawerPanelRef = useRef<HTMLDivElement>(null)
  // Prefix API calls with the Vite base path so they work when mounted at e.g. /docs
  const basePath = site.base === '/' ? '' : `/${site.base.replace(/^\/+|\/+$/g, '')}`

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  /** Scroll the last user message to the top of the scroll area so the
   *  response streams in below it, matching fumabase's chat UX. */
  const scrollToLastUserMessage = useCallback(() => {
    const msgs = chatState.getState().messages
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
      const submitText = text || chatState.getState().draftText.trim()
      if (!submitText) return
      if (chatState.getState().isGenerating) return

      const modelMessages = chatState.getState().modelMessages
      const nextUserMessage: ChatMessage = { role: 'user', parts: [{ type: 'text', text: submitText }] }

      const controller = new AbortController()
      chatState.setState((s) => ({
        isGenerating: true,
        // Keep the existing conversation, append the new user message.
        messages: [...s.messages, nextUserMessage],
        draftText: '',
        pendingSubmit: false,
        errorMessage: null,
        abortController: controller,
      }))

      setTimeout(scrollToLastUserMessage, 0)

      try {
        const response = await fetch(`${basePath}/holocron-api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            modelMessages,
            message: submitText,
            currentSlug: currentPageHref || '/',
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorBody = await response.json().catch(() => undefined)
          chatState.setState({
            errorMessage: typeof errorBody?.error === 'string'
              ? errorBody.error
              : `Chat request failed: ${response.status} ${response.statusText}`,
          })
          return
        }

        const decoded = await decodeFederationPayload<{
          stream: AsyncIterable<ChatPart | { type: 'model-messages'; messages: ChatModelMessage[] }>
        }>(response)

        for await (const part of decoded.stream) {
          if (part.type === 'model-messages') {
            chatState.setState({ modelMessages: part.messages })
            continue
          }
          chatState.setState((s) => ({
            messages: appendAssistantPart(s.messages, part),
          }))
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // User clicked stop — keep whatever parts arrived
        } else {
          console.error('Chat error:', error)
          chatState.setState({
            errorMessage:
              error instanceof Error
                ? error.message
                : 'An unexpected error occurred',
          })
        }
      } finally {
        chatState.setState({
          isGenerating: false,
          abortController: null,
        })
      }
    },
    [currentPageHref, basePath, scrollToBottom, scrollToLastUserMessage],
  )

  // ── Stop ────────────────────────────────────────────────────────

  const handleStop = useCallback(() => {
    chatState.getState().abortController?.abort()
  }, [])

  // ── Regenerate ──────────────────────────────────────────────────
  //
  // Deletes the last assistant message and resubmits the last user
  // message. modelMessages is trimmed back to before the last user turn
  // so handleSubmit re-appends a clean user message + history.

  // Regenerate from a specific assistant message index.
  // Finds the user message just before it, trims everything from that
  // point onward, and resubmits.
  const handleRegenerate = useCallback((assistantMsgIndex: number) => {
    if (chatState.getState().isGenerating) return
    const msgs = chatState.getState().messages

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

    // Trim modelMessages: count how many user messages appear from
    // index 0..userIdx (inclusive), then cut modelMessages to keep
    // only the turns before that user message.
    const userMsgCount = msgs.slice(0, userIdx + 1).filter((m) => m.role === 'user').length
    const model = chatState.getState().modelMessages
    let cut = 0
    let seenUsers = 0
    for (let j = 0; j < model.length; j++) {
      if (model[j]?.role === 'user') seenUsers++
      if (seenUsers >= userMsgCount) break
      cut = j + 1
    }
    const trimmedModel = model.slice(0, cut)

    chatState.setState({
      messages: msgs.slice(0, userIdx),
      modelMessages: trimmedModel,
    })

    void handleSubmit(userText)
  }, [handleSubmit])

  // ── Clear / new chat ───────────────────────────────────────────

  const handleClear = useCallback(() => {
    handleStop()
    chatState.setState({
      isGenerating: false,
      abortController: null,
      messages: [],
      modelMessages: [],
      draftText: '',
      pendingSubmit: false,
      errorMessage: null,
    })
  }, [handleStop])

  // ── Close ──────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    withViewTransition(
      () => { chatState.setState({ drawerState: 'closed' }) },
      () => hideChildrenForSnapshot(drawerPanelRef.current),
    )
  }, [])

  // ── Draft auto-submit (sidebar → drawer handoff) ───────────────

  const drawerInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (drawerState !== 'open') return
    const { pendingSubmit, draftText } = chatState.getState()
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
      chatState.setState({ drawerState: 'closed' })
    }
    document.addEventListener('click', onClickLink)
    return () => document.removeEventListener('click', onClickLink)
  }, [drawerState])

  const isOpen = drawerState === 'open'

  // Portal to <body> so the drawer sits outside all stacking contexts
  const portalTarget = useSyncExternalStore(emptySubscribe, getBody, getNull)
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

      {/* Drawer panel — the View Transitions API morphs the sidebar widget
       * container into this panel (position + size + border-radius interpolation).
       * No manual transform/opacity transitions needed; VT handles the animation.
       * The panel owns the VT name when open; the sidebar widget owns it when closed. */}
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
            className='m-3 rounded-2xl bg-accent px-0.5 pt-0.5 pb-0.5'
          >
            <ChatInput
              value={draftText}
              onChange={(v) => chatState.setState({ draftText: v })}
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
