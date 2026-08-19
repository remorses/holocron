'use client'

/**
 * ChatPill — widget-mode trigger. Outer shell owns layoutId; inner `layout` child counter-scales.
 */

import React, { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  chatStore,
  chatShellLayoutId,
  CHAT_LAYOUT_COLLAPSE,
  CHAT_CONTENT_ENTER,
  CHAT_CONTENT_EXIT,
} from './chat-store.ts'
import { chatWidgetStore } from './chat-widget-store.ts'
import { ensureSessionRestored } from './chat-submit.ts'
import { ArrowUpIcon } from './chat-icons.tsx'

const getDrawerState = () => chatStore.getState().drawerState
const getChatPageKey = () => chatWidgetStore.getState().currentSlug || '/'

export function ChatPill({ placeholder = 'How can I help?' }: { placeholder?: string }) {
  const [inputValue, setInputValue] = useState('')
  const [focused, setFocused] = useState(false)
  const drawerState = useSyncExternalStore(chatStore.subscribe, getDrawerState, getDrawerState)
  const pageKey = useSyncExternalStore(chatWidgetStore.subscribe, getChatPageKey, getChatPageKey)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const reduceMotion = useReducedMotion()

  const handleSubmit = () => {
    const text = inputValue.trim()
    if (!text) return
    setInputValue('')
    textareaRef.current?.blur()
    chatStore.setState({ draftText: text, pendingSubmit: true, drawerState: 'open' })
  }

  const openDrawerIfConversationExists = () => {
    if (chatStore.getState().messages.length > 0) {
      chatStore.setState({ drawerState: 'open' })
      return
    }
    void ensureSessionRestored().then(() => {
      if (
        chatStore.getState().messages.length > 0 &&
        chatStore.getState().drawerState === 'closed'
      ) {
        chatStore.setState({ drawerState: 'open' })
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

  const pillRef = useRef<HTMLDivElement>(null)

  const hasText = inputValue.trim().length > 0
  const expanded = focused || inputValue.length > 0
  const isDrawerOpen = drawerState === 'open'

  // Stay mounted + inert while open so close can morph back. visibility:hidden kills the crossfade.
  return (
    <motion.div
      ref={pillRef}
      className='holocron-chat-pill'
      data-chat-shell='pill'
      data-expanded={expanded ? '' : undefined}
      layoutId={chatShellLayoutId(pageKey)}
      transition={reduceMotion ? { duration: 0 } : { layout: CHAT_LAYOUT_COLLAPSE }}
      inert={isDrawerOpen}
      style={{ borderRadius: 24 }}
    >
      <motion.div
        layout
        animate={{ opacity: isDrawerOpen ? 0 : 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : isDrawerOpen
              ? CHAT_CONTENT_EXIT
              : CHAT_CONTENT_ENTER
        }
        className='holocron-chat-pill-content flex items-end gap-2 py-1.5 pr-1.5 pl-5'
      >
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
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <ArrowUpIcon size={14} />
        </button>
      </motion.div>
    </motion.div>
  )
}
