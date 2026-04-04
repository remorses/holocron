'use client'

/**
 * Shared hook for tracking which heading is currently active in the viewport.
 * Uses IntersectionObserver on elements with [data-toc-heading="true"][id]
 * and useSyncExternalStore for tear-free reads.
 *
 * Extracted from markdown.tsx so both the left-sidebar TableOfContents and
 * the right-sidebar TableOfContentsPanel can share the same scroll state.
 */

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'

export type ActiveTocSnapshot = {
  activeId: string
  visibleIds: string[]
}

function sameStringArrays(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false
  }

  return a.every((value, index) => {
    return value === b[index]
  })
}

function sortVisibleHeadingIds(ids: Iterable<string>): string[] {
  return [...ids].sort((a, b) => {
    const elA = document.getElementById(a)
    const elB = document.getElementById(b)
    if (!elA || !elB) {
      return 0
    }
    return elA.getBoundingClientRect().top - elB.getBoundingClientRect().top
  })
}

/** Track both the observer-driven active heading and the headings currently in view.
 * TableOfContents can then derive the effective active item from viewport evidence
 * plus the latest manual click instead of adding more mirrored flags. */
export function useActiveTocState({
  fallbackId,
}: {
  fallbackId: string
}) {
  const snapshotRef = useRef<ActiveTocSnapshot>({ activeId: fallbackId, visibleIds: [] })

  const subscribe = useCallback((onStoreChange: () => void) => {
    const visibleIds = new Set<string>()

    const emit = (next: ActiveTocSnapshot) => {
      if (
        snapshotRef.current.activeId === next.activeId &&
        sameStringArrays(snapshotRef.current.visibleIds, next.visibleIds)
      ) {
        return
      }

      snapshotRef.current = next
      onStoreChange()
    }

    const emitFromVisibleIds = () => {
      const nextVisibleIds = sortVisibleHeadingIds(visibleIds)
      const nextActiveId = nextVisibleIds.at(-1) ?? snapshotRef.current.activeId
      emit({ activeId: nextActiveId, visibleIds: nextVisibleIds })
    }

    const hash = window.location.hash.replace(/^#/, '')
    if (hash) {
      emit({ activeId: hash, visibleIds: snapshotRef.current.visibleIds })
    }

    const headings = document.querySelectorAll<HTMLElement>('[data-toc-heading="true"][id]')

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.target.id) {
            return
          }

          if (entry.isIntersecting) {
            visibleIds.add(entry.target.id)
          } else {
            visibleIds.delete(entry.target.id)
          }
        })

        emitFromVisibleIds()
      },
      {
        /* -80px ≈ header-row-height; accounts for sticky header covering top of viewport */
        rootMargin: '-80px 0px -75% 0px',
        threshold: 0,
      },
    )

    headings.forEach((heading) => {
      observer.observe(heading)
    })

    const onHashChange = () => {
      const nextHash = window.location.hash.replace(/^#/, '')
      if (!nextHash) {
        return
      }

      emit({ activeId: nextHash, visibleIds: snapshotRef.current.visibleIds })
    }

    window.addEventListener('hashchange', onHashChange)

    return () => {
      window.removeEventListener('hashchange', onHashChange)
      observer.disconnect()
    }
  }, [])

  const getSnapshot = useCallback(() => {
    return snapshotRef.current
  }, [])

  // getServerSnapshot must return a cached value to avoid an infinite loop.
  // React calls getServerSnapshot during render and compares by reference.
  const serverSnapshot = useMemo(() => ({ activeId: fallbackId, visibleIds: [] as string[] }), [fallbackId])
  const getServerSnapshot = useCallback(() => serverSnapshot, [serverSnapshot])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
