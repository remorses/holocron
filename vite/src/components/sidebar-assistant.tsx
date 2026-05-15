'use client'

import React, { useState, useRef, useMemo, useCallback } from 'react'
import { Link } from 'spiceflow/react'
import { chatState } from '../lib/chat-state.ts'
import { useHolocronData } from '../router.ts'
import { collectAllPages, isVisibleNavPage } from '../navigation.ts'
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
  // Local state so the widget keeps its value even after the drawer
  // submits and clears draftText. We sync TO the store on every change
  // so the drawer can read it, but never read back from the store.
  const [inputValue, setInputValue] = useState('')

  const handleChange = (value: string) => {
    setInputValue(value)
    chatState.setState({ draftText: value })
  }

  const handleSubmit = () => {
    const text = inputValue.trim()
    if (!text) return
    chatState.setState({ draftText: text, pendingSubmit: true, drawerState: 'open' })
  }

  const handleFocus = () => {
    // Read the store lazily on focus instead of subscribing during render.
    // This keeps the sidebar input SSR-safe in the RSC page shell while
    // preserving the "reopen existing chat" behavior on the client.
    // Sync current local value to draftText so the drawer shows it.
    if (chatState.getState().messages.length > 0) {
      chatState.setState({ drawerState: 'open' })
    }
  }

  return (
    <div className='hidden lg:block w-full rounded-2xl bg-accent px-0.5 pt-px pb-0.5'>
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
        onChange={handleChange}
        onSubmit={handleSubmit}
        onFocus={handleFocus}
        placeholder='How can I help?'
      />
    </div>
  )
}

// ── Page navigation row (copy MD + prev/next arrows) ─────────────────
//
// Injected into the right aside alongside the AI assistant widget.
// Shows a "Copy as MD" button and chevron arrows for prev/next page
// navigation based on the navigation tree order.

function ChevronLeftIcon() {
  return (
    <svg aria-hidden='true' viewBox='0 0 16 16' width='14' height='14' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M10 4l-4 4 4 4' />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden='true' viewBox='0 0 16 16' width='14' height='14' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M6 4l4 4-4 4' />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg aria-hidden='true' viewBox='0 0 16 16' width='13' height='13' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
      <rect x='5' y='5' width='9' height='9' rx='1.5' />
      <path d='M2 11V2.5A.5.5 0 012.5 2H11' />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg aria-hidden='true' viewBox='0 0 16 16' width='13' height='13' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round'>
      <path d='M3 8.5l3.5 3.5 6.5-8' />
    </svg>
  )
}

export function PageNavRow() {
  const { site, currentPageHref } = useHolocronData()
  const [copied, setCopied] = useState(false)

  const { prevPage, nextPage } = useMemo(() => {
    const allPages = collectAllPages(site.navigation).filter(isVisibleNavPage)
    const idx = allPages.findIndex((p) => p.href === currentPageHref)
    return {
      prevPage: idx > 0 ? allPages[idx - 1] : undefined,
      nextPage: idx >= 0 && idx < allPages.length - 1 ? allPages[idx + 1] : undefined,
    }
  }, [site.navigation, currentPageHref])

  const handleCopyMd = useCallback(async () => {
    if (copied) return
    try {
      const url = window.location.pathname + '.md'
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch ${url}`)
      const text = await res.text()
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy markdown:', err)
    }
  }, [copied])

  const basePath = site.base === '/' ? '' : `/${site.base.replace(/^\/+|\/+$/g, '')}`

  return (
    <div className='hidden lg:flex items-center gap-1.5 w-full'>
      <button
        onClick={handleCopyMd}
        className='inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent cursor-pointer'
        title='Copy page as Markdown'
      >
        <span>{copied ? 'Copied' : 'Copy as Markdown'}</span>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>

      <div className='grow' />

      {prevPage ? (
        <Link
          href={basePath + prevPage.href}
          className='no-underline inline-flex items-center justify-center size-6 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent'
          title={prevPage.title}
        >
          <ChevronLeftIcon />
        </Link>
      ) : (
        <span className='inline-flex items-center justify-center size-6 text-muted-foreground/30'>
          <ChevronLeftIcon />
        </span>
      )}

      {nextPage ? (
        <Link
          href={basePath + nextPage.href}
          className='no-underline inline-flex items-center justify-center size-6 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent'
          title={nextPage.title}
        >
          <ChevronRightIcon />
        </Link>
      ) : (
        <span className='inline-flex items-center justify-center size-6 text-muted-foreground/30'>
          <ChevronRightIcon />
        </span>
      )}
    </div>
  )
}
