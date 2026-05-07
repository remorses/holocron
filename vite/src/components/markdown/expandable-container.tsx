'use client'

/**
 * CSS-grid expand/collapse wrapper with zero layout shift at hydration.
 * Suppresses the open/close transition on the first paint via a module-level
 * store so groups containing the current page don't animate from height 0.
 */

import React, { useSyncExternalStore } from 'react'

/**
 * First-paint guard. `false` during SSR and during the initial client render,
 * flips to `true` on the first rAF after module load. Components read it via
 * `useSyncExternalStore` so the render-phase value is tear-free.
 *
 * Used by `ExpandableContainer` to suppress the open/close transition on the
 * initial paint — otherwise groups containing the current page would animate
 * in from height 0 on every page load, causing a visible layout shift.
 */
let firstPaintDone = false
const firstPaintListeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  requestAnimationFrame(() => {
    firstPaintDone = true
    for (const fn of firstPaintListeners) fn()
  })
}

function subscribeFirstPaint(cb: () => void) {
  firstPaintListeners.add(cb)
  return () => { firstPaintListeners.delete(cb) }
}
const getFirstPaintSnapshot = () => firstPaintDone
const getFirstPaintServerSnapshot = () => false

function useFirstPaintDone(): boolean {
  return useSyncExternalStore(subscribeFirstPaint, getFirstPaintSnapshot, getFirstPaintServerSnapshot)
}

/**
 * CSS-grid-based expand/collapse with zero layout shift at hydration time.
 *
 * The parent uses `grid-template-rows: 1fr | 0fr` which modern browsers
 * interpolate smoothly (Chrome 117+, Safari 17.4+, Firefox 125+). The child
 * wraps content in `overflow: hidden` + `min-height: 0` so the grid track
 * can collapse.
 *
 * Why not height measurement? The old implementation seeded `useState(0)`
 * for height, so SSR and first-hydration paint always rendered `height: 0`
 * even for open containers. A `ResizeObserver` then set the real height
 * post-mount, and the CSS transition animated 0 → scrollHeight — a visible
 * layout shift on every page load. With grid, the browser sizes the track
 * from content synchronously during layout, so open containers render at
 * the correct height from the very first paint.
 *
 * `useFirstPaintDone()` additionally disables the transition on the very
 * first render so the opacity fade doesn't run during hydration.
 */
export function ExpandableContainer({ open, children, animate }: { open: boolean; children: React.ReactNode; animate?: boolean }) {
  const firstPaintDone = useFirstPaintDone()
  // When `animate` is explicitly false, never transition (used by the sidebar
  // nav tree to disable animations by default). When undefined, fall back to
  // the first-paint guard (existing behaviour for Mintlify Expandable etc.).
  const canAnimate = animate === false ? false : firstPaintDone && (animate ?? true)
  return (
    <div
      aria-hidden={!open}
      inert={!open || undefined}
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        opacity: open ? 1 : 0,
        transition: canAnimate
          ? 'grid-template-rows 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s ease'
          : 'none',
      }}
    >
      {/* Inner clip. `overflow: hidden` + `min-height: 0` makes the grid
        * track collapsible. `paddingInline: 4px` + `marginInline: -4px`
        * creates 4px of horizontal clearance INSIDE the clip so children's
        * search-highlight box-shadow (4px spread) renders without being
        * cut off. See MEMORY.md "box-shadow for 'bleed' highlight outlines"
        * for context. */}
      <div style={{
        overflow: 'hidden',
        minHeight: 0,
        paddingInline: '4px',
        marginInline: '-4px',
      }}>{children}</div>
    </div>
  )
}
