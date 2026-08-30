'use client'

/**
 * Shared hook for tracking which heading is currently active in the viewport.
 *
 * The reading line is each heading's `scroll-margin-top` (the sticky header).
 * Hash navigation parks the target on that line, so a smaller magic offset
 * (e.g. 50px vs ~144px) keeps the previous heading active and the sidebar
 * jumps backwards.
 *
 * Hash stays authoritative after hashchange/click until real user scroll
 * (`wheel` / `touchstart` / scroll keys, or scrollbar drag via scrollend).
 * That covers no-scroll pages and headings that cannot reach the line.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react'

/** Last heading whose top is still at or above the sticky-header reading line. */
export function pickActiveHeadingId({
  headings,
  fallbackId,
  offset,
}: {
  headings: { id: string; top: number }[]
  fallbackId: string
  offset: number
}): string {
  let activeId = ''
  let activeTop = -Infinity
  for (const heading of headings) {
    if (heading.top > offset) continue
    if (heading.top >= activeTop) {
      activeTop = heading.top
      activeId = heading.id
    }
  }
  return activeId || fallbackId
}

function readHeadingOffset(nodes: NodeListOf<HTMLElement>): number {
  for (const node of nodes) {
    const margin = parseFloat(getComputedStyle(node).scrollMarginTop)
    if (Number.isFinite(margin) && margin > 0) return margin + 1
  }
  return 1
}

/**
 * When true, the URL hash takes priority over scroll-based detection.
 * Set to true on hashchange or heading click, reset to false only by
 * genuine user scroll input (wheel, touch, keyboard scroll keys, or
 * scrollbar drag detected via scrollend + subsequent scroll).
 */
let hashIsAuthoritative = false

/**
 * Set to true by `scrollend` after a hash-triggered programmatic scroll
 * finishes. The next `scroll` event after this flag is set must be from
 * user input (scrollbar drag, browser extension, etc.) and resets
 * hashIsAuthoritative. Cleared on any hash/click event.
 */
let programmaticScrollDone = false

/** Keys that cause the browser to scroll the page. */
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'])

/** Custom event dispatched by notifyHeadingClick to trigger re-render. */
const HEADING_CLICK_EVENT = 'holocron:heading-click'

/**
 * Call this from heading link onClick handlers as a safety net.
 * Ensures hashIsAuthoritative is set even if the synthetic hashchange
 * from Spiceflow's router is delayed or missing (e.g. same-hash clicks
 * where Spiceflow skips the hashchange because the hash didn't change).
 *
 * Skips modifier-key clicks (Cmd/Ctrl/Shift/Alt) which open in new tabs.
 */
export function notifyHeadingClick(e?: React.MouseEvent) {
  if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return
  hashIsAuthoritative = true
  programmaticScrollDone = false
  // Dispatch in rAF so the URL hash has been updated by the router
  // before useSyncExternalStore calls getSnapshot → computeActiveId.
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event(HEADING_CLICK_EVENT))
  })
}

export type ActiveTocSnapshot = {
  activeId: string
}

/**
 * Find the active heading based on scroll position + hash state.
 *
 * When hashIsAuthoritative (user just clicked a heading link), the hash wins.
 * Otherwise, pick the last heading at or above scroll-margin-top.
 */
function computeActiveId(validIds: Set<string>, fallbackId: string): string {
  const hash = window.location.hash.replace(/^#/, '')

  if (hashIsAuthoritative && hash && validIds.has(hash)) {
    return hash
  }

  if (hash && validIds.has(hash) && document.documentElement.scrollHeight <= window.innerHeight + 1) {
    return hash
  }

  const nodes = document.querySelectorAll<HTMLElement>('[data-toc-heading="true"][id]')
  const offset = readHeadingOffset(nodes)
  const headings: { id: string; top: number }[] = []
  for (const node of nodes) {
    if (!validIds.has(node.id)) continue
    const rect = node.getBoundingClientRect()
    if (rect.height === 0) continue
    headings.push({ id: node.id, top: rect.top })
  }
  return pickActiveHeadingId({ headings, fallbackId, offset })
}

/**
 * Track which heading is currently active based on scroll position.
 * Both the left-sidebar TocInline and the right-sidebar TableOfContentsPanel
 * call this independently but converge on the same result since they observe
 * the same DOM headings.
 */
export function useActiveTocState({
  fallbackId,
  headingIds,
}: {
  fallbackId: string
  headingIds?: string[]
}) {
  const headingKey = useMemo(() => headingIds?.join('\0') ?? '', [headingIds])
  const validIds = useMemo(() => new Set(headingIds ?? []), [headingKey])

  const getSnapshot = useCallback(
    () => computeActiveId(validIds, fallbackId),
    [validIds, fallbackId],
  )

  const getServerSnapshot = useCallback(() => fallbackId, [fallbackId])

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const onScroll = () => {
        // After the programmatic scroll-to-hash finishes (scrollend fired),
        // any new scroll event must be user-initiated (scrollbar drag,
        // browser extension, etc.) — reset hash authority.
        if (programmaticScrollDone) {
          hashIsAuthoritative = false
          programmaticScrollDone = false
        }
        onStoreChange()
      }
      const onHash = () => {
        hashIsAuthoritative = true
        programmaticScrollDone = false
        onStoreChange()
      }
      // User-intent signals: these events only fire from physical input,
      // never from programmatic scrollIntoView() or scrollTo().
      const onUserScroll = () => {
        hashIsAuthoritative = false
        programmaticScrollDone = false
        // No need to call onStoreChange here — the scroll event that
        // follows will trigger re-render with the updated flag.
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (!SCROLL_KEYS.has(e.key)) return
        // Ignore scroll keys when focus is inside an input/textarea/select
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        hashIsAuthoritative = false
        programmaticScrollDone = false
      }
      // scrollend fires once after any scroll sequence (programmatic or manual)
      // completes. When hash is authoritative, this marks the scroll-to-hash
      // animation as finished so the next scroll event can reset the flag.
      const onScrollEnd = () => {
        if (hashIsAuthoritative) {
          programmaticScrollDone = true
        }
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('scrollend', onScrollEnd, { passive: true })
      window.addEventListener('hashchange', onHash)
      window.addEventListener('popstate', onHash)
      window.addEventListener(HEADING_CLICK_EVENT, onHash)
      window.addEventListener('wheel', onUserScroll, { passive: true })
      window.addEventListener('touchstart', onUserScroll, { passive: true })
      window.addEventListener('keydown', onKeyDown, { passive: true })
      return () => {
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('scrollend', onScrollEnd)
        window.removeEventListener('hashchange', onHash)
        window.removeEventListener('popstate', onHash)
        window.removeEventListener(HEADING_CLICK_EVENT, onHash)
        window.removeEventListener('wheel', onUserScroll)
        window.removeEventListener('touchstart', onUserScroll)
        window.removeEventListener('keydown', onKeyDown)
      }
    },
    [headingKey],
  )

  const activeId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return useMemo(() => ({ activeId }), [activeId])
}
