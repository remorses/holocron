'use client'

import React, { useState, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Link } from './link.tsx'
import { useSyncExternalStore } from 'react'
import {
  chatStore,
  chatShellLayoutId,
  CHAT_LAYOUT_COLLAPSE,
  CHAT_CONTENT_ENTER,
  CHAT_CONTENT_EXIT,
  type ChatState,
} from '../chat/chat-store.ts'

function useChatStore<T>(selector: (s: ChatState) => T): T {
  return useSyncExternalStore(chatStore.subscribe, () => selector(chatStore.getState()), () => selector(chatStore.getState()))
}
import { useHolocronData } from '../router.ts'
import { collectAllPages, isVisibleNavPage } from '../navigation.ts'
import { cn } from '../lib/css-vars.ts'
import {
  InfoCircleIcon,
  MessageCircleIcon,
  CopyIcon,
  CheckIcon,
} from '../chat/chat-icons.tsx'

// Re-export from chat/ so existing consumers don't break
export { ChatInput, hideChildrenForSnapshot, NavTooltip } from '../chat/chat-input.tsx'
export type { ChatInputProps } from '../chat/chat-input.tsx'

// Import for local use
import { ChatInput } from '../chat/chat-input.tsx'
import { chatWidgetStore } from '../chat/chat-widget-store.ts'
import { ensureSessionRestored, hasPersistedChat } from '../chat/chat-submit.ts'

const getServerHasExistingChat = () => false

function subscribeExistingChat(cb: () => void) {
  const unsubChat = chatStore.subscribe(cb)
  const unsubWidget = chatWidgetStore.subscribe(cb)
  return () => {
    unsubChat()
    unsubWidget()
  }
}

// ── Sidebar assistant (wraps ChatInput with muted header) ────────────

export function SidebarAssistant() {
  // Local state so the widget keeps its value even after the drawer
  // submits and clears draftText. We sync TO the store on every change
  // so the drawer can read it, but never read back from the store.
  const [inputValue, setInputValue] = useState('')
  const drawerState = useChatStore((s) => s.drawerState)
  const hasExistingChat = useSyncExternalStore(
    subscribeExistingChat,
    hasPersistedChat,
    getServerHasExistingChat,
  )
  const reduceMotion = useReducedMotion()

  const { site, currentPageHref } = useHolocronData()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const handleChange = (value: string) => {
    setInputValue(value)
    chatStore.setState({ draftText: value })
  }

  const handleSubmit = () => {
    const text = inputValue.trim()
    if (!text) return
    setInputValue('')
    chatStore.setState({ draftText: text, pendingSubmit: true, drawerState: 'open' })
  }

  const openExistingChat = () => {
    chatStore.setState({ drawerState: 'open' })
    void ensureSessionRestored()
  }

  // Stay mounted + inert while open. Opaque mix, not bg-accent (accent is rgba).
  const isDrawerOpen = drawerState === 'open'
  return (
    <motion.div
      ref={sidebarRef}
      className='hidden lg:block w-full overflow-hidden rounded-2xl'
      data-chat-shell='sidebar'
      layoutId={chatShellLayoutId(currentPageHref || '/')}
      transition={reduceMotion ? { duration: 0 } : { layout: CHAT_LAYOUT_COLLAPSE }}
      inert={isDrawerOpen}
      style={{
        borderRadius: 16,
        backgroundColor: 'color-mix(in srgb, var(--foreground) 8%, var(--background))',
      }}
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
        className='px-0.5 pt-px pb-0.5'
      >
        <div className='flex items-center gap-1.5 px-2.5 py-1.5'>
          {hasExistingChat ? (
            <button
              type='button'
              onClick={openExistingChat}
              className='flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground cursor-pointer'
            >
              <span className='shrink-0'>
                <MessageCircleIcon />
              </span>
              <span className='underline underline-offset-2'>Open existing chat</span>
            </button>
          ) : (
            <>
              <span className='text-muted-foreground shrink-0'>
                <InfoCircleIcon />
              </span>
              <span className='text-[11px] font-medium text-muted-foreground'>
                Ask AI about this page
              </span>
            </>
          )}
        </div>
        <ChatInput
          value={inputValue}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder={`what is ${site.config?.name || 'this page'}?`}
          // Concentric radius: outer frame is 16px with a 2px gap → 14px keeps
          // the accent ring visually uniform around the corners.
          className='rounded-[14px]'
        />
      </motion.div>
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
          'inline-flex items-center gap-1.5 rounded-md -ml-2 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent cursor-pointer',
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
