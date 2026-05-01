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

import React, { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { decodeFederationPayload } from 'spiceflow/react'
import { chatState } from '../lib/chat-state.ts'
import type { ChatMessage, ChatModelMessage, ChatPart } from '../lib/chat-store.ts'
import { useHolocronData } from '../router.ts'
import {
  ChatMessages,
  ChatLoadingDots,
} from './chat-message.tsx'
import { ChatInput } from './sidebar-assistant.tsx'
import { TrashIcon, CloseIcon, InfoCircleIcon } from './chat-icons.tsx'

// ── ChatDrawer ───────────────────────────────────────────────────────

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
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null

  return <ChatDrawerInner />
}

function ChatDrawerInner() {
  const drawerState = chatState((s) => s.drawerState)
  const isGenerating = chatState((s) => s.isGenerating)
  const messages = chatState((s) => s.messages)
  const errorMessage = chatState((s) => s.errorMessage)
  const draftText = chatState((s) => s.draftText)
  const { currentPageHref } = useHolocronData()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

      setTimeout(scrollToBottom, 0)

      try {
        const response = await fetch('/holocron-api/chat', {
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
          scrollToBottom()
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
    [currentPageHref, scrollToBottom],
  )

  // ── Stop ────────────────────────────────────────────────────────

  const handleStop = useCallback(() => {
    chatState.getState().abortController?.abort()
  }, [])

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
    chatState.setState({ drawerState: 'closed' })
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
    setTimeout(() => drawerInputRef.current?.focus(), 100)
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

  const isOpen = drawerState === 'open'

  // Portal to <body> so the drawer sits outside all stacking contexts
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

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
          transition: 'opacity 200ms ease',
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed',
          right: 48,
          top: 32,
          bottom: 32,
          width: 'min(440px, calc(100vw - 96px))',
          transform: isOpen ? 'translateX(0)' : 'translateX(calc(100% + 48px))',
          transition: 'transform 200ms ease',
          background: 'var(--background)',
          borderRadius: 24,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
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
              onClick={handleClear}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
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
              onClick={handleClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
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

          {messages.length > 0 && <ChatMessages messages={messages} />}
          {isGenerating && (() => {
            // Show loading dots if the last user message has no text response after it yet
            const lastUserIdx = messages.findLastIndex((message) => message.role === 'user')
            const hasTextAfterLastUser = messages.slice(lastUserIdx + 1).some((message) => (
              message.role === 'assistant' && message.parts.some((part) => part.type === 'text')
            ))
            return !hasTextAfterLastUser
          })() && <ChatLoadingDots />}

          {errorMessage && (
            <ChatErrorMessage message={errorMessage} />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer — same muted frame as sidebar assistant */}
        <div style={{ flexShrink: 0 }}>
          <div className='m-3 rounded-2xl bg-accent px-0.5 pt-px pb-0.5'>
            <div className='flex items-center gap-1.5 px-2.5 py-1.5'>
              <span className='text-muted-foreground shrink-0'>
                <InfoCircleIcon />
              </span>
              <span className='text-[11px] text-muted-foreground'>
                Ask AI about this page
              </span>
            </div>
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
