'use client'

/**
 * Mintlify-compatible Tooltip component with portal-based positioning.
 *
 * Uses getBoundingClientRect() + fixed positioning via a portal to document.body
 * so the tooltip is always positioned relative to the viewport, not a potentially
 * narrow or offset parent container. This prevents the tooltip from visually
 * overlapping unrelated content when the trigger is near a container edge.
 *
 * Supports `side` (top/right/bottom/left) and `align` (start/center/end) props.
 */

import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '../link.tsx'
import { cn } from '../../lib/css-vars.ts'

/** Compute tooltip position with viewport clamping so it never extends past screen edges. */
function computeTooltipStyle(
  triggerRect: DOMRect,
  tooltipEl: HTMLElement,
  side: 'top' | 'right' | 'bottom' | 'left',
): React.CSSProperties {
  const gap = 8
  const pad = 8 // min distance from viewport edge
  const tw = tooltipEl.offsetWidth
  const th = tooltipEl.offsetHeight
  const vw = window.innerWidth

  let top: number
  let left: number

  switch (side) {
    case 'bottom':
      top = triggerRect.bottom + gap
      left = triggerRect.left + triggerRect.width / 2 - tw / 2
      break
    case 'left':
      top = triggerRect.top + triggerRect.height / 2 - th / 2
      left = triggerRect.left - gap - tw
      break
    case 'right':
      top = triggerRect.top + triggerRect.height / 2 - th / 2
      left = triggerRect.right + gap
      break
    case 'top':
    default:
      top = triggerRect.top - gap - th
      left = triggerRect.left + triggerRect.width / 2 - tw / 2
      break
  }

  // Clamp horizontal position to viewport
  if (left < pad) left = pad
  if (left + tw > vw - pad) left = vw - pad - tw

  return { top, left }
}

export function Tooltip({
  tip,
  description,
  headline,
  title,
  cta,
  href,
  side = 'top',
  align = 'center',
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
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({})
  const resolvedTitle = title ?? headline
  const resolvedDescription = description ?? tip
  const hasCta = !!(cta && href)
  // When tooltip has a CTA link, allow mouse to move into the tooltip
  // without closing it. Close on a small delay so the gap is bridgeable.
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openTooltip = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setOpen(true)
  }
  const closeTooltip = () => {
    if (hasCta) {
      closeTimerRef.current = setTimeout(() => setOpen(false), 150)
    } else {
      setOpen(false)
    }
  }

  // Position after the tooltip element renders so we can measure its actual size
  // for viewport clamping. The tooltip starts invisible, gets measured, then shown.
  useEffect(() => {
    if (!open || !triggerRef.current || !tooltipRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setStyle(computeTooltipStyle(rect, tooltipRef.current, side))
  }, [open, side])

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

  const target = typeof document !== 'undefined' ? document.body : null

  return (
    <span
      ref={triggerRef}
      className={cn('inline-flex w-fit cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2', className)}
      onMouseEnter={openTooltip}
      onMouseLeave={closeTooltip}
    >
      {trigger}
      {open && target && createPortal(
        <span
          ref={tooltipRef}
          className={cn(
            'fixed z-50 max-w-xs rounded-lg border border-border-subtle bg-card px-3 py-2 text-sm text-foreground shadow-lg',
            !hasCta && 'pointer-events-none',
          )}
          role='tooltip'
          style={{ ...style, zIndex: 300 }}
          onMouseEnter={hasCta ? openTooltip : undefined}
          onMouseLeave={hasCta ? closeTooltip : undefined}
        >
          {resolvedTitle && <div className='text-xs font-semibold'>{resolvedTitle}</div>}
          {resolvedDescription && <div>{resolvedDescription}</div>}
          {hasCta && (
            <Link href={href!} className='inline-block text-xs text-primary hover:underline'>{cta}</Link>
          )}
        </span>,
        target,
      )}
    </span>
  )
}
