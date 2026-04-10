'use client'

/**
 * SideNav — Agentation-style left sidebar.
 * Reads navigation from loader data and active page state from
 * `useHolocronData()` (per-request). Hosts the sidebar search input.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { flushSync } from 'react-dom'
import { router } from 'spiceflow/react'
import { useActiveTocState } from '../../hooks/use-active-toc.ts'
import { getActiveGroups } from '../../navigation.ts'
import { createSearchDb, searchSidebar, buildFocusableHrefs, type SearchState } from '../../lib/search.ts'
import { useHolocronData } from '../../router.ts'
import { buildSearchEntries, collectDefaultExpandedKeys } from '../../site-data.ts'
import { SearchIcon } from './icons.tsx'
import { NavGroupNode, SidebarTreeProvider } from './nav-tree.tsx'

/**
 * Zero-prop sidebar — reads navigation from the root loader `site` object
 * and per-request state (currentPageHref, ancestorGroupKeys)
 * from the Spiceflow loader via `useHolocronData()`.
 */
export function SideNav() {
  const {
    site,
    currentPageHref,
    currentHeadings,
    ancestorGroupKeys,
  } = useHolocronData()
  const siteConfig = site.config
  const searchEntries = useMemo(() => buildSearchEntries(site), [site])

  // Active tab's groups. Derived from static nav + current href.
  const groups = useMemo(
    () => getActiveGroups(site.navigation, currentPageHref ?? '/'),
    [currentPageHref, site],
  )

  const fallbackId = currentHeadings[0]?.slug ?? ''
  const { activeId } = useActiveTocState({ fallbackId })

  // Seed expanded-groups with:
  //  - Ancestors of the current page (always — ensures the current page is
  //    visible in the sidebar after deep-linking / SSR).
  //  - Groups that the config marks `expanded: true` by default.
  const defaultExpandedKeys = useMemo(
    () => collectDefaultExpandedKeys(groups),
    [groups],
  )
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set([...ancestorGroupKeys, ...defaultExpandedKeys]),
  )

  // Re-expand ancestor groups when currentPage changes (client-side navigation).
  // Adjust state during render — the recommended React pattern for "adjusting
  // state when a prop changes". No effect, no extra paint.
  const prevAncestorKeysRef = useRef(ancestorGroupKeys)
  if (prevAncestorKeysRef.current !== ancestorGroupKeys) {
    prevAncestorKeysRef.current = ancestorGroupKeys
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      for (const key of ancestorGroupKeys) next.add(key)
      return next
    })
  }

  const toggleGroup = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) next.delete(groupKey)
      else next.add(groupKey)
      return next
    })
  }, [])

  // --- Search ---
  const db = useMemo(
    () => createSearchDb({ entries: searchEntries }),
    [searchEntries],
  )

  const [query, setQuery] = useState('')
  // null = no active search (show everything). Non-null = active filter.
  const [searchState, setSearchState] = useState<SearchState | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const highlightedRef = useRef<HTMLAnchorElement>(null)
  const [isPending, startTransition] = useTransition()

  // Focusable hrefs in document order — derived from the static entries list
  // so arrow-key cycling matches the rendered order.
  const focusableHrefs = useMemo(
    () => (searchState ? buildFocusableHrefs(searchState, searchEntries) : []),
    [searchState, searchEntries],
  )

  const highlightedHref: string | null = focusableHrefs[highlightedIndex] ?? null

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      startTransition(() => {
        setSearchState(searchSidebar({ db, query: value, entries: searchEntries }))
        setHighlightedIndex(0)
      })
    },
    [db, searchEntries],
  )

  // Global F hotkey to focus search input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target
        if (!(target instanceof HTMLElement)) return
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
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
      if (!focusableHrefs.length) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        flushSync(() => {
          setHighlightedIndex((prev) => (prev + 1) % focusableHrefs.length)
        })
        highlightedRef.current?.scrollIntoView({ block: 'nearest' })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        flushSync(() => {
          setHighlightedIndex((prev) => (prev - 1 + focusableHrefs.length) % focusableHrefs.length)
        })
        highlightedRef.current?.scrollIntoView({ block: 'nearest' })
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const href = focusableHrefs[highlightedIndex]
        if (href) {
          handleQueryChange('')
          searchInputRef.current?.blur()
          router.push(href)
        }
      }
    },
    [focusableHrefs, highlightedIndex, handleQueryChange],
  )

  const isSearchActive = searchState !== null
  const noResults = isSearchActive && focusableHrefs.length === 0
  const sidebarTreeContext = useMemo(() => {
    return {
      currentPageHref,
      expandedGroups,
      onToggleGroup: toggleGroup,
      activeHeadingId: activeId,
      searchState,
      highlightedHref,
      highlightedRef,
    }
  }, [activeId, currentPageHref, expandedGroups, highlightedHref, searchState, toggleGroup])

  return (
    <aside className='flex flex-col max-w-(--grid-toc-width) min-h-0'>
      {/* Search input — leading magnifier icon + F hotkey kbd on the right. */}
      <div className='pb-3 pl-1 flex items-center relative shrink-0'>
        <span
          aria-hidden='true'
          className='absolute left-3.5 pointer-events-none inline-flex items-center justify-center'
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
          placeholder={siteConfig.search.prompt || 'Search...'}
          className='w-full text-sm outline-none box-border'
          style={{
            padding: '6px 34px 6px 28px',
            fontFamily: 'var(--font-primary)',
            fontWeight: 'var(--weight-prose)',
            color: 'var(--text-primary)',
            background: 'transparent',
            border: '1px solid var(--page-border)',
            borderRadius: '12px',
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
          clearance inside nav's overflow-y-auto clip. */}
      <nav aria-label='Navigation' className='overflow-y-auto min-h-0 pl-1 pr-1 flex flex-col gap-2'>
        <SidebarTreeProvider value={sidebarTreeContext}>
          {noResults ? (
            <div
              className='text-xs px-1 py-4 text-center'
              style={{ color: 'var(--text-secondary)' }}
            >
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            groups.map((group) => (
              <NavGroupNode
                key={group.group}
                group={group}
                depth={0}
                parentPath=''
              />
            ))
          )}
        </SidebarTreeProvider>
      </nav>
    </aside>
  )
}
