'use client'

/**
 * Chat message UI components — user bubbles, assistant parts, tool call
 * indicators with animated PieLoader, error previews, and loading dots.
 *
 * Text parts carry server-rendered JSX (no client markdown rendering).
 * Tool parts carry plain data — rendered here with animated indicators.
 *
 * Follows fumabase's chat-tool-previews.tsx patterns:
 * - PieLoader (◔◑◕●) for pending tool calls
 * - ◆ for completed tool calls
 * - ⎿ gutter + whitespace-pre-wrap for tool output
 * - font-mono ToolPreviewContainer wrapper
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import type { ChatPart } from '../lib/chat-store.ts'
import { ChevronDownIcon } from './chat-icons.tsx'

// ── User message ─────────────────────────────────────────────────────

export function ChatUserMessage({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '8px 14px',
          borderRadius: '16px 16px 4px 16px',
          backgroundColor: 'var(--muted)',
          color: 'var(--foreground)',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
    </div>
  )
}

// ── Assistant message (renders array of ChatPart) ────────────────────

export function ChatAssistantMessage({
  parts,
}: {
  parts: ChatPart[]
}) {
  if (parts.length === 0) return null
  return (
    <div className='text-[13px]' style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {parts.map((part, i) => {
        // Add extra space before user messages (conversation turn boundary)
        const isUserTurn = part.type === 'user-message'
        const isFirst = i === 0
        return (
          <div key={i} style={isUserTurn && !isFirst ? { marginTop: '24px' } : undefined}>
            <ChatPartRenderer part={part} allParts={parts} />
          </div>
        )
      })}
    </div>
  )
}

function ChatPartRenderer({
  part,
  allParts,
}: {
  part: ChatPart
  allParts: ChatPart[]
}) {
  if (part.type === 'user-message') {
    return <ChatUserMessage text={part.text} />
  }

  if (part.type === 'notice') {
    return <ChatNotice part={part} />
  }

  if (part.type === 'text') {
    return (
      <div style={{ fontSize: '13px' }}>
        <div className='editorial-prose'>
          {part.jsx}
        </div>
      </div>
    )
  }

  if (part.type === 'tool-call') {
    return <ToolCallStarted part={part} allParts={allParts} />
  }

  if (part.type === 'tool-result') {
    return <ToolCallCompleted part={part} />
  }

  return null
}

function ChatNotice({ part }: { part: Extract<ChatPart, { type: 'notice' }> }) {
  return (
    <div>
      <div
        className='no-bleed flex items-start gap-2.5 rounded-[10px] bg-[color-mix(in_srgb,var(--background)_93%,var(--yellow))] p-2 text-foreground'
      >
        <svg viewBox='0 0 16 16' width='16' height='16' fill='currentColor' aria-hidden='true' className='mt-0.5 size-4 shrink-0 text-yellow'>
          <path d='M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575L6.457 1.047ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm1 7a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z' />
        </svg>
        <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
          <div className='flex flex-col gap-0.5'>
            <div className='text-xs font-semibold text-foreground'>
              {part.title}
            </div>
            <div className='text-xs leading-[1.45] text-muted-foreground'>
              {part.message}
            </div>
          </div>

          {part.command && (
            <code className='code-font-size block whitespace-pre-wrap rounded-[7px] bg-foreground/6 px-2 py-1.5 font-mono text-foreground'>
              {part.command}
            </code>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tool call started — animated PieLoader or static ◆ ──────────────

function ToolCallStarted({
  part,
  allParts,
}: {
  part: Extract<ChatPart, { type: 'tool-call' }>
  allParts: ChatPart[]
}) {
  const hasResult = useMemo(
    () =>
      allParts.some(
        (p) =>
          p.type === 'tool-result' && p.toolCallId === part.toolCallId,
      ),
    [allParts, part.toolCallId],
  )

  const command =
    typeof part.args?.command === 'string'
      ? part.args.command
      : JSON.stringify(part.args)
  const truncatedCommand =
    command.length > 120 ? command.slice(0, 120) + '…' : command

  return (
    <ToolPreviewContainer>
      <span style={{ whiteSpace: 'pre' }}>
        {hasResult ? <span>◆ </span> : <PieLoader />}
      </span>
      Running:{' '}
      <Highlight>{truncatedCommand}</Highlight>
    </ToolPreviewContainer>
  )
}

// ── Tool call completed — output or error in ⎿ gutter ───────────────

function ToolCallCompleted({
  part,
}: {
  part: Extract<ChatPart, { type: 'tool-result' }>
}) {
  if (part.error) {
    return <ErrorPreview error={part.error} />
  }

  if (!part.output || !part.output.trim()) return null

  const truncated =
    part.output.length > 500 ? part.output.slice(0, 500) + '…' : part.output

  return (
    <ShowMore>
      <ToolPreviewContainer>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
          <div style={{ flexShrink: 0, color: 'var(--muted-foreground)' }}>
            ⎿
          </div>
          <div>
            <span
              style={{
                whiteSpace: 'pre-wrap',
                color: 'var(--muted-foreground)',
                fontSize: '12px',
              }}
            >
              {truncated}
            </span>
          </div>
        </div>
      </ToolPreviewContainer>
    </ShowMore>
  )
}

// ── Shared primitives (mirrors fumabase chat-tool-previews.tsx) ──────

function ToolPreviewContainer({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-code)',
        fontSize: '13px',
        padding: '4px 0',
        lineHeight: '1.5',
        width: '100%',
      }}
    >
      {children}
    </div>
  )
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <span className='dark:text-purple-300 text-purple-800'>{children}</span>
  )
}

function ErrorPreview({ error }: { error: string }) {
  const truncated = error.length > 600 ? error.slice(0, 600) + '…' : error
  return (
    <ToolPreviewContainer>
      <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
        <div style={{ flexShrink: 0, color: 'var(--muted-foreground)' }}>
          ⎿
        </div>
        <span>
          Error:{' '}
          <span
            className='dark:text-orange-300 text-orange-500'
            style={{ whiteSpace: 'pre-line' }}
          >
            {truncated}
          </span>
        </span>
      </div>
    </ToolPreviewContainer>
  )
}

/** Animated pie loader: ◔ → ◑ → ◕ → ● cycling every 160ms.
 *  Matches fumabase's PieLoader in chat-tool-previews.tsx. */
function PieLoader() {
  const pies = ['◔', '◑', '◕', '●']
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % pies.length)
    }, 160)
    return () => clearInterval(interval)
  }, [])

  return (
    <span className='inline-block text-orange-500 dark:text-orange-300'>
      {pies[index]}{' '}
    </span>
  )
}

// ── ShowMore — collapsible wrapper with gradient fade ────────────────

function ShowMore({
  children,
  height = 160,
}: {
  children: React.ReactNode
  height?: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [needsExpansion, setNeedsExpansion] = useState(false)

  useEffect(() => {
    if (contentRef.current) {
      setNeedsExpansion(contentRef.current.scrollHeight > height)
    }
  }, [height, children])

  return (
    <div>
      <div
        ref={contentRef}
        style={{
          overflow: 'hidden',
          transition: 'max-height 300ms ease',
          maxHeight:
            isExpanded || !needsExpansion ? 'none' : `${height}px`,
          position: 'relative',
          cursor: !isExpanded && needsExpansion ? 'pointer' : undefined,
        }}
        onClick={() => {
          if (!isExpanded && needsExpansion) setIsExpanded(true)
        }}
      >
        {children}
        {!isExpanded && needsExpansion && (
          <div
            style={{
              position: 'absolute',
              insetInline: 0,
              bottom: 0,
              height: '64px',
              background:
                'linear-gradient(to top, var(--background), transparent)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
      {needsExpansion && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '12px',
          }}
        >
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: 'var(--foreground)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            <span>{isExpanded ? 'Show less' : 'Show more'}</span>
            <ChevronDownIcon
              size={14}
              className={isExpanded ? 'rotate-180' : ''}
            />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Loading dots (shown before first part arrives) ───────────────────

export function ChatLoadingDots() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '8px 0',
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: 'var(--muted-foreground)',
            animation: `holocron-chat-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes holocron-chat-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
