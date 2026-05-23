'use client'

/**
 * SideNav — Agentation-style left sidebar.
 * Reads navigation from loader data and active page state from
 * `useHolocronData()` (per-request) and `useRouterState()`. Hosts the sidebar search input.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { flushSync } from 'react-dom'
import { Link, router, useRouterState } from 'spiceflow/react'
import { useActiveTocState } from '../../hooks/use-active-toc.ts'
import { getActiveGroups } from '../../navigation.ts'
import { createSearchDb, searchSidebar, buildFocusableHrefs, type SearchState } from '../../lib/search.ts'
import { useHolocronData } from '../../router.ts'
import { buildSearchEntries, buildSidebarAnchors, collectAncestorGroupKeys, collectDefaultExpandedKeys } from '../../site-data.ts'
import { SearchIcon } from '../markdown/icons.tsx'
import { Icon } from '../icon.tsx'
import { NavGroupNode, SidebarTreeProvider } from './nav-tree.tsx'

// Search shortcut hint detection.
// Uses navigator.keyboard.getLayoutMap() (Chrome/Edge) to check if the
// physical Slash key produces "/" directly. If it does, show "/" as the
// hint; otherwise fall back to ⌘K (Mac) or Ctrl K (others). On browsers
// that don't support the Keyboard API (Firefox, Safari), fall back to
// the platform-based hint immediately.
function useSearchShortcutHint(): string {
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
    const fallback = isMac ? '⌘K' : 'Ctrl K'

    const nav = navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } }
    if (!nav.keyboard?.getLayoutMap) {
      setHint(fallback)
      return
    }

    nav.keyboard.getLayoutMap!().then((layoutMap) => {
      const slashChar = layoutMap.get('Slash')
      setHint(slashChar === '/' ? '/' : fallback)
    }).catch(() => {
      setHint(fallback)
    })
  }, [])

  // SSR / first render: return null (hint hidden until detected)
  return hint ?? '⌘K'
}

// Sidebar animation gate — animations are disabled by default, enabled only
// when `<html class="sidebar-animate">` is present. Uses a MutationObserver
// so toggling the class at runtime works (same pattern as dark mode detection).
const getSidebarAnimate = () => document.documentElement.classList.contains('sidebar-animate')
const getServerSidebarAnimate = () => false
function subscribeSidebarAnimate(cb: () => void) {
  const observer = new MutationObserver(cb)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

/**
 * Zero-prop sidebar — reads navigation from the root loader `site` object
 * and per-request state (currentPageHref, ancestorGroupKeys)
 * from the Spiceflow loader via `useHolocronData()`.
 */
export function SideNav() {
  const searchShortcutHint = useSearchShortcutHint()
  const sidebarAnimate = useSyncExternalStore(subscribeSidebarAnimate, getSidebarAnimate, getServerSidebarAnimate)
  const {
    site,
    currentPageHref,
    currentHeadings,
    ancestorGroupKeys,
  } = useHolocronData()
  const { pathname } = useRouterState()
  const effectiveCurrentPageHref = pathname || currentPageHref
  const siteConfig = site.config
  const searchEntries = useMemo(() => buildSearchEntries(site), [site])
  const sidebarAnchors = useMemo(() => buildSidebarAnchors(site), [site])

  // Active tab's groups. Derived from static nav + current href.
  const groups = useMemo(
    () => getActiveGroups(site.navigation, effectiveCurrentPageHref ?? '/'),
    [effectiveCurrentPageHref, site],
  )
  const effectiveAncestorGroupKeys = useMemo(() => {
    if (!effectiveCurrentPageHref) return ancestorGroupKeys
    return collectAncestorGroupKeys(site, effectiveCurrentPageHref)
  }, [ancestorGroupKeys, effectiveCurrentPageHref, site])

  const headingIds = useMemo(() => currentHeadings.map((heading) => heading.slug), [currentHeadings])
  const fallbackId = headingIds[0] ?? ''
  const { activeId } = useActiveTocState({ fallbackId, headingIds })

  // Seed expanded-groups with:
  //  - Ancestors of the current page (always — ensures the current page is
  //    visible in the sidebar after deep-linking / SSR).
  //  - Groups that the config marks `expanded: true` by default.
  const defaultExpandedKeys = useMemo(
    () => collectDefaultExpandedKeys(groups),
    [groups],
  )
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(defaultExpandedKeys),
  )
  const effectiveExpandedGroups = useMemo(() => {
    return new Set([...expandedGroups, ...effectiveAncestorGroupKeys])
  }, [effectiveAncestorGroupKeys, expandedGroups])

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

  // Global ⌘K / Ctrl+K / "/" hotkey to focus search input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }
      // "/" shortcut — only when no input/textarea is focused (standard convention)
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
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
      currentPageHref: effectiveCurrentPageHref,
      expandedGroups: effectiveExpandedGroups,
      onToggleGroup: toggleGroup,
      activeHeadingId: activeId,
      searchState,
      highlightedHref,
      highlightedRef,
      animate: sidebarAnimate,
    }
  }, [activeId, effectiveCurrentPageHref, effectiveExpandedGroups, highlightedHref, searchState, sidebarAnimate, toggleGroup])

  return (
    <aside className='flex flex-col max-w-(--grid-nav-width) min-h-0 text-sm'>
      {/* Search input — leading magnifier icon + F hotkey kbd on the right. */}
      <div className='pb-3 pl-1 pr-1 flex items-center relative shrink-0'>
        <span
          aria-hidden='true'
          className='absolute left-3.5 pointer-events-none inline-flex items-center justify-center'
          style={{ color: 'var(--muted-foreground)' }}
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
          className={`w-full outline-none box-border search-input${query ? ' search-input-active' : ''}`}
          style={{
            padding: '6px 34px 6px 28px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 'var(--weight-prose)',
            color: 'var(--foreground)',
            background: 'transparent',
            letterSpacing: 'normal',
            lineHeight: 'var(--lh-prose)',
            opacity: isPending ? 0.5 : 1,
          }}
        />
        {query ? (
          <button
            type='button'
            onClick={() => {
              handleQueryChange('')
              searchInputRef.current?.focus()
            }}
            className='absolute right-2.5 flex items-center justify-center size-5 rounded-sm cursor-pointer border-none bg-transparent transition-colors'
            style={{ color: 'var(--muted-foreground)' }}
            aria-label='Clear search'
          >
            <svg width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round'>
              <path d='M2 2l8 8M10 2l-8 8' />
            </svg>
          </button>
        ) : (
          <span
            aria-hidden='true'
            className='absolute right-2.5 pointer-events-none flex items-center gap-1'
            style={{ color: 'var(--muted-foreground)' }}
          >
            <kbd
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '12px',
                fontWeight: 500,
                lineHeight: '18px',
                padding: '0 5px',
                border: '1px solid var(--text-tertiary)',
                borderRadius: '5px',
              }}
            >
              {searchShortcutHint}
            </kbd>
          </span>
        )}
      </div>

      {/* `pl-1` gives the search-highlight box-shadow 4px of horizontal
          clearance inside nav's overflow-y-auto clip. */}
      <nav aria-label='Navigation' className='overflow-y-auto scrollbar-stable min-h-0 pl-1 pr-1 pb-6 flex flex-col gap-2'>
        {/* Sidebar anchors — external links like GitHub, Discord, etc.
            Rendered above the nav groups, matching Mintlify's sidebar anchor placement. */}
        {sidebarAnchors.length > 0 && (
          <SidebarAnchors anchors={sidebarAnchors} />
        )}
        <SidebarTreeProvider value={sidebarTreeContext}>
          {noResults ? (
            <div
              className='px-1 py-4 text-center'
              style={{ color: 'var(--muted-foreground)' }}
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

/** Anchor links rendered at the top of the sidebar — external links like
 *  GitHub, Discord, npm, Changelog, etc. Each anchor has an icon inside a
 *  small rounded square, matching Mintlify's sidebar anchor placement. */
function SidebarAnchors({ anchors }: { anchors: ReturnType<typeof buildSidebarAnchors> }) {
  return (
    <div className='flex flex-col gap-2.5 mt-2 mb-0.5'>
      {anchors.map((anchor) => {
        const isExternal = anchor.href.startsWith('http')
        return (
          <Link
            key={anchor.href}
            href={anchor.href}
            {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className='no-underline flex items-center gap-1.5 hover:[background:var(--accent)] hover:rounded-[4px] hover:[box-shadow:0_0_0_4px_var(--accent)]'
            style={{
              color: 'var(--sidebar-foreground)',
              fontVariationSettings: '"wght" 450',
              transition: 'color 0.15s',
            }}
          >
            <Icon icon={anchor.icon} size={12} />
            <span>{anchor.label}</span>
            {isExternal && <span className='ml-auto mr-3 opacity-50'>↗</span>}
          </Link>
        )
      })}
    </div>
  )
}
