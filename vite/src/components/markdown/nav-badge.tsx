'use client'

/**
 * NavBadge — compact pill badge for the sidebar and API method indicators.
 *
 * Uses the editorial semantic palette (--green, --blue, etc.) via Tailwind
 * opacity variants so colors auto-adapt in dark mode. Same tokens as the
 * compat Badge component, but sized for the sidebar context (smaller).
 *
 * Used in two places:
 *  1. Sidebar nav tree — frontmatter `tag` and `deprecated` indicators
 *  2. OpenAPI endpoint headers — colored HTTP method pill (GET, POST, etc.)
 */

import React from 'react'

/** HTTP method → semantic color for API badges. */
const METHOD_COLORS: Record<string, string> = {
  get: 'green',
  post: 'blue',
  put: 'orange',
  patch: 'purple',
  delete: 'red',
  head: 'green',
  options: 'green',
}

/**
 * Each color maps to Tailwind classes using the editorial semantic tokens.
 * These match the compat Badge color system: `bg-<color>/10 text-<color>`.
 */
const COLOR_CLASSES: Record<string, string> = {
  green:  'bg-green/10 text-green',
  blue:   'bg-blue/10 text-blue',
  orange: 'bg-orange/10 text-orange',
  purple: 'bg-purple/10 text-purple',
  red:    'bg-red/10 text-red',
  yellow: 'bg-yellow/10 text-yellow',
}

export function NavBadge({
  label,
  variant = 'default',
  color,
}: {
  label: string
  variant?: 'default' | 'deprecated'
  /** Named color from the editorial palette: green, blue, orange, purple, red, yellow.
   *  Overrides variant-based styling when set. */
  color?: string
}) {
  const colorCls = color ? COLOR_CLASSES[color] : undefined

  // Variant fallback when no explicit color
  const variantCls = variant === 'deprecated'
    ? 'bg-accent text-muted-foreground'
    : 'bg-accent text-muted-foreground'

  return (
    <span
      className={`inline-flex items-center rounded-full shrink-0 px-1.5 text-[10px] leading-[18px] font-semibold tracking-wide ${colorCls ?? variantCls}`}
      style={color ? { textTransform: 'uppercase', letterSpacing: '0.05em' } : undefined}
    >
      {label}
    </span>
  )
}

/** HTTP method badge — colored pill showing GET, POST, PUT, PATCH, DELETE. */
export function MethodBadge({ method }: { method: string }) {
  const color = METHOD_COLORS[method.toLowerCase()] ?? 'green'
  return <NavBadge label={method.toUpperCase()} color={color} />
}
