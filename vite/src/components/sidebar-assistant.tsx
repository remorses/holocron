'use client'

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Link } from './link.tsx'
import { useSyncExternalStore } from 'react'
import { chatStore, CHAT_LAYOUT_ID, CHAT_LAYOUT_TRANSITION, type ChatState } from '../chat/chat-store.ts'

function useChatStore<T>(selector: (s: ChatState) => T): T {
  return useSyncExternalStore(chatStore.subscribe, () => selector(chatStore.getState()), () => selector(chatStore.getState()))
}
import { useHolocronData } from '../router.ts'
import { collectAllPages, isVisibleNavPage } from '../navigation.ts'
import { cn } from '../lib/css-vars.ts'
import {
  InfoCircleIcon,
  CopyIcon,
  CheckIcon,
} from '../chat/chat-icons.tsx'

// Re-export from chat/ so existing consumers don't break
export { ChatInput, hideChildrenForSnapshot, NavTooltip } from '../chat/chat-input.tsx'
export type { ChatInputProps } from '../chat/chat-input.tsx'

// Import for local use
import { ChatInput } from '../chat/chat-input.tsx'
import { ensureSessionRestored } from '../chat/chat-submit.ts'

// ── Sidebar assistant (wraps ChatInput with muted header) ────────────

export function SidebarAssistant() {
  // Local state so the widget keeps its value even after the drawer
  // submits and clears draftText. We sync TO the store on every change
  // so the drawer can read it, but never read back from the store.
  const [inputValue, setInputValue] = useState('')
  const drawerState = useChatStore((s) => s.drawerState)
  const reduceMotion = useReducedMotion()

  const {site } = useHolocronData()
  const handleChange = (value: string) => {
    setInputValue(value)
    chatStore.setState({ draftText: value })
  }

  const handleSubmit = () => {
    const text = inputValue.trim()
    if (!text) return
    chatStore.setState({ draftText: text, pendingSubmit: true, drawerState: 'open' })
  }

  const handleFocus = () => {
    // Read the store lazily on focus instead of subscribing during render.
    // This keeps the sidebar input SSR-safe in the RSC page shell while
    // preserving the "reopen existing chat" behavior on the client.
    if (chatStore.getState().messages.length > 0) {
      chatStore.setState({ drawerState: 'open' })
      return
    }
    // After a page refresh the store is empty but a persisted conversation
    // may exist server-side. Restore lazily on first focus and reopen the
    // drawer if a conversation came back (mirrors the in-memory behavior).
    void ensureSessionRestored().then(() => {
      if (
        chatStore.getState().messages.length > 0 &&
        chatStore.getState().drawerState === 'closed'
      ) {
        chatStore.setState({ drawerState: 'open' })
      }
    })
  }

  // Unmount while drawer is open so layoutId can morph into the drawer shell.
  // Keep a same-size placeholder so the aside does not jump.
  if (drawerState === 'open') {
    return (
      <div
        className='hidden lg:block w-full rounded-2xl bg-accent px-0.5 pt-px pb-0.5 opacity-0 pointer-events-none'
        aria-hidden
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
          value=''
          onChange={() => {}}
          onSubmit={() => {}}
          placeholder={`what is ${site.config?.name || 'this page'}?`}
        />
      </div>
    )
  }

  return (
    <motion.div
      className='hidden lg:block w-full rounded-2xl bg-accent px-0.5 pt-px pb-0.5'
      layoutId={CHAT_LAYOUT_ID}
      layout
      transition={reduceMotion ? { duration: 0 } : { layout: CHAT_LAYOUT_TRANSITION }}
      style={{ borderRadius: 16 }}
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
    </motion.div>
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

import { NavTooltip } from '../chat/chat-input.tsx'

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
