'use client'

/**
 * ChatDrawer — slide-in panel for AI chat.
 *
 * Conversations persist server-side keyed by a session id (JS-readable cookie
 * in embedded mode, localStorage in widget mode). The conversation is restored
 * eagerly on page load by HolocronChatBridge. The top bar hosts a session
 * select (past sessions from localStorage, titled by the gateway) plus a
 * "New chat" button that rotates to a fresh session via startNewChat().
 *
 * Shell morph uses Motion layoutId (shared with ChatPill / SidebarAssistant).
 * Portal target comes from chatWidgetStore (document.body for holocron,
 * the shadow mount for the standalone widget).
 */

import React, { useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { chatStore, CHAT_LAYOUT_ID, CHAT_LAYOUT_TRANSITION } from './chat-store.ts'

function useChatStore<T>(selector: (s: import('./chat-store.ts').ChatState) => T): T {
  return useSyncExternalStore(chatStore.subscribe, () => selector(chatStore.getState()), () => selector(chatStore.getState()))
}
import { chatWidgetStore } from './chat-widget-store.ts'
import { startNewChat, ensureSessionRestored, submitChat } from './chat-submit.ts'
import {
  ChatMessages,
  ChatLoadingDots,
} from './chat-message.tsx'
import { ChatInput } from './chat-input.tsx'
import { PlusIcon, CloseIcon, SparkleIcon, ArrowRightIcon } from './chat-icons.tsx'
import { ChatSessionSelect } from './chat-session-select.tsx'

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
  const reduceMotion = useReducedMotion()

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
  // Finds the user message just before it, trims everything from that
  // point onward in both messages and modelMessages, then resubmits.
  //
  // modelMessages can diverge from messages (stopped generation, failed
  // requests), so we align by matching user text content rather than
  // counting positions. This avoids accidentally keeping the response
  // being regenerated in the model's history.

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

    // Trim modelMessages: find the model user message whose content
    // matches userText and cut everything from that point onward.
    // If no match is found (diverged history), wipe modelMessages
    // entirely so we never risk including stale assistant answers.
    const model = chatStore.getState().modelMessages
    let cut = 0
    for (let j = model.length - 1; j >= 0; j--) {
      const m = model[j]
      if (m?.role !== 'user') continue
      const mText = typeof m.content === 'string'
        ? m.content.trim()
        : Array.isArray(m.content)
          ? m.content
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('\n')
            .trim()
          : ''
      if (mText === userText) { cut = j; break }
    }
    const trimmedModel = model.slice(0, cut)

    chatStore.setState({
      messages: msgs.slice(0, userIdx),
      modelMessages: trimmedModel,
    })

    void handleSubmit(userText)
  }, [handleSubmit])

  // ── New chat ───────────────────────────────────────────────────

  const handleNewChat = useCallback(() => {
    // Rotate to a fresh session. The old conversation stays in the local
    // session list (and server-side) so the select can restore it.
    startNewChat()
    // Focus synchronously so the user can start typing immediately. A
    // deferred focus (setTimeout) could land while the session menu is
    // open and close it — the non-modal menu dismisses on focus-out.
    drawerInputRef.current?.focus()
  }, [])

  // ── Close ──────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    chatStore.setState({ drawerState: 'closed' })
  }, [])

  // ── Draft auto-submit (sidebar → drawer handoff) ───────────────

  const drawerInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (drawerState !== 'open') return
    // Lazily restore the persisted conversation the first time the drawer
    // opens. submitChat also awaits this internally, so an auto-submit
    // below cannot race the restore and overwrite server-side history.
    void ensureSessionRestored()
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
  // Programmatic clicks (e.isTrusted === false) are excluded so the
  // drawer stays open during tool execution.
  useEffect(() => {
    if (drawerState !== 'open') return
    function onClickLink(e: MouseEvent) {
      if (!e.isTrusted) return
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
    // Single wrapper — z-index 200 beats navbar's z-index 100.
    // Always mounted so the AnimatePresence exit clone keeps its stacking
    // context while the drawer morphs back into the pill/sidebar shell.
    <div style={{ position: 'relative', zIndex: 200 }}>
      {/* Click-catcher — fin.ai style: no dim, page stays visible behind
       * the frosted glass panel. Clicking outside still closes. Rendered
       * OUTSIDE AnimatePresence so it unmounts instantly on close and the
       * page is clickable again while the exit morph plays. */}
      {isOpen && (
        <div
          onClick={handleClose}
          aria-hidden='true'
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'auto',
          }}
        />
      )}

      {/* Drawer panel — Motion layoutId morphs sidebar widget / pill into this
       * panel. AnimatePresence keeps the panel in the DOM while it exits so
       * closing morphs it back into the pill/sidebar bounds (with crossfade)
       * instead of vanishing instantly (motion.dev shared layout pattern). */}
      <AnimatePresence>
      {isOpen && (
      <motion.div
        key='holocron-chat-drawer-panel'
        ref={drawerPanelRef}
        className='holocron-chat-drawer-panel'
        layoutId={CHAT_LAYOUT_ID}
        layoutDependency={drawerState}
        initial={false}
        transition={reduceMotion ? { duration: 0 } : { layout: CHAT_LAYOUT_TRANSITION }}

        style={{
          position: 'fixed',
          right: 16,
          top: 16,
          bottom: 16,
          width: 'min(440px, calc(100vw - 32px))',
          pointerEvents: 'auto',
          background: 'var(--background)',
          borderRadius: 24,
          border: '1px solid var(--border)',
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
          <ChatSessionSelect onNewChat={handleNewChat} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type='button'
              onClick={handleNewChat}
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
              <PlusIcon />
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
          {!isGenerating && messages.length === 0 && (
            <WelcomeMessage onSubmit={handleSubmit} inputRef={drawerInputRef} />
          )}

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

        {/* Footer — primary-tinted frame so the input reads as the main
         * affordance of the panel (brightens further on focus). */}
        <div style={{ flexShrink: 0 }}>
          <div
            className='holocron-chat-input-frame'
            style={{
              margin: '12px',
              borderRadius: '16px',
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
      </motion.div>
      )}
      </AnimatePresence>
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
//
// Empty-state screen: sparkle illustration, short pitch, and suggestion
// links. Suggestions come from docs.json `assistant.suggestions` (via
// chatWidgetStore); when absent, three site-name-based defaults are shown.
// A suggestion ending with "..." fills the input instead of submitting.

// Module-level stable getters for useSyncExternalStore (see AGENTS.md rules)
const getWidgetSiteName = () => chatWidgetStore.getState().siteName
const getWidgetSuggestions = () => chatWidgetStore.getState().suggestions

function WelcomeMessage({
  onSubmit,
  inputRef,
}: {
  onSubmit: (text: string) => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  const siteName = useSyncExternalStore(chatWidgetStore.subscribe, getWidgetSiteName, getWidgetSiteName)
  const configured = useSyncExternalStore(chatWidgetStore.subscribe, getWidgetSuggestions, getWidgetSuggestions)
  const reduceMotion = useReducedMotion()

  const suggestions = configured.length > 0
    ? configured
    : [
        siteName ? `What is ${siteName}?` : 'What is this project?',
        'Guide me through the pages I should read first',
        'Search the docs for ...',
      ]

  const handleSuggestion = (text: string) => {
    // "..." suffix → open-ended prompt: fill the input and let the user
    // complete the query instead of submitting a half sentence.
    const openEnded = text.replace(/(\.\.\.|…)\s*$/, '')
    if (openEnded !== text) {
      const draft = openEnded.endsWith(' ') ? openEnded : `${openEnded} `
      chatStore.setState({ draftText: draft })
      inputRef.current?.focus()
      return
    }
    onSubmit(text)
  }

  const enter = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 10, filter: 'blur(2px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: { duration: 0.4, delay, ease: [0.22, 0.61, 0.36, 1] as const },
        }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        textAlign: 'left',
        padding: '32px 12px',
        gap: '10px',
      }}
    >
      <motion.div
        {...enter(0)}
        aria-hidden='true'
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '16px',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--primary)',
          background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
          border: '1px solid color-mix(in srgb, var(--primary) 18%, transparent)',
          marginBottom: '6px',
        }}
      >
        <SparkleIcon size={24} />
      </motion.div>

      <motion.div
        {...enter(0.05)}
        style={{
          fontSize: '17px',
          fontWeight: 600,
          color: 'var(--foreground)',
          lineHeight: 1.3,
          letterSpacing: '-0.01em',
        }}
      >
        {siteName ? `Ask AI about ${siteName}` : 'Ask AI about these docs'}
      </motion.div>

      <motion.div
        {...enter(0.1)}
        style={{
          fontSize: '13px',
          color: 'var(--muted-foreground)',
          lineHeight: 1.5,
          maxWidth: '300px',
        }}
      >
        Answers come straight from the documentation. I can explain
        concepts, find examples, and take you to the right page.
      </motion.div>

      <motion.div
        {...enter(0.16)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '2px',
          marginTop: '14px',
          // Suggestion pills have 12px horizontal padding for the hover bg;
          // pull the column left so their text aligns with the title above.
          marginLeft: '-12px',
        }}
      >
        {suggestions.slice(0, 4).map((text) => (
          <button
            key={text}
            type='button'
            onClick={(e) => {
              e.stopPropagation()
              handleSuggestion(text)
            }}
            className='holocron-chat-suggestion'
          >
            <span>{text.replace(/(\.\.\.|…)\s*$/, '…')}</span>
            <ArrowRightIcon size={11} />
          </button>
        ))}
      </motion.div>
    </div>
  )
}
