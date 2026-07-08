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
 *
 * Tool call labels prefer the model-provided `description` input field
 * (every tool schema injects one). Tools without a description fall back
 * to the Claude-style `toolName(primary-arg)` title instead of raw JSON.
 * All tool UI uses monospace font consistently.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import type { ChatMessage, ChatPart } from './chat-store.ts'
import { respondToApproval } from './chat-store.ts'
import { CopyIcon, CheckIcon, RefreshIcon } from './chat-icons.tsx'
import { NavTooltip } from './chat-input.tsx'
import { ShowMore } from './show-more.tsx'

// ── User message ─────────────────────────────────────────────────────

function ChatUserMessage({ text }: { text: string }) {
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

// ── Messages (AI SDK-like role + parts shape) ────────────────────────

export function ChatMessages({
  messages,
  isGenerating,
  onRegenerate,
}: {
  messages: ChatMessage[]
  isGenerating?: boolean
  onRegenerate?: (messageIndex: number) => void
}) {
  if (messages.length === 0) return null
  let noticeRendered = false
  return (
    <div className='text-[14px]' style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {messages.map((message, i) => {
        return (
          <div key={i} data-message-id={`msg-${i}`} style={message.role === 'user' ? { scrollMarginTop: '8px' } : undefined}>
            {message.role === 'user'
              ? <ChatUserMessage text={message.parts.filter((part) => part.type === 'text').map((part) => part.text).join('\n')} />
              : (
                  <div
                    className='flex flex-col gap-4'
                  >
                    {message.parts.map((part, partIndex) => {
                      if (part.type === 'notice') {
                        if (noticeRendered) return null
                        noticeRendered = true
                      }
                      return <ChatPartRenderer key={partIndex} part={part} allParts={message.parts} />
                    })}
                    {/* Footer: copy + regenerate. Hidden only on the
                        currently-streaming assistant message (last in the
                        array while isGenerating). Previous completed
                        assistants always keep their footer visible. */}
                    {!(isGenerating && i === messages.length - 1) && (
                      <ChatAssistantFooter
                        parts={message.parts}
                        onRegenerate={onRegenerate ? () => onRegenerate(i) : undefined}
                      />
                    )}
                  </div>
                )}
          </div>
        )
      })}
    </div>
  )
}

// ── Assistant message footer (copy + regenerate) ─────────────────────

function ChatAssistantFooter({
  parts,
  onRegenerate,
}: {
  parts: ChatPart[]
  onRegenerate?: () => void
}) {
  const [copied, setCopied] = useState(false)

  const markdown = useMemo(
    () =>
      parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim(),
    [parts],
  )

  const handleCopy = useCallback(async () => {
    if (!markdown) return
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy message:', err)
    }
  }, [markdown])

  const buttonClass =
    'inline-flex items-center justify-center size-7 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent cursor-pointer'

  return (
    <div className='flex items-center gap-1 -ml-1.5'>
      <NavTooltip label={copied ? 'Copied' : 'Copy'}>
        <button type='button' onClick={handleCopy} className={buttonClass} aria-label='Copy message'>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </NavTooltip>
      {onRegenerate && (
        <NavTooltip label='Regenerate'>
          <button type='button' onClick={onRegenerate} className={buttonClass} aria-label='Regenerate response'>
            <RefreshIcon />
          </button>
        </NavTooltip>
      )}
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
  if (part.type === 'notice') {
    return <ChatNotice part={part} />
  }

  if (part.type === 'text') {
    return (
      <div className='flex min-w-0 flex-col gap-(--prose-gap) overflow-x-clip overflow-y-visible'>
        {part.jsx ?? part.text}
      </div>
    )
  }

  if (part.type === 'tool-call') {
    return <ToolCallStarted part={part} allParts={allParts} />
  }

  if (part.type === 'tool-result') {
    return <ToolCallCompleted part={part} />
  }

  if (part.type === 'tool-approval-request') {
    return <ToolApprovalRequest part={part} />
  }

  return null
}

// ── Tool approval request — Approve/Deny prompt before execution ─────

function ToolApprovalRequest({
  part,
}: {
  part: Extract<ChatPart, { type: 'tool-approval-request' }>
}) {
  const resolved = part.state !== 'pending'
  const buttonClass =
    'cursor-pointer rounded-md border border-border px-3 py-1 text-xs font-medium transition-colors'

  return (
    <div
      data-approval-request={part.toolCallId}
      data-approval-state={part.state}
      className='no-bleed flex flex-col gap-2 rounded-lg border border-border bg-foreground/4 p-3'
    >
      <div className='text-xs font-semibold text-foreground'>
        {part.message || 'The assistant wants to perform this action:'}
      </div>
      <div className='text-xs text-muted-foreground'>{part.description}</div>
      {resolved ? (
        <div className='text-xs text-muted-foreground'>
          {part.state === 'approved' ? '✓ Approved' : '✗ Denied'}
        </div>
      ) : (
        <div className='flex gap-2'>
          <button
            type='button'
            onClick={() => respondToApproval(part.toolCallId, true)}
            className={`${buttonClass} bg-foreground text-background hover:opacity-85`}
          >
            Approve
          </button>
          <button
            type='button'
            onClick={() => respondToApproval(part.toolCallId, false)}
            className={`${buttonClass} text-foreground hover:bg-accent`}
          >
            Deny
          </button>
        </div>
      )}
    </div>
  )
}

function ChatNotice({ part }: { part: Extract<ChatPart, { type: 'notice' }> }) {
  return (
    <div>
      <div className='no-bleed flex items-start gap-2.5 rounded-lg bg-[color-mix(in_srgb,var(--background)_93%,var(--yellow))] p-2 text-foreground'>
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
            <code className='code-font-size block whitespace-pre-wrap rounded-md bg-foreground/6 px-2 py-1.5 font-mono text-foreground'>
              {part.command}
            </code>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tool call started — animated PieLoader or static ◆ ──────────────

/** Pick the primary argument to display for a tool call: the command for
 *  bash, path/selector for browser tools, first string value otherwise. */
function getToolPrimaryArg(args: Record<string, unknown> | undefined): string {
  if (!args) return ''
  for (const key of ['command', 'path', 'selector', 'value', 'text']) {
    if (typeof args[key] === 'string' && args[key]) return args[key]
  }
  const firstString = Object.entries(args).find(
    ([key, value]) => key !== 'description' && typeof value === 'string' && value,
  )
  if (firstString) return firstString[1] as string
  const rest = Object.fromEntries(
    Object.entries(args).filter(([key]) => key !== 'description'),
  )
  return Object.keys(rest).length > 0 ? JSON.stringify(rest) : ''
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

/** Claude-style `Tool(primary-arg)` fallback title when the model did not
 *  provide a human readable description. */
function formatToolTitle(toolName: string, args: Record<string, unknown> | undefined): string {
  const primaryArg = getToolPrimaryArg(args)
  return primaryArg ? `${toolName}(${truncate(primaryArg, 100)})` : `${toolName}()`
}

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

  // Human readable label: model-provided `description` input field when
  // available, Claude-style `tool(primary-arg)` fallback otherwise.
  const description =
    typeof part.args?.description === 'string' && part.args.description
      ? part.args.description
      : ''
  const label = description || formatToolTitle(part.toolName, part.args)

  return (
    <div
      className='flex flex-col'
      data-tool-call={part.toolName}
      data-tool-state={hasResult ? 'completed' : 'running'}
    >
      <ToolPreviewContainer>
        <span style={{ whiteSpace: 'pre' }}>
          {hasResult ? <span>◆ </span> : <PieLoader />}
        </span>
        <span className='truncate text-foreground'>{label}</span>
      </ToolPreviewContainer>
    </div>
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
    <div className='-mt-3'>
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
    </div>
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
      className='flex items-center min-w-0 text-xs font-mono'
      style={{
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
    <span className='text-purple-800 dark:text-purple-300'>{children}</span>
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
            className='text-orange-500 dark:text-orange-300'
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
