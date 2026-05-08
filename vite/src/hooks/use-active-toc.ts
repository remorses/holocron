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
 *
 * Scrollbar drag: `wheel`/`touchstart` don't fire when dragging the browser
 * scrollbar. To handle this, `scrollend` marks the programmatic scroll-to-hash
 * as complete; any `scroll` event AFTER that must be user-initiated (scrollbar
 * drag, browser extension, etc.) and resets hashIsAuthoritative.
 *
 * Same-hash re-click: when the URL already has the target hash, Spiceflow
 * skips the synthetic hashchange (hash didn't change). The onClick handler
 * dispatches a custom event so useSyncExternalStore gets a re-render signal.
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
