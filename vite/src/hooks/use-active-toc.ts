'use client'

/**
 * Shared hook for tracking which heading is currently active in the viewport.
 *
 * Uses a scroll listener to find the last heading that scrolled above the
 * sticky header (80px). Falls back to the URL hash, then to the first heading.
 *
 * Scroll-based approach is more predictable than IntersectionObserver:
 * no rootMargin magic, no visible-set tracking — just "which heading is
 * closest to the top of the viewport?"
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react'

/**
 * A heading counts as "active" when it's in the top half of the viewport.
 * This is generous enough that the first heading activates as soon as the
 * page loads (even before any scrolling), and headings near the bottom of
 * the page activate when clicked without needing to scroll past a fixed line.
 */
const ACTIVE_ZONE_RATIO = 0.5

/**
 * Grace period after a hash change during which the hash takes priority over
 * scroll detection. This handles the case where the user clicks a heading near
 * the bottom of the page — the heading can't physically scroll to the 80px
 * line, so without this grace period the previous heading would stay active.
 */
const HASH_GRACE_MS = 1000

/**
 * Hash change detection — tracked inside computeActiveId itself because
 * Spiceflow's <Link> uses pushState for client navigation, which does NOT
 * fire hashchange or popstate events. We detect the change by comparing
 * against the last known hash on every call.
 */
let lastKnownHash = ''
let lastHashTime = 0

export type ActiveTocSnapshot = {
  activeId: string
}

/**
 * Find the last heading element that has scrolled above the header offset.
 * Falls back to the URL hash (if it matches a known heading), then to fallbackId.
 *
 * After a hash change (e.g. clicking a sidebar heading), the hash wins for
 * HASH_GRACE_MS so headings near the bottom of the page activate correctly.
 */
function computeActiveId(validIds: Set<string>, fallbackId: string): string {
  const hash = window.location.hash.replace(/^#/, '')

  // Detect hash changes that pushState doesn't fire events for
  if (hash !== lastKnownHash) {
    lastKnownHash = hash
    if (hash) lastHashTime = Date.now()
  }

  // Hash takes priority right after a navigation click
  if (hash && validIds.has(hash) && Date.now() - lastHashTime < HASH_GRACE_MS) {
    return hash
  }

  const threshold = window.innerHeight * ACTIVE_ZONE_RATIO
  const headings = document.querySelectorAll<HTMLElement>('[data-toc-heading="true"][id]')
  let candidate = ''

  for (const heading of headings) {
    if (heading.getBoundingClientRect().top <= threshold) {
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
      const onHash = () => {
        lastHashTime = Date.now()
        onStoreChange()
      }
      window.addEventListener('scroll', onStoreChange, { passive: true })
      window.addEventListener('hashchange', onHash)
      window.addEventListener('popstate', onHash)
      return () => {
        window.removeEventListener('scroll', onStoreChange)
        window.removeEventListener('hashchange', onHash)
        window.removeEventListener('popstate', onHash)
      }
    },
    [headingKey],
  )

  const activeId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  return useMemo(() => ({ activeId }), [activeId])
}
