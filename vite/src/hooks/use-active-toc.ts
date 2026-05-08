'use client'

/**
 * Shared hook for tracking which heading is currently active in the viewport.
 *
 * Uses a scroll listener to find the last heading that scrolled above the
 * top navbar offset. Falls back to the URL hash, then to the first heading.
 *
 * Scroll-based approach is more predictable than IntersectionObserver:
 * no rootMargin magic, no visible-set tracking — just "which heading is
 * closest to the top of the viewport?"
 *
 * Hash priority: after a hashchange event (including synthetic ones dispatched
 * by Spiceflow's router for pushState navigations) OR a direct heading click,
 * the hash is authoritative until the user manually scrolls. This handles:
 * - No-scroll pages: user can't scroll → hash always wins
 * - Bottom-of-page headings: heading can't reach the threshold line → hash
 *   stays active until user scrolls away
 *
 * User-intent detection: instead of a fragile time-based grace period
 * (SCROLL_SETTLE_MS), we detect genuine user scroll via `wheel`, `touchstart`,
 * and scroll-key `keydown` events. These never fire from programmatic
 * scrollIntoView() calls, so hash priority survives the scroll-to-hash
 * animation regardless of its duration.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react'

/**
 * A heading counts as "active" when its top edge reaches the fixed-header
 * offset. This tracks the section currently at the top of the page instead
 * of switching early when a heading gets near the viewport center.
 */
const ACTIVE_HEADING_OFFSET = 50

/**
 * When true, the URL hash takes priority over scroll-based detection.
 * Set to true on hashchange or heading click, reset to false only by
 * genuine user scroll input (wheel, touch, keyboard scroll keys).
 */
let hashIsAuthoritative = false

/** Keys that cause the browser to scroll the page. */
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'])

/**
 * Call this from heading link onClick handlers as a safety net.
 * Ensures hashIsAuthoritative is set even if the synthetic hashchange
 * from Spiceflow's router is delayed or missing.
 */
export function notifyHeadingClick() {
  hashIsAuthoritative = true
}

export type ActiveTocSnapshot = {
  activeId: string
}

/**
 * Find the active heading based on scroll position + hash state.
 *
 * When hashIsAuthoritative (user just clicked a heading link), the hash wins.
 * Otherwise, find the last heading above the fixed-header offset.
 */
export function computeActiveId(validIds: Set<string>, fallbackId: string): string {
  const hash = window.location.hash.replace(/^#/, '')

  // Hash is authoritative after a hashchange until the user scrolls
  if (hashIsAuthoritative && hash && validIds.has(hash)) {
    return hash
  }

  // On non-scrollable pages, scroll-based detection is meaningless — all
  // headings sit at their initial positions. The hash (from cross-page
  // navigation or direct URL) is the only useful signal.
  if (hash && validIds.has(hash) && document.documentElement.scrollHeight <= window.innerHeight + 1) {
    return hash
  }

  const headings = document.querySelectorAll<HTMLElement>('[data-toc-heading="true"][id]')
  let candidate = ''

  for (const heading of headings) {
    if (!validIds.has(heading.id)) continue
    if (heading.getBoundingClientRect().top <= ACTIVE_HEADING_OFFSET) {
      candidate = heading.id
    } else {
      break
    }
  }

  return candidate || fallbackId
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
      // Scroll events trigger a re-render so the active heading updates,
      // but do NOT reset hashIsAuthoritative. Programmatic scrolls (from
      // scrollIntoView after a hash click) also fire scroll events, and
      // we can't distinguish them from user scrolls by timing alone.
      const onScroll = () => {
        onStoreChange()
      }
      const onHash = () => {
        hashIsAuthoritative = true
        onStoreChange()
      }
      // User-intent signals: these events only fire from physical input,
      // never from programmatic scrollIntoView() or scrollTo().
      const onUserScroll = () => {
        hashIsAuthoritative = false
        // No need to call onStoreChange here — the scroll event that
        // follows will trigger re-render with the updated flag.
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (!SCROLL_KEYS.has(e.key)) return
        // Ignore scroll keys when focus is inside an input/textarea/select
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        hashIsAuthoritative = false
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('hashchange', onHash)
      window.addEventListener('popstate', onHash)
      window.addEventListener('wheel', onUserScroll, { passive: true })
      window.addEventListener('touchstart', onUserScroll, { passive: true })
      window.addEventListener('keydown', onKeyDown, { passive: true })
      return () => {
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('hashchange', onHash)
        window.removeEventListener('popstate', onHash)
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
