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
 * by Spiceflow's router for pushState navigations), the hash is authoritative
 * until the user scrolls. This handles:
 * - No-scroll pages: user can't scroll → hash always wins
 * - Bottom-of-page headings: heading can't reach the threshold line → hash
 *   stays active until user scrolls away
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
 * Set to true on hashchange, reset to false on user scroll.
 *
 * This replaces a time-based grace period with an intent-based one:
 * the hash wins until the user actively scrolls away from it.
 */
let hashIsAuthoritative = false

/**
 * Timestamp of the last hashchange event. Scroll events within SCROLL_SETTLE_MS
 * after a hashchange are ignored — they come from scrollIntoView() triggered by
 * the router, not from the user manually scrolling.
 */
let lastHashChangeTime = 0
const SCROLL_SETTLE_MS = 150

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
      const onScroll = () => {
        // Ignore scroll events caused by scrollIntoView() after a hash click
        if (Date.now() - lastHashChangeTime < SCROLL_SETTLE_MS) return
        hashIsAuthoritative = false
        onStoreChange()
      }
      const onHash = () => {
        hashIsAuthoritative = true
        lastHashChangeTime = Date.now()
        onStoreChange()
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      window.addEventListener('hashchange', onHash)
      window.addEventListener('popstate', onHash)
      return () => {
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('hashchange', onHash)
        window.removeEventListener('popstate', onHash)
      }
    },
    [headingKey],
  )

  const activeId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return useMemo(() => ({ activeId }), [activeId])
}
