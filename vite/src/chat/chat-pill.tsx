'use client'

/**
 * ChatPill — widget-mode trigger. Carries the chat shell part while closed so
 * setChatDrawerState() morphs it into the drawer.
 */

import React, { useRef, useState, useSyncExternalStore } from 'react'
import { chatStore, setChatDrawerState, preloadChatDrawer, CHAT_SHELL_PART } from './chat-store.ts'
import { ArrowUpIcon } from './chat-icons.tsx'

const getDrawerState = () => chatStore.getState().drawerState

export function ChatPill({ placeholder = 'How can I help?' }: { placeholder?: string }) {
  const [inputValue, setInputValue] = useState('')
  const [focused, setFocused] = useState(false)
  const drawerState = useSyncExternalStore(chatStore.subscribe, getDrawerState, getDrawerState)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = () => {
    const text = inputValue.trim()
    if (!text) return
    setInputValue('')
    textareaRef.current?.blur()
    setChatDrawerState('open', { draftText: text, pendingSubmit: true })
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

  const hasText = inputValue.trim().length > 0
  const expanded = focused || inputValue.length > 0
  const isDrawerOpen = drawerState === 'open'

  // Stays mounted + inert while open; the drawer owns the shell part then, so
  // setChatDrawerState() morphs between the two.
  return (
    <div
      className='holocron-chat-pill'
      data-chat-shell='pill'
      data-expanded={expanded ? '' : undefined}
      part={isDrawerOpen ? undefined : CHAT_SHELL_PART}
      inert={isDrawerOpen}
      onPointerEnter={preloadChatDrawer}
      onFocus={preloadChatDrawer}
    >
      <div
        className='holocron-chat-pill-content flex items-end gap-2 py-1.5 pr-1.5 pl-5'
        style={{ opacity: isDrawerOpen ? 0 : 1 }}
      >
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            chatStore.setState({ draftText: e.target.value })
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
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
      </div>
    </div>
  )
}
