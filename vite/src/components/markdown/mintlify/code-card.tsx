'use client'

/** Mintlify-compatible code shell components with copy support. */

import React from 'react'

function CopyIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
      <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <polyline points='20 6 9 17 4 12' />
    </svg>
  )
}

/**
 * CodeCard — Mintlify-style rounded code container with optional title and
 * copy button. Used by RequestExample, ResponseExample, and available as a
 * standalone MDX component.
 *
 * The component uses Holocron's tinted shell pattern: an accent-colored outer
 * surface wraps an inner background-colored body. This keeps code examples
 * visually grouped while adapting to both light and dark mode tokens.
 */
export function CodeCard({
  title,
  children,
  copyable = true,
}: {
  title?: string
  children: React.ReactNode
  copyable?: boolean
}) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    const text = contentRef.current?.textContent ?? ''
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className='rounded-2xl bg-accent px-0.5 pb-0.5 pt-px'>
      {(title || copyable) && (
        <div className='flex items-center justify-between gap-2 px-3 py-1.5'>
          {title
            ? <span className='truncate text-xs font-medium text-muted-foreground'>{title}</span>
            : <span />}
          {copyable && (
            <button
              type='button'
              onClick={handleCopy}
              aria-label='Copy code'
              className='flex size-[26px] shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground'
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          )}
        </div>
      )}
      <div
        ref={contentRef}
        className='no-bleed overflow-x-auto rounded-[15px] bg-background px-4 py-3.5'
      >
        {children}
      </div>
    </div>
  )
}

export function RequestExample({ children, dropdown }: { children: React.ReactNode; dropdown?: boolean }) {
  return <CodeCard title='Request example'>{children}</CodeCard>
}

export function ResponseExample({ children, dropdown }: { children: React.ReactNode; dropdown?: boolean }) {
  return <CodeCard title='Response example'>{children}</CodeCard>
}
