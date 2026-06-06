'use client'

import React, { useState, useRef, useMemo, useCallback, useEffect, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link } from './link.tsx'
import { chatState } from '../lib/chat-state.ts'
import { CHAT_CONTAINER_VT_NAME, withViewTransition } from '../lib/chat-store.ts'
import { useHolocronData } from '../router.ts'
import { collectAllPages, isVisibleNavPage } from '../navigation.ts'
import { cn } from '../lib/css-vars.ts'
import {
  InfoCircleIcon,
  ArrowUpIcon,
  StopSquareIcon,
  CopyIcon,
  CheckIcon,
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
    <div className={`bg-background rounded-xl p-2 flex flex-col gap-1.5 ${className || ''}`}>
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
        className={`w-full resize-none border-0 bg-transparent leading-5 text-foreground placeholder:text-muted-foreground/75 outline-none [field-sizing:content] min-h-5 max-h-40 ${textClassName || 'text-sm'}`}
      />
      <div className='flex items-center justify-end' onClick={() => inputRef.current?.focus()}>
        {isGenerating ? (
          <button
            type='button'
            onClick={handleButtonClick}
            className='flex items-center justify-center w-6 h-6 rounded-md transition-colors bg-foreground/[0.06] text-muted-foreground/50 hover:bg-foreground/[0.12]'
            aria-label='Stop generating'
          >
            <StopSquareIcon />
          </button>
        ) : (
          <button
            type='button'
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

/** Hide children so the VT snapshot is a solid-color rectangle. */
export function hideChildrenForSnapshot(el: HTMLElement | null): (() => void) | void {
  if (!el) return
  const children = Array.from(el.children) as HTMLElement[]
  for (const child of children) child.style.visibility = 'hidden'
  return () => {
    for (const child of children) child.style.visibility = ''
  }
}

export function SidebarAssistant() {
  // Local state so the widget keeps its value even after the drawer
  // submits and clears draftText. We sync TO the store on every change
  // so the drawer can read it, but never read back from the store.
  const [inputValue, setInputValue] = useState('')
  const drawerState = chatState((s) => s.drawerState)
  const widgetRef = useRef<HTMLDivElement>(null)

  const {site } = useHolocronData()
  const handleChange = (value: string) => {
    setInputValue(value)
    chatState.setState({ draftText: value })
  }

  const handleSubmit = () => {
    const text = inputValue.trim()
    if (!text) return
    withViewTransition(
      () => { chatState.setState({ draftText: text, pendingSubmit: true, drawerState: 'open' }) },
      () => hideChildrenForSnapshot(widgetRef.current),
    )
  }

  const handleFocus = () => {
    // Read the store lazily on focus instead of subscribing during render.
    // This keeps the sidebar input SSR-safe in the RSC page shell while
    // preserving the "reopen existing chat" behavior on the client.
    if (chatState.getState().messages.length > 0) {
      withViewTransition(
        () => { chatState.setState({ drawerState: 'open' }) },
        () => hideChildrenForSnapshot(widgetRef.current),
      )
    }
  }

  // Sidebar owns the view-transition-name only when drawer is closed.
  // When drawer is open, the drawer footer owns it instead.
  // Also hide the sidebar input when the drawer is open so only one
  // textarea is visible — the view transition already captured the old
  // snapshot before this state update commits.
  const isDrawerOpen = drawerState === 'open'
  const vtName = isDrawerOpen ? 'none' : CHAT_CONTAINER_VT_NAME

  return (
    <div
      ref={widgetRef}
      className='hidden lg:block w-full rounded-2xl bg-accent px-0.5 pt-px pb-0.5'
      style={{
        viewTransitionName: vtName,
        visibility: isDrawerOpen ? 'hidden' : 'visible',
      } as React.CSSProperties}
    >
      <div className='flex items-center gap-1.5 px-2.5 py-1.5'>
        <span className='text-muted-foreground shrink-0'>
          <InfoCircleIcon />
        </span>
        <span className='text-[11px] font-medium text-muted-foreground'>
          Ask AI about this page
        </span>
      </div>
      <ChatInput
        value={inputValue}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onFocus={handleFocus}
        placeholder={`what is ${site.config?.name || 'this page'}?`}
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

export function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      top: rect.top + window.scrollY - 6,
      left: rect.left + rect.width / 2 + window.scrollX,
    })
  }, [open])

  return (
    <span
      ref={triggerRef}
      className='inline-flex'
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && typeof document !== 'undefined' && createPortal(
        <span
          className='fixed -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border-subtle bg-card px-2 py-1 text-[11px] text-foreground shadow-md pointer-events-none'
          role='tooltip'
          style={{ top: pos.top, left: pos.left, zIndex: 300 }}
        >
          {label}
        </span>,
        document.body,
      )}
    </span>
  )
}

export function PageNavRow() {
  const { site, currentPageHref } = useHolocronData()
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const { prevPage, nextPage } = useMemo(() => {
    const allPages = collectAllPages(site.navigation).filter(isVisibleNavPage)
    const idx = allPages.findIndex((p) => p.href === currentPageHref)
    return {
      prevPage: idx > 0 ? allPages[idx - 1] : undefined,
      nextPage: idx >= 0 && idx < allPages.length - 1 ? allPages[idx + 1] : undefined,
    }
  }, [site.navigation, currentPageHref])

  const handleCopyMd = useCallback(async () => {
    if (copied || isLoading) return
    setIsLoading(true)
    try {
      // For `/` or paths ending with `/`, append `index.md` instead of `.md`
      // so the request hits the correct server route (e.g. `/index.md`).
      const pathname = window.location.pathname
      const url = pathname === '/' || pathname.endsWith('/')
        ? pathname + 'index.md'
        : pathname + '.md'
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch ${url}`)
      const text = await res.text()
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy markdown:', err)
    } finally {
      setIsLoading(false)
    }
  }, [copied, isLoading])

  return (
    <div className='hidden lg:flex items-center gap-1.5 w-full'>
      <button
        type='button'
        onClick={handleCopyMd}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent cursor-pointer',
          isLoading && 'opacity-50 animate-pulse',
        )}
        title='Copy page as Markdown'
      >
        <span>{copied ? 'Copied' : 'Copy as Markdown'}</span>
        {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      </button>

      <div className='grow' />

      {prevPage ? (
        <NavTooltip label={prevPage.title}>
          <Link
            href={prevPage.href}
            className='no-underline inline-flex items-center justify-center size-6 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent'
          >
            <ChevronLeftIcon />
          </Link>
        </NavTooltip>
      ) : (
        <span className='inline-flex items-center justify-center size-6 text-muted-foreground/30'>
          <ChevronLeftIcon />
        </span>
      )}

      {nextPage ? (
        <NavTooltip label={nextPage.title}>
          <Link
            href={nextPage.href}
            className='no-underline inline-flex items-center justify-center size-6 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent'
          >
            <ChevronRightIcon />
          </Link>
        </NavTooltip>
      ) : (
        <span className='inline-flex items-center justify-center size-6 text-muted-foreground/30'>
          <ChevronRightIcon />
        </span>
      )}
    </div>
  )
}
