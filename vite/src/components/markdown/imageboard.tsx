'use client'

/**
 * Imageboard masonry grid + video tile.
 *
 * ImageboardGrid renders children in a pure-CSS masonry layout using CSS
 * multi-columns (`column-count` + `column-width`) — zero JS, and because
 * every child carries known dimensions (aspect-ratio boxes from the image
 * pipeline / video probe) there is no layout shift with lazy loading.
 * The `column-width` floor automatically drops the column count on narrow
 * viewports, so a single `columns` number stays responsive.
 *
 * Items flow top-to-bottom per column (newspaper order). Fine for
 * moodboards/galleries where strict reading order doesn't matter.
 *
 * Shared CSS lives in editorial.css under `.holocron-imageboard` (plain CSS
 * class instead of Tailwind arbitrary values — see AGENTS.md note about the
 * JIT scanner and dist-compiled package components). Vertical spacing between
 * items uses margin-bottom on children because CSS multi-columns have no
 * row-gap concept — this is the one layout where the "gap over margin" rule
 * cannot apply.
 */

import React from 'react'
import { cn } from '../../lib/css-vars.ts'

export function ImageboardGrid({
  columns = 3,
  children,
  className = '',
  style,
}: {
  /** Maximum column count on wide viewports. Accepts a string because the
   *  imageboard provider emits static string attributes in virtual MDX. */
  columns?: number | string
  children?: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  const count = typeof columns === 'string' ? Number(columns) || 3 : columns
  return (
    <div
      className={cn('holocron-imageboard w-full', className)}
      style={{ columnCount: count, ...style }}
    >
      {children}
    </div>
  )
}

/**
 * Video tile for the imageboard grid. Dimensions come from the build-time
 * container-header probe so the tile reserves its aspect ratio before any
 * bytes load. `preload="metadata"` fetches only the header + first frame,
 * which acts as the poster — no full download until the user hits play.
 */
export function ImageboardVideo({
  src,
  width,
  height,
  type,
  className = '',
  style,
}: {
  src: string
  width?: number | string
  height?: number | string
  type?: string
  className?: string
  style?: React.CSSProperties
}) {
  const w = toNumber(width)
  const h = toNumber(height)
  return (
    <video
      controls
      muted
      loop
      playsInline
      preload='metadata'
      width={w}
      height={h}
      className={cn('block w-full bg-muted', className)}
      style={{
        ...(w && h ? { aspectRatio: `${w} / ${h}` } : {}),
        height: 'auto',
        objectFit: 'cover',
        ...style,
      }}
    >
      <source src={src} type={type} />
    </video>
  )
}

function toNumber(value: number | string | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())) return Number(value)
  return undefined
}
