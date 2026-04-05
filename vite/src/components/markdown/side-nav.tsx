'use client'

/**
 * SideNav — Agentation-style left sidebar.
 * Reads navigation from `data.ts` (static) and active page state from
 * `useHolocronData()` (per-request). Hosts the sidebar search input.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { flushSync } from 'react-dom'
import { router } from 'spiceflow/react'
import { useActiveTocState } from '../../hooks/use-active-toc.ts'
import { getActiveGroups } from '../../navigation.ts'
import { createSearchDb, searchSidebar, emptySearchState, type SearchState } from '../../lib/search.ts'
import {
  navigation as siteNavigation,
  searchEntries as siteSearchEntries,
  collectDefaultExpandedKeys,
} from '../../data.ts'
import { useHolocronData } from '../../router.ts'
import { SearchIcon } from './icons.tsx'
import { NavGroupNode } from './nav-tree.tsx'

/**
 * Zero-prop sidebar — reads navigation from the shared static module
 * (`data.ts`) and per-request state (currentPageHref, ancestorGroupKeys)
 * from the Spiceflow loader via `useHolocronData()`.
 *
 * Static imports like `siteNavigation` and `siteSearchEntries` are
 * bundled into the client chunk ONCE and cached — they never travel
 * through the per-request flight payload.
 */
export function SideNav() {
  const {
    currentPageHref,
    currentHeadings,
    ancestorGroupKeys,
  } = useHolocronData()

  // Active tab's groups. Derived from static nav + current href.
  const groups = useMemo(
    () => getActiveGroups(siteNavigation, currentPageHref ?? '/'),
    [currentPageHref],
  )

  const fallbackId = currentHeadings[0]?.slug ?? ''
  const { activeId } = useActiveTocState({ fallbackId })

  // Seed expanded-groups with:
  //  - Ancestors of the current page (always — ensures the current page is
  //    visible in the sidebar after deep-linking / SSR).
  //  - Groups that the config marks `expanded: true` by default.
  // Both sets use the same path-based key (`\0`-joined group names), so
  // merging them into one Set is safe.
  const defaultExpandedKeys = useMemo(
    () => collectDefaultExpandedKeys(groups),
    [groups],
  )
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set([...ancestorGroupKeys, ...defaultExpandedKeys]),
  )

  // Re-expand ancestor groups when currentPage changes (client-side navigation).
  // `ancestorGroupKeys` comes from the loader — it updates atomically with the
  // new flight payload. Instead of syncing in a `useEffect`, we adjust the
  // state during render: compare the incoming prop against a ref, call
  // `setExpandedGroups` if it changed, and React will bail out of this render
  // pass and restart with the merged Set. This is the recommended React
  // pattern for "adjusting state when a prop changes" (no extra paint, no
  // effect scheduling). See:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const prevAncestorKeysRef = useRef(ancestorGroupKeys)
  if (prevAncestorKeysRef.current !== ancestorGroupKeys) {
    prevAncestorKeysRef.current = ancestorGroupKeys
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      for (const key of ancestorGroupKeys) {
        next.add(key)
      }
      return next
    })
  }

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }, [])

  // --- Search ---
  // Use the static flat entry list from data.ts — built once at module load,
  // not per render. The Orama DB is still memoized per mount.
  const db = useMemo(
    () => createSearchDb({ entries: siteSearchEntries }),
    [],
  )

  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState<SearchState>(emptySearchState)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const highlightedRef = useRef<HTMLAnchorElement>(null)
  const [isPending, startTransition] = useTransition()

  // Derive the href of the currently highlighted match — passed down through
  // NavGroupNode/NavPageLink/TocInline so the matching link renders a tint.
  const highlightedHref: string | null = (
    searchState.focusableHrefs && searchState.focusableHrefs.length > 0
      ? searchState.focusableHrefs[highlightedIndex] ?? null
      : null
  )

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      startTransition(() => {
        setSearchState(searchSidebar({ db, query: value, entries: siteSearchEntries }))
        setHighlightedIndex(0)
      })
    },
    [db],
  )

  // Global F hotkey to focus search input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleQueryChange('')
        searchInputRef.current?.blur()
        return
      }
      const focusable = searchState.focusableHrefs
      if (!focusable || focusable.length === 0) return
      if (e.key === 'ArrowDown') {
        // Wrap-around: at last item, jump back to first.
        e.preventDefault()
        // `flushSync` forces React to commit the state change synchronously so
        // `highlightedRef` points at the newly highlighted element before we
        // scroll it into view. Handles the side effect at its event-handler
        // source instead of reacting to `highlightedIndex` changes in an effect.
        flushSync(() => {
          setHighlightedIndex((prev) => (prev + 1) % focusable.length)
        })
        highlightedRef.current?.scrollIntoView({ block: 'nearest' })
      } else if (e.key === 'ArrowUp') {
        // Wrap-around: at first item, jump to last.
        e.preventDefault()
        flushSync(() => {
          setHighlightedIndex((prev) => (prev - 1 + focusable.length) % focusable.length)
        })
        highlightedRef.current?.scrollIntoView({ block: 'nearest' })
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const href = focusable[highlightedIndex]
        if (href) {
          handleQueryChange('')
          searchInputRef.current?.blur()
          // router.push handles both path + hash hrefs (e.g. "/guides/intro"
          // or "/guides/intro#setup"). Never set window.location.hash — that
          // produces broken URLs like "current-url#/guides/intro".
          router.push(href)
        }
      }
    },
    [searchState.focusableHrefs, highlightedIndex, handleQueryChange],
  )

  return (
    <aside className='flex flex-col max-w-(--grid-toc-width) min-h-0'>
      {/* Search input — leading magnifier icon + F hotkey kbd on the right.
          Input stays a real text field (not a button opening a dialog).
          `pl-1` mirrors the nav below so the search input aligns
          horizontally with the nav links. */}
      <div className='pb-3 pl-1 flex items-center relative shrink-0'>
        <span
          aria-hidden='true'
          className='absolute left-3 pointer-events-none inline-flex items-center justify-center'
          style={{ color: 'var(--text-secondary)' }}
        >
          <SearchIcon />
        </span>
        <input
          ref={searchInputRef}
          type='text'
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder='Search...'
          className='w-full text-sm outline-none box-border'
          style={{
            padding: '6px 34px 6px 34px',
            fontFamily: 'var(--font-primary)',
            fontWeight: 'var(--weight-prose)',
            color: 'var(--text-primary)',
            background: 'transparent',
            border: '1px solid var(--page-border)',
            borderRadius: '6px',
            letterSpacing: 'normal',
            lineHeight: 'var(--lh-prose)',
            transition: 'border-color 0.15s ease, opacity 0.1s ease',
            opacity: isPending ? 0.5 : 1,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--text-tertiary)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--page-border)' }}
        />
        {!query && (
          <span
            aria-hidden='true'
            className='absolute right-2.5 pointer-events-none uppercase'
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              border: '1px solid var(--text-tertiary)',
              borderRadius: '4px',
              padding: '0px 4px',
              lineHeight: '16px',
            }}
          >
            F
          </span>
        )}
      </div>

      {/* `pl-1` gives the search-highlight box-shadow 4px of horizontal
          clearance inside nav's overflow-y-auto clip (browsers force both
          axes to auto when one is). `pr-1` was already there for scrollbar
          clearance. */}
      <nav aria-label='Navigation' className='overflow-y-auto min-h-0 pl-1 pr-1 flex flex-col gap-2'>
        {groups.map((group) => (
          <NavGroupNode
            key={group.group}
            group={group}
            depth={0}
            parentPath=''
            currentPageHref={currentPageHref}
            expandedGroups={expandedGroups}
            onToggleGroup={toggleGroup}
            activeHeadingId={activeId}
            searchState={searchState}
            highlightedHref={highlightedHref}
            highlightedRef={highlightedRef}
          />
        ))}
      </nav>
    </aside>
  )
}
