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
  observerActiveId: string
  hashId: string
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

function readHashId(validHeadingIds: Set<string>): string {
  if (typeof window === 'undefined') {
    return ''
  }

  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return ''
  if (validHeadingIds.size > 0 && !validHeadingIds.has(hash)) return ''
  return hash
}

function useHashHeadingId(validHeadingIds: Set<string>, headingKey: string): string {
  const getSnapshot = useCallback(() => {
    return readHashId(validHeadingIds)
  }, [validHeadingIds])

  const getServerSnapshot = useCallback(() => '', [])

  const subscribe = useCallback((onStoreChange: () => void) => {
    const emit = () => onStoreChange()
    window.addEventListener('hashchange', emit)
    window.addEventListener('popstate', emit)
    return () => {
      window.removeEventListener('hashchange', emit)
      window.removeEventListener('popstate', emit)
    }
  }, [headingKey])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function useObserverHeadingState(headingKey: string) {
  const snapshotRef = useRef<{ observerActiveId: string; visibleIds: string[] }>({
    observerActiveId: '',
    visibleIds: [],
  })
  const prevHeadingKeyRef = useRef(headingKey)

  if (prevHeadingKeyRef.current !== headingKey) {
    prevHeadingKeyRef.current = headingKey
    snapshotRef.current = { observerActiveId: '', visibleIds: [] }
  }

  const getSnapshot = useCallback(() => {
    return snapshotRef.current
  }, [])

  const getServerSnapshot = useCallback(() => {
    return { observerActiveId: '', visibleIds: [] as string[] }
  }, [])

  const subscribe = useCallback((onStoreChange: () => void) => {
    const visibleIds = new Set<string>()

    const emit = () => {
      const nextVisibleIds = sortVisibleHeadingIds(visibleIds)
      const nextObserverActiveId = nextVisibleIds.at(-1) ?? ''
      if (
        snapshotRef.current.observerActiveId === nextObserverActiveId &&
        sameStringArrays(snapshotRef.current.visibleIds, nextVisibleIds)
      ) {
        return
      }

      snapshotRef.current = {
        observerActiveId: nextObserverActiveId,
        visibleIds: nextVisibleIds,
      }
      onStoreChange()
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

        emit()
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

    emit()

    return () => {
      observer.disconnect()
    }
  }, [headingKey])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Track both the observer-driven active heading and the headings currently in view.
 * TableOfContents can then derive the effective active item from viewport evidence
 * plus the current URL hash instead of mirroring extra state in effects. */
export function useActiveTocState({
  fallbackId,
  headingIds,
}: {
  fallbackId: string
  headingIds?: string[]
}) {
  const headingKey = useMemo(() => headingIds?.join('\0') ?? '', [headingIds])
  const validHeadingIds = useMemo(() => new Set(headingIds ?? []), [headingKey])
  const { observerActiveId, visibleIds } = useObserverHeadingState(headingKey)
  const hashId = useHashHeadingId(validHeadingIds, headingKey)

  return useMemo(() => {
    return {
      activeId: observerActiveId || hashId || fallbackId,
      observerActiveId,
      hashId,
      visibleIds,
    }
  }, [fallbackId, hashId, observerActiveId, visibleIds])
}
