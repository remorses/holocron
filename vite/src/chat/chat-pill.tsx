'use client'

/**
 * ChatPill — fin.ai-style textarea pill, the default trigger for the
 * standalone ChatWidget (widget mode only; docs mode keeps SidebarAssistant).
 *
 * A fixed pill (bottom-right on desktop, bottom-center on mobile) containing
 * a single-row textarea and a circular send button. On focus the pill widens
 * with a CSS width transition (fin.ai uses the same 0.35s cubic-bezier width
 * transition, measured on their site). On submit the pill morphs into the
 * ChatDrawer panel via the shared holocron-chat-container view transition —
 * the exact same morph the docs sidebar assistant does.
 *
 * Measured fin.ai specs replicated here:
 * - collapsed 300×48px, expanded 544px, radius 24px (full pill)
 * - transition: width 0.35s cubic-bezier(0.22, 0.61, 0.36, 1)
 * - surface: solid background + blur(10px) backdrop +
 *   shadow 0 -1px 0 /6%, 0 2px 6px /22%, 0 8px 18px /28%
 */

import React, { useRef, useState, useSyncExternalStore } from 'react'
import {
  chatStore,
  CHAT_CONTAINER_VT_NAME,
  withViewTransition,
} from './chat-store.ts'
import { ensureSessionRestored } from './chat-submit.ts'
import { hideChildrenForSnapshot } from './chat-input.tsx'
import { ArrowUpIcon } from './chat-icons.tsx'

// Module-level stable callbacks for useSyncExternalStore (see AGENTS.md rules)
const getDrawerState = () => chatStore.getState().drawerState

// ── ChatPill ─────────────────────────────────────────────────────────
//
// The ::view-transition-* animation rules ship inside the chat CSS bundle
// (kept unscoped by scripts/bundle-chat-css.ts) which ChatHost injects into
// document.head — the widget renders in light DOM, so the pill and drawer
// participate in the document view transition directly.

export function ChatPill({ placeholder = 'How can I help?' }: { placeholder?: string }) {
  const [inputValue, setInputValue] = useState('')
  const [focused, setFocused] = useState(false)
  const drawerState = useSyncExternalStore(chatStore.subscribe, getDrawerState, getDrawerState)
  const pillRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    const text = inputValue.trim()
    if (!text) return
    setInputValue('')
    textareaRef.current?.blur()
    withViewTransition(
      () => {
        chatStore.setState({ draftText: text, pendingSubmit: true, drawerState: 'open' })
      },
      () => hideChildrenForSnapshot(pillRef.current),
    )
  }

  const openDrawerIfConversationExists = () => {
    if (chatStore.getState().messages.length > 0) {
      withViewTransition(
        () => { chatStore.setState({ drawerState: 'open' }) },
        () => hideChildrenForSnapshot(pillRef.current),
      )
      return
    }
    // After a page refresh the store is empty but a persisted conversation
    // may exist server-side. Restore lazily on first focus and reopen the
    // drawer if a conversation came back (mirrors SidebarAssistant).
    void ensureSessionRestored().then(() => {
      if (
        chatStore.getState().messages.length > 0 &&
        chatStore.getState().drawerState === 'closed'
      ) {
        withViewTransition(
          () => { chatStore.setState({ drawerState: 'open' }) },
          () => hideChildrenForSnapshot(pillRef.current),
        )
      }
    })
  }

  const handleFocus = () => {
    setFocused(true)
    openDrawerIfConversationExists()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      textareaRef.current?.blur()
    }
  }

  // Pill owns the view-transition-name only when the drawer is closed.
  // When open, the drawer panel owns it (same handoff as SidebarAssistant).
  const isDrawerOpen = drawerState === 'open'
  const hasText = inputValue.trim().length > 0
  const expanded = focused || inputValue.length > 0

  return (
    <div
      ref={pillRef}
      className='holocron-chat-pill'
      data-expanded={expanded ? '' : undefined}
      style={{
        viewTransitionName: isDrawerOpen ? 'none' : CHAT_CONTAINER_VT_NAME,
        visibility: isDrawerOpen ? 'hidden' : 'visible',
      } as React.CSSProperties}
    >
      <div className='holocron-chat-pill-surface flex items-end gap-2 rounded-[24px] bg-background py-1.5 pr-1.5 pl-5'>
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            chatStore.setState({ draftText: e.target.value })
          }}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          aria-label='Ask AI'
          rows={1}
          className='w-full resize-none self-center border-0 bg-transparent py-2 text-sm leading-5 text-foreground placeholder:text-muted-foreground/75 outline-none [field-sizing:content] min-h-5 max-h-40'
        />
        <button
          type='button'
          onClick={handleSubmit}
          disabled={!hasText}
          aria-label='Send message'
          className={`flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors ${
            hasText
              ? 'bg-foreground text-background'
              : 'bg-foreground/[0.06] text-muted-foreground/60'
          }`}
        >
          <ArrowUpIcon size={14} />
        </button>
      </div>
    </div>
  )
}
