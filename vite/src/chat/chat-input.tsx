'use client'

/**
 * Chat input components extracted for reuse in both the holocron sidebar
 * widget and the standalone ChatWidget.
 *
 * - ChatInput: textarea + send/stop button
 * - NavTooltip: portal-based tooltip (used by chat message footer)
 * - hideChildrenForSnapshot: helper for view transition snapshots
 */

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
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

// ── View transition snapshot helper ──────────────────────────────────

/** Hide children so the VT snapshot is a solid-color rectangle. */
export function hideChildrenForSnapshot(el: HTMLElement | null): (() => void) | void {
  if (!el) return
  const children = Array.from(el.children) as HTMLElement[]
  for (const child of children) child.style.visibility = 'hidden'
  return () => {
    for (const child of children) child.style.visibility = ''
  }
}

// ── NavTooltip ───────────────────────────────────────────────────────
//
// Portal-based tooltip used in chat message footers (copy/regenerate).
// Accepts an optional portalTarget; defaults to document.body.

export function NavTooltip({ label, children, position = 'above', portalTarget }: { label: string; children: React.ReactNode; position?: 'above' | 'below'; portalTarget?: HTMLElement | null }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      top: position === 'below'
        ? rect.bottom + 6
        : rect.top - 6,
      left: rect.left + rect.width / 2,
    })
  }, [open, position])

  const target = portalTarget ?? (typeof document !== 'undefined' ? document.body : null)

  return (
    <span
      ref={triggerRef}
      className='inline-flex'
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && target && createPortal(
        <span
          className={`fixed -translate-x-1/2 whitespace-nowrap rounded-md border border-border-subtle bg-card px-2 py-1 text-[11px] text-foreground shadow-md pointer-events-none ${position === 'below' ? '' : '-translate-y-full'}`}
          role='tooltip'
          style={{ top: pos.top, left: pos.left, zIndex: 300 }}
        >
          {label}
        </span>,
        target,
      )}
    </span>
  )
}
