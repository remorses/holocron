'use client'

/**
 * ChatPill — fin.ai-style textarea pill, the default trigger for the
 * standalone ChatWidget (widget mode only; docs mode keeps SidebarAssistant).
 *
 * Morphs into ChatDrawer via Motion layoutId. Unmounts while the drawer is
 * open so Motion can project the shared layout between the two shells
 * (visibility/display toggles do not produce a layout morph).
 */

import React, { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  chatStore,
  CHAT_LAYOUT_ID,
  CHAT_LAYOUT_TRANSITION,
} from './chat-store.ts'
import { ensureSessionRestored } from './chat-submit.ts'
import { ArrowUpIcon } from './chat-icons.tsx'

const getDrawerState = () => chatStore.getState().drawerState

export function ChatPill({ placeholder = 'How can I help?' }: { placeholder?: string }) {
  const [inputValue, setInputValue] = useState('')
  const [focused, setFocused] = useState(false)
  const drawerState = useSyncExternalStore(chatStore.subscribe, getDrawerState, getDrawerState)
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

  // Unmount while drawer is open — required for layoutId shared-element morph.
  if (drawerState === 'open') return null

  const hasText = inputValue.trim().length > 0
  const expanded = focused || inputValue.length > 0

  const pillRef = useRef<HTMLDivElement>(null)

  return (
    <motion.div
      ref={pillRef}
      className='holocron-chat-pill'
      data-expanded={expanded ? '' : undefined}
      layoutId={CHAT_LAYOUT_ID}
      layout='position'
      layoutDependency={drawerState}
      transition={reduceMotion ? { duration: 0 } : { layout: CHAT_LAYOUT_TRANSITION }}

      style={{ borderRadius: 24 }}
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
    </motion.div>
  )
}
