'use client'

/**
 * FAQ list: divider-separated question rows that expand inline, plus an
 * optional trailing "ask" row that answers free-form questions with the AI
 * chat gateway. Answered questions are appended as regular rows so the list
 * keeps the same rhythm while the user asks more.
 *
 * Ask requests are ephemeral (no session, no history) so they never touch
 * the drawer conversation. See askEphemeralQuestion in chat-submit.ts.
 */

import React, { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/css-vars.ts'
import { useHolocronData } from '../../router.ts'
import { askEphemeralQuestion } from '../../chat/chat-submit.ts'
import type { ChatPart } from '../../chat/chat-store.ts'
import { ChatLoadingDots } from '../../chat/chat-message.tsx'
import { ArrowRightIcon } from '../../chat/chat-icons.tsx'
import { ExpandableContainer } from './expandable-container.tsx'

const ROW_CLASS = 'flex w-full items-center gap-4 py-4 text-left text-foreground'
const QUESTION_CLASS = 'min-w-0 flex-1 text-[15px] font-medium leading-snug'
// Chevron slot matches the ask button size so both icons share one center line.
const TRAILING_SLOT_CLASS = 'flex size-8 shrink-0 items-center justify-center'
const CHEVRON_CLASS = 'text-muted-foreground transition-transform duration-200 ease-out'
const BODY_CLASS = 'no-bleed flex flex-col gap-(--prose-gap) pb-5 pt-1'

function ChevronDown({ open }: { open: boolean }) {
  return (
    <span className={TRAILING_SLOT_CLASS}>
      <svg
        viewBox='0 0 16 16'
        width='16'
        height='16'
        fill='none'
        aria-hidden='true'
        className={cn(CHEVRON_CLASS, open && 'rotate-180')}
      >
        <path d='M4.5 6 8 9.5 11.5 6' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </span>
  )
}

/** Shared row chrome: question button + collapsible body. */
function FaqRow({
  question,
  open,
  onToggle,
  children,
}: {
  question: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const bodyId = useId()
  return (
    <div className='flex flex-col border-b border-border'>
      <button
        type='button'
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
        className={cn(ROW_CLASS, 'cursor-pointer')}
      >
        <span className={QUESTION_CLASS}>{question}</span>
        <ChevronDown open={open} />
      </button>
      <ExpandableContainer open={open}>
        <div id={bodyId} className={BODY_CLASS}>
          {children}
        </div>
      </ExpandableContainer>
    </div>
  )
}

export function FAQItem({
  question,
  title,
  defaultOpen = false,
  children,
}: {
  question?: React.ReactNode
  /** Alias of `question`. */
  title?: React.ReactNode
  defaultOpen?: boolean | string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen === true || defaultOpen === 'true')
  return (
    <FaqRow question={question ?? title} open={open} onToggle={() => setOpen((value) => !value)}>
      {children}
    </FaqRow>
  )
}

// ── AI-answered rows ──────────────────────────────────────────────────

type AskedItem = {
  id: number
  question: string
  parts: ChatPart[]
  status: 'loading' | 'done'
  error?: string
}

/** Everything a FAQ row shows. Successful tool calls stay hidden (the row is
 *  an answer, not a transcript) but tool errors must surface: a failed docs
 *  search with no follow-up text would otherwise leave the row blank.
 *  Notices that are the answer (rate limit, credit limit, errors) render;
 *  standing content such as the Holocron promotion never shows in a FAQ. */
function visibleParts(parts: ChatPart[]): ChatPart[] {
  return parts.filter((part) => {
    if (part.type === 'text') return true
    if (part.type === 'notice') return part.severity !== 'promotion' && part.display !== 'once'
    if (part.type === 'tool-result') return !!part.error
    return false
  })
}

const NO_ANSWER_MESSAGE = 'No response received. Please try again.'

function AskedRow({ item, open, onToggle }: { item: AskedItem; open: boolean; onToggle: () => void }) {
  const parts = visibleParts(item.parts)
  const hasAnswer = parts.length > 0 || !!item.error
  return (
    <FaqRow question={item.question} open={open} onToggle={onToggle}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <div key={index} className='flex min-w-0 flex-col gap-(--prose-gap)'>
              {part.jsx ?? part.text}
            </div>
          )
        }
        if (part.type === 'notice') {
          return (
            <div key={index} className='text-sm text-muted-foreground'>
              {part.title}
              {part.message ? `: ${part.message}` : ''}
            </div>
          )
        }
        if (part.type === 'tool-result') {
          return (
            <div key={index} className='text-sm text-red'>
              {part.error}
            </div>
          )
        }
        return null
      })}
      {item.error && <div className='text-sm text-red'>{item.error}</div>}
      {item.status === 'loading' && !hasAnswer && <ChatLoadingDots />}
      {item.status === 'done' && !hasAnswer && (
        <div className='text-sm text-muted-foreground'>{NO_ANSWER_MESSAGE}</div>
      )}
    </FaqRow>
  )
}

function AskRow({
  placeholder,
  disabled,
  onSubmit,
}: {
  placeholder: string
  disabled: boolean
  onSubmit: (question: string) => void
}) {
  const [value, setValue] = useState('')
  const canSubmit = !disabled && value.trim().length > 0

  const submit = () => {
    const question = value.trim()
    if (!canSubmit || !question) return
    setValue('')
    onSubmit(question)
  }

  return (
    <form
      className={cn(ROW_CLASS, 'border-b border-border')}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <input
        type='text'
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => setValue(event.target.value)}
        className={cn(QUESTION_CLASS, 'bg-transparent outline-none placeholder:text-muted-foreground')}
      />
      <button
        type='submit'
        aria-label='Ask'
        disabled={!canSubmit}
        className={cn(
          TRAILING_SLOT_CLASS,
          'rounded-full transition-colors',
          canSubmit
            ? 'cursor-pointer bg-primary text-primary-foreground hover:opacity-85'
            : 'cursor-default bg-transparent text-muted-foreground',
        )}
      >
        <ArrowRightIcon size={14} />
      </button>
    </form>
  )
}

export function FAQ({
  ask = true,
  askPlaceholder = 'Ask a question...',
  className,
  children,
}: {
  /** Show the trailing ask row. Only rendered when the site assistant is enabled. */
  ask?: boolean | string
  askPlaceholder?: string
  className?: string
  children: React.ReactNode
}) {
  const { site } = useHolocronData()
  const showAsk = (ask === true || ask === 'true') && site.config.assistant.enabled
  const [asked, setAsked] = useState<AskedItem[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const isLoading = asked.some((item) => item.status === 'loading')

  // One request at a time (the ask row is disabled while loading), so a
  // single controller is enough. Aborted on unmount so navigating away
  // stops the model instead of billing for an answer nobody will see.
  const requestRef = useRef<AbortController | null>(null)
  useEffect(() => {
    return () => requestRef.current?.abort()
  }, [])

  const updateItem = (id: number, patch: (item: AskedItem) => AskedItem) => {
    setAsked((items) => items.map((item) => (item.id === id ? patch(item) : item)))
  }

  const handleAsk = async (question: string) => {
    const id = Date.now()
    const controller = new AbortController()
    requestRef.current = controller
    setAsked((items) => [...items, { id, question, parts: [], status: 'loading' }])
    setOpenId(id)
    try {
      await askEphemeralQuestion(question, {
        signal: controller.signal,
        onPart: (part) => updateItem(id, (item) => ({ ...item, parts: [...item.parts, part] })),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      const message = error instanceof Error ? error.message : String(error)
      updateItem(id, (item) => ({ ...item, error: message }))
    } finally {
      updateItem(id, (item) => ({ ...item, status: 'done' }))
    }
  }

  return (
    <div className={cn('no-bleed flex flex-col', className)}>
      {children}
      {asked.map((item) => (
        <AskedRow
          key={item.id}
          item={item}
          open={openId === item.id}
          onToggle={() => setOpenId((current) => (current === item.id ? null : item.id))}
        />
      ))}
      {showAsk && <AskRow placeholder={askPlaceholder} disabled={isLoading} onSubmit={handleAsk} />}
    </div>
  )
}
