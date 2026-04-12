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
import {
  chatState,
  type ChatPart,
} from '../lib/chat-state.ts'
import { useHolocronData } from '../router.ts'
import {
  ChatUserMessage,
  ChatAssistantMessage,
  ChatLoadingDots,
} from './chat-message.tsx'
import { ChatInput } from './sidebar-assistant.tsx'
import { TrashIcon, CloseIcon, InfoCircleIcon } from './chat-icons.tsx'

// ── ChatDrawer ───────────────────────────────────────────────────────

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
  const parts = chatState((s) => s.parts)
  const errorMessage = chatState((s) => s.errorMessage)
  const { currentPageHref } = useHolocronData()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputValueRef = useRef('')
  const [inputValue, setInputValue] = useState('')

  inputValueRef.current = inputValue

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // ── Submit ──────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (text?: string) => {
      const submitText = text || inputValueRef.current.trim()
      if (!submitText) return
      if (chatState.getState().isGenerating) return

      // Extract latest session snapshot from existing parts (if any)
      const currentParts = chatState.getState().parts
      const sessionPart = [...currentParts]
        .reverse()
        .find((p) => p.type === 'session')

      const controller = new AbortController()
      chatState.setState((s) => ({
        isGenerating: true,
        // Keep existing parts, append new user message
        parts: [...s.parts, { type: 'user-message' as const, text: submitText }],
        draftText: '',
        errorMessage: null,
        abortController: controller,
      }))
      setInputValue('')

      setTimeout(scrollToBottom, 0)

      try {
        const response = await fetch('/holocron-api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: [
              { role: 'user', parts: [{ type: 'text', text: submitText }] },
            ],
            previousMessages: sessionPart?.messages,
            currentSlug: currentPageHref || '/',
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(
            `Chat request failed: ${response.status} ${response.statusText}`,
          )
        }

        const decoded = await decodeFederationPayload<{
          stream: AsyncIterable<ChatPart>
        }>(response)

        for await (const part of decoded.stream) {
          chatState.setState((s) => ({
            parts: [...s.parts, part],
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
      parts: [],
      draftText: '',
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
    const { draftText } = chatState.getState()
    if (draftText.trim()) {
      const text = draftText.trim()
      chatState.setState({ draftText: '' })
      void handleSubmit(text)
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
          background: 'rgb(0 0 0 / 0.5)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: 'min(440px, 100vw)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 200ms ease',
          background: 'var(--background)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
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
          {!isGenerating && parts.length === 0 && <WelcomeMessage />}

          {parts.length > 0 && <ChatAssistantMessage parts={parts} />}
          {isGenerating && (() => {
            // Show loading dots if the last user message has no text response after it yet
            const lastUserIdx = parts.findLastIndex((p) => p.type === 'user-message')
            const hasTextAfterLastUser = parts.slice(lastUserIdx + 1).some((p) => p.type === 'text')
            return !hasTextAfterLastUser
          })() && <ChatLoadingDots />}

          {errorMessage && (
            <div
              style={{
                color: 'var(--destructive)',
                fontSize: '12px',
                padding: '8px 0',
              }}
            >
              Error: {errorMessage}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer — same muted frame as sidebar assistant */}
        <div style={{ flexShrink: 0 }}>
          <div className='m-3 rounded-2xl bg-foreground/8 px-0.5 pt-px pb-0.5'>
            <div className='flex items-center gap-1.5 px-2.5 py-1.5'>
              <span className='text-muted-foreground shrink-0'>
                <InfoCircleIcon />
              </span>
              <span className='text-[11px] text-muted-foreground'>
                Ask AI about this page
              </span>
            </div>
            <ChatInput
              value={inputValue}
              onChange={setInputValue}
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
