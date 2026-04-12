'use client'

/**
 * Mintlify-compatible callouts. Generic <Callout> + typed aliases
 * (Note/Warning/Info/Tip/Check/Danger). Renders a framed card with a
 * leading icon. Nests cleanly inside <Aside> because Aside has no border.
 */

import React from 'react'
import { Icon } from '../icon.tsx'

/** Tailwind class map per preset type. Each entry drives bg tint, border,
 *  and icon color (via text-*). The body text stays default (--foreground);
 *  only the icon picks up the variant color through currentColor. */
const CALLOUT_VARIANTS = {
  note:    'bg-blue-500/[0.03] border-blue-500/15 text-blue-700 dark:text-blue-400',
  warning: 'bg-amber-500/[0.03] border-amber-500/15 text-amber-700 dark:text-amber-400',
  info:    'bg-blue-500/[0.03] border-blue-500/15 text-blue-700 dark:text-blue-400',
  tip:     'bg-emerald-500/[0.03] border-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  check:   'bg-emerald-500/[0.03] border-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  danger:  'bg-red-500/[0.03] border-red-500/15 text-red-700 dark:text-red-400',
} as const

export type CalloutType = keyof typeof CALLOUT_VARIANTS

/** Preset inline SVG icons for typed callouts. Each uses currentColor so it
 *  inherits the variant's text-* class from the wrapper. */
const CALLOUT_ICONS: Record<CalloutType, React.ReactNode> = {
  note: (
    <svg viewBox='0 0 16 16' width='16' height='16' fill='currentColor' aria-hidden='true'>
      <path d='M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z' />
    </svg>
  ),
  warning: (
    <svg viewBox='0 0 16 16' width='16' height='16' fill='currentColor' aria-hidden='true'>
      <path d='M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575L6.457 1.047ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm1 7a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z' />
    </svg>
  ),
  info: (
    <svg viewBox='0 0 16 16' width='16' height='16' fill='currentColor' aria-hidden='true'>
      <path d='M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z' />
    </svg>
  ),
  tip: (
    <svg viewBox='0 0 16 16' width='16' height='16' fill='currentColor' aria-hidden='true'>
      <path d='M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75ZM5.75 12a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z' />
    </svg>
  ),
  check: (
    <svg viewBox='0 0 16 16' width='16' height='16' fill='currentColor' aria-hidden='true'>
      <path d='M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.751.751 0 0 0-.018-1.042.751.751 0 0 0-1.042-.018L6.75 9.19 5.28 7.72a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042l2 2a.75.75 0 0 0 1.06 0l4.5-4.5Z' />
    </svg>
  ),
  danger: (
    <svg viewBox='0 0 16 16' width='16' height='16' fill='currentColor' aria-hidden='true'>
      <path d='M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm3.78 4.53v3.5a.75.75 0 0 0 1.5 0v-3.5a.75.75 0 0 0-1.5 0ZM9 11a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z' />
    </svg>
  ),
}

/** Convert `#rgb`/`#rrggbb` hex to `rgba(r, g, b, a)`. Returns the input
 *  unchanged if it doesn't match — safe fallback for non-hex user input. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  let h = m[1]!
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export interface CalloutProps {
  children: React.ReactNode
  /** Preset variant. Drives bg tint, border, and icon color via Tailwind classes. */
  type?: CalloutType
  /** Custom hex color (e.g. `#FFC107`). Overrides `type` styling and renders
   *  via inline style (Tailwind can't support arbitrary hex statically). */
  color?: string
  /** Icon: ReactNode rendered as-is, or string resolved via <Icon> (lucide/emoji/URL). */
  icon?: React.ReactNode | string
  /** FontAwesome icon style. Passed through to <Icon> as iconType for atlas key dispatch. */
  iconType?: 'regular' | 'solid' | 'light' | 'thin' | 'sharp-solid' | 'duotone' | 'brands' | string
}

function resolveCalloutIcon({
  icon,
  iconType,
  fallback,
  colorStyle,
}: {
  icon: React.ReactNode | string | undefined
  iconType: string | undefined
  fallback: React.ReactNode | undefined
  colorStyle: React.CSSProperties | undefined
}): React.ReactNode | undefined {
  if (icon === undefined || icon === null) return fallback
  if (typeof icon !== 'string') return icon
  // String icon → delegate to <Icon> (handles emoji, URL, atlas lookup)
  return <Icon icon={icon} iconType={iconType} size={16} color={colorStyle?.color} />
}

export function Callout({ children, type, color, icon, iconType }: CalloutProps) {
  // No font-size/line-height here — Callout inherits from parent (body-size in
  // main content, --type-small-size inside an Aside).
  // `no-bleed` zeros the bleed tokens for descendants so code blocks and
  // images stay inside the callout frame (see editorial.css).
  const baseClass = 'no-bleed flex gap-3 items-start p-3 rounded-lg border-2'
  const presetIcon = type ? CALLOUT_ICONS[type] : undefined
  const colorStyle = color ? { color } : undefined
  const resolvedIcon = resolveCalloutIcon({ icon, iconType, fallback: presetIcon, colorStyle })

  // Custom hex color → inline style, no variant class
  if (color) {
    return (
      <div
        className={baseClass}
        style={{
          backgroundColor: hexToRgba(color, 0.03),
          borderColor: hexToRgba(color, 0.15),
        }}
      >
        {resolvedIcon !== undefined && resolvedIcon !== null && (
          <span className='flex-shrink-0 mt-0.5 inline-flex items-center justify-center' style={{ color, width: 16, height: 16 }}>
            {resolvedIcon}
          </span>
        )}
        <div className='flex flex-col gap-2 min-w-0 flex-1 text-foreground'>{children}</div>
      </div>
    )
  }

  // Preset variant (or unstyled fallback)
  const variantClass = type ? CALLOUT_VARIANTS[type] : 'bg-blue-500/[0.03] border-blue-500/15 text-blue-700 dark:text-blue-400'
  return (
    <div className={`${baseClass} ${variantClass}`}>
      {resolvedIcon !== undefined && resolvedIcon !== null && (
        <span className='flex-shrink-0 mt-0.5 inline-flex items-center justify-center w-4 h-4'>
          {resolvedIcon}
        </span>
      )}
      <div className='flex flex-col gap-2 min-w-0 flex-1 text-foreground'>{children}</div>
    </div>
  )
}

/* Typed callout aliases — Mintlify parity. Each is a thin <Callout type="…">
   wrapper with preset icon + color. */
export function Note({ children }: { children: React.ReactNode }) {
  return <Callout type='note'>{children}</Callout>
}
export function Warning({ children }: { children: React.ReactNode }) {
  return <Callout type='warning'>{children}</Callout>
}
export function Info({ children }: { children: React.ReactNode }) {
  return <Callout type='info'>{children}</Callout>
}
export function Tip({ children }: { children: React.ReactNode }) {
  return <Callout type='tip'>{children}</Callout>
}
export function Check({ children }: { children: React.ReactNode }) {
  return <Callout type='check'>{children}</Callout>
}
export function Danger({ children }: { children: React.ReactNode }) {
  return <Callout type='danger'>{children}</Callout>
}
