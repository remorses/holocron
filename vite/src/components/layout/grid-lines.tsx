/**
 * Decorative grid lines — cosmetic border lines framing the page layout.
 * Renders vertical lines outside the max-width content edges (offset by
 * --grid-line-offset), a horizontal bottom border, and dots at the tab
 * bar border aligned with the vertical lines.
 *
 * Configurable via `decorativeLines` in docs.json / holocron.jsonc:
 *   - "none"            — no decorative lines
 *   - "lines"           — solid 1px lines
 *   - "dashed"          — dashed/segmented lines
 *   - "lines-with-dots" — solid lines + dot ornaments at vertices (default)
 *
 * Line positions (desktop only):
 *   - 2 outer vertical lines offset outside the max-width edges
 *   - 1 horizontal bottom border below the content area
 *   - Dots at every line intersection when mode is "lines-with-dots"
 *   - Dots on the tab-bar border aligned with the vertical lines
 *
 * All elements are aria-hidden, pointer-events-none — purely visual.
 * Only rendered at lg: breakpoint (desktop); hidden on mobile.
 */

import React from 'react'

export type DecorativeMode = 'none' | 'lines' | 'dashed' | 'lines-with-dots'

/** Gap between content edge and decorative line — lives in CSS as
 *  `--grid-line-offset` so it can be themed. Default 20px. */
const LINE_OFFSET = 'var(--grid-line-offset, 20px)'

/* ── GridDot ──────────────────────────────────────────────────────────── */

/** Decorative dot placed at border intersections. Must be inside a relative container.
 *  Outer circle masks the border crossing with page bg, inner dot marks the joint. */
function GridDot({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className='grid-dot hidden lg:flex'
      style={style}
    />
  )
}

/* ── Shared helpers ───────────────────────────────────────────────────── */

const lineClass = (mode: DecorativeMode) =>
  mode === 'dashed' ? 'dashed' : 'solid'

/* Line positions — offset outside the max-width box */
const lineLeft = `calc(-1 * ${LINE_OFFSET})`
const lineRight = `calc(-1 * ${LINE_OFFSET})`

/* Dot positions at corners — centered on the line, which is offset outside */
const dot = {
  tl: { top: 0, left: lineLeft, transform: 'translate(-50%, -50%)' } as React.CSSProperties,
  tr: { top: 0, right: lineRight, transform: 'translate(50%, -50%)' } as React.CSSProperties,
  bl: { bottom: 0, left: lineLeft, transform: 'translate(-50%, 50%)' } as React.CSSProperties,
  br: { bottom: 0, right: lineRight, transform: 'translate(50%, 50%)' } as React.CSSProperties,
}

/* ── GridLines ────────────────────────────────────────────────────────── */

/**
 * Decorative lines for the page frame — outer verticals (offset outside
 * the max-width), bottom horizontal, and dot ornaments at intersections.
 *
 * Placed inside a relative wrapper at max-width. Lines are offset
 * outward by --grid-line-offset:
 *
 * ```
 *  •  ┊━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┊  •  ← tab-bar border + dots
 *  ┃  ┊  nav sidebar     main content   right rail ┊  ┃
 *  ┃  ┊                                            ┊  ┃
 *  ┃  ┊← max-width edges                          →┊  ┃
 *  ┃  ┊                                            ┊  ┃
 *  •━━┻━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┻━━•  ← bottom + dots
 * ```
 */
export function GridLinesFrame({ mode }: { mode: DecorativeMode }) {
  if (mode === 'none') return null
  const cls = lineClass(mode)
  const showDots = mode === 'lines-with-dots'

  return (
    <>
      {/* ── Outer vertical lines (offset outside max-width edges) ── */}
      <div aria-hidden className={`grid-line-v ${cls} hidden lg:block`} style={{ left: lineLeft }} />
      <div aria-hidden className={`grid-line-v ${cls} hidden lg:block`} style={{ right: lineRight }} />

      {/* ── Dots at bottom end of vertical lines ── */}
      {showDots && (
        <>
          <GridDot style={dot.bl} />
          <GridDot style={dot.br} />
        </>
      )}
    </>
  )
}

/**
 * Dots on the tab-bar border — aligned with the vertical line positions.
 * Placed inside the full-width slot-tabbar (position: relative).
 * Uses `calc(50% - max-width/2 - offset)` to position dots at the
 * same X as the vertical lines regardless of viewport width.
 */
/* In a full-width parent, position at same X as the vertical lines:
   left = 50% - max-width/2 - offset */
const fullWidthLeftX = `calc(50% - var(--grid-max-width) / 2 - ${LINE_OFFSET})`
const fullWidthRightX = `calc(50% - var(--grid-max-width) / 2 - ${LINE_OFFSET})`

export function TabBarDots({ mode }: { mode: DecorativeMode }) {
  if (mode !== 'lines-with-dots') return null
  return (
    <>
      <GridDot style={{ bottom: 0, left: fullWidthLeftX, transform: 'translate(-50%, 50%)' }} />
      <GridDot style={{ bottom: 0, right: fullWidthRightX, transform: 'translate(50%, 50%)' }} />
    </>
  )
}

/**
 * Vertical decorative lines inside the navbar — full-height of the navbar,
 * aligned with the outer frame vertical lines. Placed inside the full-width
 * slot-navbar (position: relative).
 */
export function NavbarLines({ mode }: { mode: DecorativeMode }) {
  if (mode === 'none') return null
  const cls = lineClass(mode)
  return (
    <>
      <div
        aria-hidden
        className={`grid-line-v ${cls} hidden lg:block`}
        style={{ left: fullWidthLeftX }}
      />
      <div
        aria-hidden
        className={`grid-line-v ${cls} hidden lg:block`}
        style={{ right: fullWidthRightX }}
      />
    </>
  )
}
