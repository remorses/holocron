'use client'

import React, { useState, useRef } from 'react'
import { chatState } from '../lib/chat-state.ts'
import {
  InfoCircleIcon,
  ArrowUpIcon,
  StopSquareIcon,
} from './chat-icons.tsx'

// ── Reusable chat input (textarea + send/stop button) ────────────────
//
// Used by SidebarAssistant (in the right aside) and by the ChatDrawer
// footer. Same visual: bg-background rounded card with textarea and
// arrow-up send button that toggles to a square stop button during
// generation.

export type ChatInputProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop?: () => void
  onFocus?: () => void
  isGenerating?: boolean
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  textClassName?: string
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  onFocus,
  isGenerating,
  placeholder = 'How can I help?',
  disabled,
  autoFocus,
  className,
  textClassName,
  textareaRef,
}: ChatInputProps) {
  const localRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = textareaRef || localRef

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isGenerating) {
        onStop?.()
      } else if (value.trim()) {
        onSubmit()
      }
    }
  }

  const handleButtonClick = () => {
    if (isGenerating) {
      onStop?.()
    } else {
      onSubmit()
    }
  }

  return (
    <div className={`bg-background rounded-[15px] p-2 flex flex-col gap-1.5 ${className || ''}`}>
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        rows={1}
        className={`w-full resize-none border-0 bg-transparent leading-5 text-foreground placeholder:text-muted-foreground/50 outline-none [field-sizing:content] min-h-5 max-h-40 ${textClassName || 'text-xs'}`}
      />
      <div className='flex items-center justify-end' onClick={() => inputRef.current?.focus()}>
        {isGenerating ? (
          <button
            onClick={handleButtonClick}
            className='flex items-center justify-center w-6 h-6 rounded-md transition-colors bg-foreground/[0.06] text-muted-foreground/50 hover:bg-foreground/[0.12]'
            aria-label='Stop generating'
          >
            <StopSquareIcon />
          </button>
        ) : (
          <button
            onClick={handleButtonClick}
            disabled={disabled || !value.trim()}
            className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
              value.trim()
                ? 'bg-foreground text-background'
                : 'bg-foreground/[0.06] text-muted-foreground/50'
            }`}
            aria-label='Send message'
          >
            <ArrowUpIcon />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Sidebar assistant (wraps ChatInput with muted header) ────────────

export function SidebarAssistant() {
  const [inputValue, setInputValue] = useState('')

  const handleSubmit = () => {
    const text = inputValue.trim()
    if (!text) return
    chatState.setState({ draftText: text, drawerState: 'open' })
    setInputValue('')
  }

  const handleFocus = () => {
    // Read the store lazily on focus instead of subscribing during render.
    // This keeps the sidebar input SSR-safe in the RSC page shell while
    // preserving the "reopen existing chat" behavior on the client.
    if (chatState.getState().parts.length > 0) {
      chatState.setState({ drawerState: 'open' })
    }
  }

  return (
    <div className='w-full rounded-2xl bg-foreground/8 px-0.5 pt-px pb-0.5'>
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
        onFocus={handleFocus}
        placeholder='How can I help?'
      />
    </div>
  )
}
