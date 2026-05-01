'use client'

/** Mintlify-compatible Tooltip component with simple hover behavior. */

import React from 'react'
import { Link } from 'spiceflow/react'

export function Tooltip({
  tip,
  description,
  headline,
  title,
  cta,
  href,
  side: _side,
  align: _align,
  className = '',
  children,
}: {
  tip?: string
  description?: string
  headline?: string
  title?: string
  cta?: string
  href?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const resolvedTitle = title ?? headline
  const resolvedDescription = description ?? tip
  // safe-mdx wraps text children in P (a block div), so we extract
  // the text content and render it inline to avoid invalid div-inside-span.
  const inlineText = typeof children === 'string'
    ? children
    : typeof children === 'number'
      ? String(children)
      : undefined
  const trigger = inlineText !== undefined
    ? inlineText
    : children
  return (
    <span
      className={`relative inline-flex w-fit cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2 ${className}`.trim()}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {trigger}
      {open && (
        <span
          className='absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-subtle bg-card px-3 py-2 text-sm text-foreground shadow-lg'
          role='tooltip'
        >
          {resolvedTitle && <div className='text-xs font-semibold'>{resolvedTitle}</div>}
          {resolvedDescription && <div>{resolvedDescription}</div>}
          {cta && href && (
            <Link href={href} className='inline-block text-xs text-primary hover:underline'>{cta}</Link>
          )}
        </span>
      )}
    </span>
  )
}
