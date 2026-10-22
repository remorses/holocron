'use client'

import React, { useState, useCallback } from 'react'
import { useSyncExternalStore } from 'react'
import {
  chatStore,
  setChatDrawerState,
  preloadChatDrawer,
  CHAT_SHELL_PART,
  type ChatState,
} from '../chat/chat-store.ts'

function useChatStore<T>(selector: (s: ChatState) => T): T {
  return useSyncExternalStore(chatStore.subscribe, () => selector(chatStore.getState()), () => selector(chatStore.getState()))
}
import { useHolocronData } from '../router.ts'
import { cn } from '../lib/css-vars.ts'
import { withBasePath } from '../lib/holocron-url.ts'
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
  const { site } = useHolocronData()
  const handleChange = (value: string) => {
    setInputValue(value)
    chatStore.setState({ draftText: value })
  }

  const handleSubmit = () => {
    const text = inputValue.trim()
    if (!text) return
    setInputValue('')
    setChatDrawerState('open', { draftText: text, pendingSubmit: true })
  }

  const openExistingChat = () => {
    setChatDrawerState('open')
    void ensureSessionRestored()
  }

  // Stays mounted + inert while open; the drawer owns the shell part then, so
  // setChatDrawerState() morphs between the two. Opaque mix, not bg-accent (accent is rgba).
  const isDrawerOpen = drawerState === 'open'
  return (
    <div
      className='hidden lg:block w-full overflow-hidden rounded-2xl'
      data-chat-shell='sidebar'
      part={isDrawerOpen ? undefined : CHAT_SHELL_PART}
      inert={isDrawerOpen}
      onPointerEnter={preloadChatDrawer}
      onFocus={preloadChatDrawer}
      style={{
        borderRadius: 16,
        backgroundColor: 'var(--background)',
      }}
    >
      <div
        className='px-0.5 pt-px pb-0.5'
        style={{
          opacity: isDrawerOpen ? 0 : 1,
          backgroundColor: 'color-mix(in srgb, var(--foreground) 8%, var(--background))',
        }}
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
      </div>
    </div>
  )
}

// ── Copy-page row (injected into the right aside under the AI widget)

export function PageNavRow() {
  const { currentPageFrontmatter } = useHolocronData()
  const openapiSpec = currentPageFrontmatter?.openapiSpec
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleCopy = useCallback(async () => {
    if (copied || isLoading) return
    setIsLoading(true)
    try {
      if (openapiSpec) {
        const url = new URL(withBasePath(openapiSpec), window.location.origin).toString()
        await navigator.clipboard.writeText(url)
      } else {
        // For `/` or paths ending with `/`, append `index.md` instead of `.md`
        // so the request hits the correct server route (e.g. `/index.md`).
        const pathname = window.location.pathname
        const url = pathname === '/' || pathname.endsWith('/')
          ? pathname + 'index.md'
          : pathname + '.md'
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to fetch ${url}`)
        await navigator.clipboard.writeText(await res.text())
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    } finally {
      setIsLoading(false)
    }
  }, [copied, isLoading, openapiSpec])

  const label = openapiSpec ? 'Copy OpenAPI schema URL' : 'Copy page as Markdown'

  return (
    <div className='hidden lg:flex items-center gap-1.5 w-full'>
      <button
        type='button'
        onClick={handleCopy}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md -ml-2 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent cursor-pointer',
          isLoading && 'opacity-50 animate-pulse',
        )}
        title={label}
      >
        <span>{copied ? 'Copied' : label}</span>
        {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      </button>
    </div>
  )
}
