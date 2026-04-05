'use client'
/*
 * Editorial markdown components.
 *
 * All components use CSS variables from globals.css (no prefix).
 * Conflicting names with shadcn: --brand-primary, --brand-secondary,
 * --link-accent, --page-border.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { flushSync } from 'react-dom'
import { useActiveTocState } from '../hooks/use-active-toc.ts'
import { Link, router } from 'spiceflow/react'
import type { TocNodeType, TocTreeNode } from './toc-tree.ts'
import { type NavGroup, type NavPage, type NavHeading, isNavPage, isNavGroup, getActiveGroups } from '../navigation.ts'
import { createSearchDb, searchSidebar, emptySearchState, type SearchState } from './search.ts'
import {
  navigation as siteNavigation,
  siteName as defaultSiteName,
  logoSrc as defaultLogoSrc,
  tabs as siteTabs,
  headerLinks as siteHeaderLinks,
  searchEntries as siteSearchEntries,
} from '../data.ts'
import { useHolocronData } from '../router.ts'

export type { TocNodeType, TocTreeNode }
import * as PrismModule from 'prismjs'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'

const Prism = ((PrismModule as { default?: unknown }).default ?? PrismModule) as typeof PrismModule

/* Custom "diagram" language for ASCII/Unicode box-drawing diagrams.
   Tokenizes box-drawing chars as neutral structure, text as highlighted labels. */
Prism.languages.diagram = {
  'box-drawing': /[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷]+/,
  'line-char': /[-_|<>]+/,
  label: /[^\s┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷\-_|<>]+/,
}

/* =========================================================================
   Typography — weights and spacing are defined as CSS custom properties in
   globals.css (--weight-*, --lh-*, --ls-*). Base classes live in
   editorial.css (.editorial-prose, .editorial-heading, .editorial-h1/h2/h3).
   ========================================================================= */

/* =========================================================================
   TOC sidebar (fixed left) — Agentation-style navigation
   ========================================================================= */

export type HeadingLevel = 1 | 2 | 3

const headingTagByLevel: Record<HeadingLevel, 'h1' | 'h2' | 'h3'> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
}

const headingClassByLevel: Record<HeadingLevel, string> = {
  1: 'editorial-heading editorial-h1',
  2: 'editorial-heading editorial-h2',
  3: 'editorial-heading editorial-h3',
}

/* ── Chevron icon for expandable nested groups ───────────────────────── */

function ChevronIcon({ expanded, className }: { expanded: boolean; className?: string }) {
  return (
    <span className={`shrink-0 self-center inline-flex items-center justify-center p-1 -m-1 cursor-pointer ${className ?? ''}`}>
      <svg
        aria-hidden='true'
        viewBox='0 0 16 16'
        width='12'
        height='12'
        className='transition-transform duration-150'
        style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
      >
        <path d='M6 4l4 4-4 4' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </span>
  )
}

/* ── Search icon (magnifier) for sidebar search input ─────────────────── */

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      width='14'
      height='14'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      <circle cx='11' cy='11' r='8' />
      <path d='m21 21-4.34-4.34' />
    </svg>
  )
}

/* ── Inline TOC (flat heading list under active page) ────────────────── */

/** Flat list of headings shown under the active page in the sidebar.
 *  All headings are rendered at the same level regardless of depth,
 *  matching the Agentation website pattern. Includes a guide line and
 *  animated active indicator bar. */
function TocInline({ headings, activeId, searchState, pageHref, highlightedHref, highlightedRef }: { headings: NavHeading[]; activeId: string; searchState: SearchState; pageHref: string; highlightedHref: string | null; highlightedRef: React.RefObject<HTMLAnchorElement | null> }) {
  const listRef = useRef<HTMLUListElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)

  // Single effect: position the active-heading indicator bar and keep it
  // aligned when the list resizes. The update closure is defined inside the
  // effect so it closes over the current `activeId` without needing a
  // `useCallback`, and the effect has exactly one dependency.
  useEffect(() => {
    const updateIndicator = () => {
      const list = listRef.current
      const indicator = indicatorRef.current
      if (!list || !indicator) return

      const activeLink = list.querySelector<HTMLElement>(`a[href="#${activeId}"]`)
      if (!activeLink) {
        indicator.style.opacity = '0'
        return
      }

      const listRect = list.getBoundingClientRect()
      const linkRect = activeLink.getBoundingClientRect()
      const top = linkRect.top - listRect.top
      const height = linkRect.height

      indicator.style.transform = `translateY(${top}px)`
      indicator.style.height = `${height}px`
      indicator.style.opacity = '1'
    }

    updateIndicator()

    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(updateIndicator)
    observer.observe(list)
    return () => observer.disconnect()
  }, [activeId])

  return (
    <div className='relative mt-1.5 pl-0.5 pb-2'>
      {/* Guide line (decorative, outside <ul> for valid HTML) */}
      <div
        aria-hidden
        className='pointer-events-none absolute rounded-full'
        style={{
          insetBlockStart: 'calc(6px + 6px)',
          insetBlockEnd: 0,
          insetInlineStart: 0,
          width: '1.5px',
          backgroundColor: 'var(--border-subtle)',
        }}
      />
      {/* Active indicator bar (decorative, outside <ul>) */}
      <div
        ref={indicatorRef}
        aria-hidden
        className='pointer-events-none absolute rounded-full'
        style={{
          insetInlineStart: 0,
          width: '1.5px',
          backgroundColor: 'var(--sidebar-toc-indicator)',
          transition: 'transform 0.26s cubic-bezier(0.25, 0.46, 0.45, 0.94), height 0.26s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.15s',
          opacity: 0,
        }}
      />
      <ul
        ref={listRef}
        className='relative list-none m-0 p-0 flex flex-col gap-1.5 pt-1.5 pl-3 text-xs leading-[1.33] box-content'
      >
        {headings.map((heading) => {
          const isActive = heading.slug === activeId
          const headingHref = `${pageHref}#${heading.slug}`
          const isDimmed = searchState.dimmedHrefs?.has(headingHref) ?? false
          const isSearchActive = searchState.matchedHrefs !== null
          const isHighlighted = highlightedHref === headingHref
          return (
            <li key={heading.slug} style={{ opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.15s ease' }}>
              <a
                ref={isHighlighted ? highlightedRef : undefined}
                href={`#${heading.slug}`}
                className='block leading-4 no-underline transition-colors duration-[120ms]'
                tabIndex={isDimmed ? -1 : 0}
                style={{
                  color: (isSearchActive && !isDimmed) ? 'var(--sidebar-toc-foreground-active)' : isActive ? 'var(--sidebar-toc-foreground-active)' : 'var(--sidebar-toc-foreground)',
                  fontWeight: (isSearchActive && !isDimmed) ? 500 : isActive ? 500 : 400,
                  background: isHighlighted ? 'var(--selection-bg)' : undefined,
                  borderRadius: isHighlighted ? '4px' : undefined,
                  boxShadow: isHighlighted ? '0 0 0 4px var(--selection-bg)' : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--sidebar-foreground-hover)'
                    e.currentTarget.style.fontVariationSettings = '"wght" 500'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--sidebar-toc-foreground)'
                    e.currentTarget.style.fontVariationSettings = ''
                  }
                }}
              >
                {heading.text}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ── Animated expand/collapse container ──────────────────────────────── */

/**
 * First-paint guard. `false` during SSR and during the initial client render,
 * flips to `true` on the first rAF after module load. Components read it via
 * `useSyncExternalStore` so the render-phase value is tear-free.
 *
 * Used by `ExpandableContainer` to suppress the open/close transition on the
 * initial paint — otherwise groups containing the current page would animate
 * in from height 0 on every page load, causing a visible layout shift.
 */
let firstPaintDone = false
const firstPaintListeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  requestAnimationFrame(() => {
    firstPaintDone = true
    for (const fn of firstPaintListeners) fn()
  })
}

function subscribeFirstPaint(cb: () => void) {
  firstPaintListeners.add(cb)
  return () => { firstPaintListeners.delete(cb) }
}
const getFirstPaintSnapshot = () => firstPaintDone
const getFirstPaintServerSnapshot = () => false

function useFirstPaintDone(): boolean {
  return useSyncExternalStore(subscribeFirstPaint, getFirstPaintSnapshot, getFirstPaintServerSnapshot)
}

/**
 * CSS-grid-based expand/collapse with zero layout shift at hydration time.
 *
 * The parent uses `grid-template-rows: 1fr | 0fr` which modern browsers
 * interpolate smoothly (Chrome 117+, Safari 17.4+, Firefox 125+). The child
 * wraps content in `overflow: hidden` + `min-height: 0` so the grid track
 * can collapse.
 *
 * Why not height measurement? The old implementation seeded `useState(0)`
 * for height, so SSR and first-hydration paint always rendered `height: 0`
 * even for open containers. A `ResizeObserver` then set the real height
 * post-mount, and the CSS transition animated 0 → scrollHeight — a visible
 * layout shift on every page load. With grid, the browser sizes the track
 * from content synchronously during layout, so open containers render at
 * the correct height from the very first paint.
 *
 * `useFirstPaintDone()` additionally disables the transition on the very
 * first render so the opacity fade doesn't run during hydration.
 */
function ExpandableContainer({ open, children }: { open: boolean; children: React.ReactNode }) {
  const canAnimate = useFirstPaintDone()
  return (
    <div
      aria-hidden={!open}
      inert={!open || undefined}
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        opacity: open ? 1 : 0,
        transition: canAnimate
          ? 'grid-template-rows 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s ease'
          : 'none',
      }}
    >
      {/* Inner clip. `overflow: hidden` + `min-height: 0` makes the grid
        * track collapsible. `paddingInline: 4px` + `marginInline: -4px`
        * creates 4px of horizontal clearance INSIDE the clip so children's
        * search-highlight box-shadow (4px spread) renders without being
        * cut off. See MEMORY.md "box-shadow for 'bleed' highlight outlines"
        * for context. */}
      <div style={{
        overflow: 'hidden',
        minHeight: 0,
        paddingInline: '4px',
        marginInline: '-4px',
      }}>{children}</div>
    </div>
  )
}

/* ── Nav page link ───────────────────────────────────────────────────── */

function NavPageLink({
  page,
  currentPageHref,
  activeHeadingId,
  depth,
  searchState,
  highlightedHref,
  highlightedRef,
}: {
  page: NavPage
  currentPageHref?: string
  activeHeadingId: string
  depth: number
  searchState: SearchState
  highlightedHref: string | null
  highlightedRef: React.RefObject<HTMLAnchorElement | null>
}) {
  const isActive = page.href === currentPageHref
  const isDimmed = searchState.dimmedHrefs?.has(page.href) ?? false
  const isSearchActive = searchState.matchedHrefs !== null
  const isHighlighted = highlightedHref === page.href
  /* When search is active and this page matched, expand its TOC so headings are visible */
  const showToc = isSearchActive
    ? (searchState.matchedHrefs?.has(page.href) ?? false) && page.headings.length > 0
    : isActive && page.headings.length > 0
  return (
    <div className='flex flex-col' style={{ opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.15s ease' }}>
      <Link
        ref={isHighlighted ? highlightedRef : undefined}
        href={page.href}
        className='block text-xs no-underline transition-colors duration-150'
        tabIndex={isDimmed ? -1 : 0}
        style={{
          fontVariationSettings: (isActive || (isSearchActive && !isDimmed)) ? '"wght" 550' : '"wght" 450',
          color: (isSearchActive && !isDimmed) ? 'var(--sidebar-foreground-active)' : isActive ? 'var(--sidebar-foreground-active)' : 'var(--sidebar-foreground)',
          paddingLeft: depth > 0 ? `${depth * 12}px` : undefined,
          transition: 'color 0.15s, font-variation-settings 0.25s',
          background: isHighlighted ? 'var(--selection-bg)' : undefined,
          borderRadius: isHighlighted ? '4px' : undefined,
          boxShadow: isHighlighted ? '0 0 0 4px var(--selection-bg)' : undefined,
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            e.currentTarget.style.color = 'var(--sidebar-foreground-hover)'
            e.currentTarget.style.fontVariationSettings = '"wght" 550'
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            e.currentTarget.style.color = 'var(--sidebar-foreground)'
            e.currentTarget.style.fontVariationSettings = '"wght" 450'
          }
        }}
      >
        {page.title}
      </Link>
      <ExpandableContainer open={showToc}>
        {page.headings.length > 0 && (
          <TocInline headings={page.headings} activeId={activeHeadingId} searchState={searchState} pageHref={page.href} highlightedHref={highlightedHref} highlightedRef={highlightedRef} />
        )}
      </ExpandableContainer>
    </div>
  )
}

/* ── Nav group node ──────────────────────────────────────────────────── */

function NavGroupNode({
  group,
  depth,
  parentPath,
  currentPageHref,
  expandedGroups,
  onToggleGroup,
  activeHeadingId,
  searchState,
  highlightedHref,
  highlightedRef,
}: {
  group: NavGroup
  depth: number
  /** Ancestor group names joined by \0 — ensures unique keys even for duplicate group labels */
  parentPath: string
  currentPageHref?: string
  expandedGroups: Set<string>
  onToggleGroup: (groupKey: string) => void
  activeHeadingId: string
  searchState: SearchState
  highlightedHref: string | null
  highlightedRef: React.RefObject<HTMLAnchorElement | null>
}) {
  const groupKey = parentPath ? `${parentPath}\0${group.group}` : group.group

  if (depth === 0) {
    return (
      <div className='flex flex-col gap-2'>
        <div
          className='text-xs cursor-default mt-3 mb-0.5'
          style={{
            fontVariationSettings: '"wght" 500',
            color: 'var(--sidebar-section-foreground)',
          }}
        >
          {group.group}
        </div>
        {group.pages.map((entry) => {
          if (isNavPage(entry)) {
            return (
              <NavPageLink
                key={entry.href}
                page={entry}
                currentPageHref={currentPageHref}
                activeHeadingId={activeHeadingId}
                depth={0}
                searchState={searchState}
                highlightedHref={highlightedHref}
                highlightedRef={highlightedRef}
              />
            )
          }
          if (isNavGroup(entry)) {
            return (
              <NavGroupNode
                key={entry.group}
                group={entry}
                depth={depth + 1}
                parentPath={groupKey}
                currentPageHref={currentPageHref}
                expandedGroups={expandedGroups}
                onToggleGroup={onToggleGroup}
                activeHeadingId={activeHeadingId}
                searchState={searchState}
                highlightedHref={highlightedHref}
                highlightedRef={highlightedRef}
              />
            )
          }
          return null
        })}
      </div>
    )
  }

  /* Merge search expand overrides into the manual expanded state */
  const isExpanded = expandedGroups.has(groupKey) || (searchState.expandGroupKeys?.has(groupKey) ?? false)
  return (
    <div className='flex flex-col'>
      <button
        type='button'
        onClick={() => onToggleGroup(groupKey)}
        aria-expanded={isExpanded}
        className='flex items-center gap-1 text-xs border-none bg-transparent cursor-pointer p-0 text-left transition-colors duration-150'
        style={{
          fontVariationSettings: '"wght" 500',
          color: 'var(--sidebar-foreground)',
          paddingLeft: depth > 0 ? `${(depth - 1) * 12}px` : undefined,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--sidebar-foreground-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--sidebar-foreground)'
        }}
      >
        <ChevronIcon expanded={isExpanded} className='text-(color:--sidebar-section-foreground)' />
        {group.group}
      </button>
      <ExpandableContainer open={isExpanded}>
        <div className='flex flex-col gap-2 pt-2'>
          {group.pages.map((entry) => {
            if (isNavPage(entry)) {
              return (
                <NavPageLink
                  key={entry.href}
                  page={entry}
                  currentPageHref={currentPageHref}
                  activeHeadingId={activeHeadingId}
                  depth={depth}
                  searchState={searchState}
                  highlightedHref={highlightedHref}
                  highlightedRef={highlightedRef}
                />
              )
            }
            if (isNavGroup(entry)) {
              return (
                <NavGroupNode
                  key={entry.group}
                  group={entry}
                  depth={depth + 1}
                  parentPath={groupKey}
                  currentPageHref={currentPageHref}
                  expandedGroups={expandedGroups}
                  onToggleGroup={onToggleGroup}
                  activeHeadingId={activeHeadingId}
                  searchState={searchState}
                  highlightedHref={highlightedHref}
                  highlightedRef={highlightedRef}
                />
              )
            }
            return null
          })}
        </div>
      </ExpandableContainer>
    </div>
  )
}

/* ── SideNav — Agentation-style sidebar navigation ───────────────────── */

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

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(ancestorGroupKeys),
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
          className='absolute left-2 pointer-events-none inline-flex items-center justify-center'
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
          placeholder='search...'
          className='w-full text-sm outline-none lowercase box-border'
          style={{
            padding: '6px 28px 6px 28px',
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
            className='absolute right-1.5 pointer-events-none uppercase'
            style={{
              fontFamily: 'var(--font-code)',
              fontSize: '10px',
              fontWeight: 'var(--weight-regular)',
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

/* =========================================================================
   Back button (fixed top-right)
   ========================================================================= */

export function BackButton() {
  return (
    <Link
      href='/'
      className='fixed top-5 right-5 z-[100000] flex items-center justify-center w-10 h-10 rounded-full no-underline'
      style={{
        background: 'var(--btn-bg)',
        color: 'var(--text-secondary)',
        boxShadow: 'var(--btn-shadow)',
        transition: 'color 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--text-hover)'
        e.currentTarget.style.transform = 'scale(1.05)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-secondary)'
        e.currentTarget.style.transform = 'scale(1)'
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.95)'
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)'
      }}
    >
      <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
        <path
          d='M12.25 7H1.75M1.75 7L6.125 2.625M1.75 7L6.125 11.375'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </Link>
  )
}

/* =========================================================================
   Typography
   ========================================================================= */

export function SectionHeading({
  id,
  level = 1,
  children,
}: {
  id: string
  level?: HeadingLevel
  children: React.ReactNode
}) {
  level ||= 1
  const Tag = headingTagByLevel[level] || 'h4'

  return (
    <Tag
      id={id}
      className={headingClassByLevel[level] || 'editorial-heading'}
      data-toc-heading='true'
      data-toc-level={level}
    >
      <span style={{ whiteSpace: level === 1 ? 'nowrap' : 'normal' }}>{children}</span>
      {level === 1 ? <span style={{ flex: 1, height: '1px', background: 'var(--divider)' }} /> : null}
    </Tag>
  )
}

// Uses <div> instead of <p> to avoid hydration mismatches when MDX content
// contains explicit <p> or <h1> tags whose text children also get wrapped
// by this component (p→P mapping), creating invalid nested <p> elements.
export function P({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`editorial-prose ${className}`}
      style={{ opacity: 0.82 }}
    >
      {children}
    </div>
  )
}

export function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div
      className='editorial-prose'
      style={{
        fontSize: 'var(--type-caption-size)',
        textAlign: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </div>
  )
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      style={{
        color: 'var(--link-accent, #0969da)',
        fontWeight: 'var(--weight-heading)',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.textDecoration = 'underline'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.textDecoration = 'none'
      }}
    >
      {children}
    </a>
  )
}

export function Code({ children }: { children: React.ReactNode }) {
  return <code className='inline-code'>{children}</code>
}

/* =========================================================================
   Layout
   ========================================================================= */

export function Bleed({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginLeft: 'calc(-1 * var(--bleed-image))',
        marginRight: 'calc(-1 * var(--bleed-image))',
        display: 'flex',
        justifyContent: 'center',
        maxWidth: 'calc(100% + 2 * var(--bleed-image))',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

export function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ height: '1px', background: 'var(--divider)', flex: 1 }} />
    </div>
  )
}

export function Section({
  id,
  title,
  level = 1,
  children,
}: {
  id: string
  title: string
  level?: HeadingLevel
  children: React.ReactNode
}) {
  return (
    <>
      <SectionHeading id={id} level={level}>
        {title}
      </SectionHeading>
      {children}
    </>
  )
}

/* Lists bleed left so bullets/numbers hang in the gutter while li TEXT
   aligns with prose paragraphs. `--bleed-list` is 32px at lg (= ul pl-5
   20px + li paddingLeft 12px) and 0 at mobile / inside `.no-bleed`.

   margin-left MUST be an inline style — `.editorial-prose` sets
   `margin: 0` in editorial.css which imports AFTER tailwindcss, so any
   `-ml-*` / `ml-*` utility loses the cascade on equal specificity. */
export function OL({ children }: { children: React.ReactNode }) {
  return (
    <ol
      className='editorial-prose pl-5 flex flex-col gap-(--list-gap)'
      style={{ listStyleType: 'decimal', marginLeft: 'calc(-1 * var(--bleed-list))' }}
    >
      {children}
    </ol>
  )
}

export function List({ children }: { children: React.ReactNode }) {
  return (
    <ul
      className='editorial-prose pl-5 flex flex-col gap-(--list-gap)'
      style={{ listStyleType: 'disc', marginLeft: 'calc(-1 * var(--bleed-list))' }}
    >
      {children}
    </ul>
  )
}

// Li has no vertical padding — the parent ul/ol uses `gap-(--list-gap)`
// for inter-item spacing so first/last items get zero edge space.
export function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ paddingLeft: '12px' }}>{children}</li>
}

/* =========================================================================
   Code block with Prism syntax highlighting and line numbers
   ========================================================================= */

export function CodeBlock({
  children,
  lang = 'jsx',
  lineHeight = '1.6',
  showLineNumbers = true,
}: {
  children: string
  lang?: string
  lineHeight?: string
  showLineNumbers?: boolean
}) {
  const lines = children.split('\n')

  /* Use Prism.highlight() to get highlighted HTML as a string. Works on both
     server and client (no DOM dependency), avoiding hydration mismatch issues
     that occur with useEffect + highlightElement. */
  const highlightedHtml = useMemo(() => {
    const grammar = lang ? Prism.languages[lang] : undefined
    if (!grammar) {
      return undefined
    }
    return Prism.highlight(children, grammar, lang)
  }, [children, lang])

  return (
    <figure className='m-0 bleed'>
      <div className='relative'>
        <pre
          className='overflow-x-auto'
          style={{
            borderRadius: 'var(--border-radius-md)',
            margin: 0,
            padding: 0,
          }}
        >
          <div
            className='flex'
            style={{
              padding: '12px 8px 8px',
              fontFamily: 'var(--font-code)',
              fontSize: 'var(--type-code-size)',
              fontWeight: 'var(--weight-regular)',
              lineHeight,
              letterSpacing: 'normal',
              color: 'var(--text-primary)',
              tabSize: 2,
            }}
          >
            {showLineNumbers && (
              <span
                className='select-none shrink-0'
                aria-hidden='true'
                style={{
                  color: 'var(--code-line-nr)',
                  textAlign: 'right',
                  paddingRight: '20px',
                  width: '36px',
                  userSelect: 'none',
                }}
              >
                {lines.map((_, i) => {
                  return (
                    <span key={i} className='block'>
                      {i + 1}
                    </span>
                  )
                })}
              </span>
            )}
            {highlightedHtml ? (
              <code
                className={lang ? `language-${lang}` : undefined}
                style={{ whiteSpace: 'pre', background: 'none', padding: 0, lineHeight }}
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            ) : (
              <code
                className={lang ? `language-${lang}` : undefined}
                style={{ whiteSpace: 'pre', background: 'none', padding: 0, lineHeight }}
              >
                {children}
              </code>
            )}
          </div>
        </pre>
      </div>
    </figure>
  )
}

/* =========================================================================
   Pixelated placeholder image
   Uses a tiny pre-generated image with CSS image-rendering: pixelated
   (nearest-neighbor / point sampling in GPU terms) for a crisp mosaic
   effect. The real image fades in on top once loaded — no flash because
   the placeholder stays underneath and the real image starts at opacity 0.
   ========================================================================= */

export function PixelatedImage({
  src,
  placeholder,
  alt,
  width,
  height,
  className = '',
  style,
}: {
  src: string
  /**
   * Base64 data URI of the tiny pixelated placeholder image (~2–4KB PNG).
   * Injected automatically by the server-side mdast image processor
   * (website/src/lib/image-cache.ts) — no need to pass manually in MDX.
   * The processor reads each image from public/, generates a 64px-wide
   * placeholder with sharp, and caches it as JSON in .cache/images/.
   */
  placeholder?: string
  alt: string
  width: number
  height: number
  className?: string
  style?: React.CSSProperties
}) {
  const [loaded, setLoaded] = useState(false)

  // Handles both the normal onLoad event and the case where the image is
  // already cached (img.complete is true before React mounts the handler).
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [])

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: `min(${width}px, 100%)`,
        aspectRatio: `${width} / ${height}`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Placeholder: tiny image rendered with nearest-neighbor sampling */}
      {placeholder && (
        <img
          src={placeholder}
          alt=''
          aria-hidden
          width={width}
          height={height}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            imageRendering: 'pixelated',
            zIndex: 0,
          }}
        />
      )}
      {/* Real image: starts invisible, fades in over the placeholder */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        onLoad={() => {
          setLoaded(true)
        }}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: !placeholder || loaded ? 1 : 0,
          transition: 'opacity 0.4s ease',
          zIndex: 1,
        }}
      />
    </div>
  )
}

/* =========================================================================
   Lazy video with pixelated poster placeholder
   Same visual pattern as PixelatedImage but for <video> elements.
   Poster layers (pixelated → real) show through the transparent video element.
   Video uses native loading="lazy" + preload="none" so zero bytes are
   downloaded until the element is near the viewport and the user clicks play.
   No custom IntersectionObserver needed — all native HTML attributes.
   ========================================================================= */

export function LazyVideo({
  src,
  poster,
  placeholderPoster,
  width,
  height,
  type = 'video/mp4',
  className = '',
  style,
}: {
  src: string
  poster: string
  /**
   * URL of the tiny pixelated poster placeholder. Use a static import so Vite
   * inlines it as a base64 data URI (all placeholders are < 4KB, well under
   * Vite's default assetsInlineLimit of 4096 bytes). This makes the
   * placeholder available synchronously on first render with zero HTTP
   * requests. Do NOT use dynamic imports or public/ paths — dynamic imports
   * add a microtask delay, and public/ files bypass Vite's asset pipeline.
   *
   * @example
   * ```tsx
   * import placeholderPoster from "../assets/placeholders/placeholder-demo-poster.png";
   * <LazyVideo placeholderPoster={placeholderPoster} poster="/demo-poster.png" ... />
   * ```
   */
  placeholderPoster: string
  width: number
  height: number
  type?: string
  className?: string
  style?: React.CSSProperties
}) {
  const [posterLoaded, setPosterLoaded] = useState(false)

  // Handles cached poster images (same pattern as PixelatedImage)
  const posterRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) {
      setPosterLoaded(true)
    }
  }, [])

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: `${width}px`,
        aspectRatio: `${width} / ${height}`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Pixelated poster placeholder: loads instantly (~500 bytes) */}
      <img
        src={placeholderPoster}
        alt=''
        aria-hidden
        width={width}
        height={height}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          imageRendering: 'pixelated',
          zIndex: 0,
        }}
      />
      {/* Real poster: fades in over the pixelated placeholder */}
      <img
        ref={posterRef}
        src={poster}
        alt=''
        aria-hidden
        width={width}
        height={height}
        onLoad={() => {
          setPosterLoaded(true)
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: posterLoaded ? 1 : 0,
          transition: 'opacity 0.4s ease',
          zIndex: 1,
        }}
      />
      {/* Video: transparent until playing, native lazy + no preload.
          Controls float on top of poster layers. No poster attr needed
          because the img layers handle the visual placeholder.
          loading="lazy" is a newer HTML attr not yet in React's TS types. */}
      <video
        controls
        preload='none'
        {...({ loading: 'lazy' } as React.VideoHTMLAttributes<HTMLVideoElement>)}
        width={width}
        height={height}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 2,
          background: 'transparent',
        }}
      >
        <source src={src} type={type} />
      </video>
    </div>
  )
}

/* =========================================================================
   Chart placeholder (dark box with animated line)
   ========================================================================= */

export function ChartPlaceholder({ height = 200, label }: { height?: number; label?: string }) {
  return (
    <div className='bleed'>
      <div
        className='w-full overflow-hidden relative'
        style={{
          height: `${height}px`,
          background: 'rgb(17, 17, 17)',
        }}
      >
        <svg viewBox='0 0 550 200' className='absolute inset-0 w-full h-full' preserveAspectRatio='none'>
          <defs>
            <linearGradient id='chartFill' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor='#3b82f6' stopOpacity='0.3' />
              <stop offset='100%' stopColor='#3b82f6' stopOpacity='0' />
            </linearGradient>
          </defs>
          <path
            d='M0,140 C30,135 60,120 90,125 C120,130 150,100 180,95 C210,90 240,110 270,105 C300,100 330,80 360,85 C390,90 420,70 450,65 C480,60 510,75 550,60'
            fill='none'
            stroke='#3b82f6'
            strokeWidth='2'
          />
          <path
            d='M0,140 C30,135 60,120 90,125 C120,130 150,100 180,95 C210,90 240,110 270,105 C300,100 330,80 360,85 C390,90 420,70 450,65 C480,60 510,75 550,60 L550,200 L0,200 Z'
            fill='url(#chartFill)'
          />
          <circle cx='550' cy='60' r='4' fill='#3b82f6'>
            <animate attributeName='r' values='4;6;4' dur='2s' repeatCount='indefinite' />
            <animate attributeName='opacity' values='1;0.6;1' dur='2s' repeatCount='indefinite' />
          </circle>
        </svg>
        {label && (
          <div
            className='absolute top-3 right-3 px-2 py-1 rounded text-xs'
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              fontFamily: 'var(--font-code)',
              fontWeight: 'var(--weight-prose)',
              fontSize: 'var(--type-table-size)',
            }}
          >
            {label}
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================================================================
   Comparison table
   ========================================================================= */

export function ComparisonTable({
  title,
  headers,
  rows,
}: {
  title?: string
  headers: [string, string, string]
  rows: Array<[string, string, string]>
}) {
  return (
    <div className='w-full max-w-full overflow-x-auto'>
      {title && (
        <div
          style={{
            fontFamily: 'var(--font-primary)',
            fontSize: 'var(--type-table-size)',
            fontWeight: 'var(--weight-regular)',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--ls-code)',
            padding: '0 0 6px',
          }}
        >
          {title}
        </div>
      )}
      <table
        className='w-full'
        style={{
          borderSpacing: 0,
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr>
            {headers.map((header) => {
              return (
                <th
                  key={header}
                  className='text-left'
                  style={{
                    padding: '4px 12px 4px 0',
                    fontSize: 'var(--type-table-size)',
                    fontWeight: 'var(--weight-regular)',
                    fontFamily: 'var(--font-primary)',
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--page-border)',
                  }}
                >
                  {header}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(([feature, them, us]) => {
            return (
              <tr key={feature}>
                <td
                  style={{
                    padding: '4px 12px 4px 0',
                    fontSize: 'var(--type-table-size)',
                    fontWeight: 'var(--weight-prose)',
                    fontFamily: 'var(--font-code)',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--page-border)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {feature}
                </td>
                <td
                  style={{
                    padding: '4px 12px 4px 0',
                    fontSize: 'var(--type-table-size)',
                    fontWeight: 'var(--weight-prose)',
                    fontFamily: 'var(--font-code)',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--page-border)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {them}
                </td>
                <td
                  style={{
                    padding: '4px 12px 4px 0',
                    fontSize: 'var(--type-table-size)',
                    fontWeight: 'var(--weight-prose)',
                    fontFamily: 'var(--font-code)',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--page-border)',
                  }}
                >
                  {us}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* =========================================================================
   Tab bar — Mintlify/Notion-style top navigation tabs
   Active tab has 1.5px bottom indicator + faux bold via text-shadow.
   ========================================================================= */

export type { TabItem, HeaderLink } from '../data.ts'

/* =========================================================================
   Aside — MDX component for right-sidebar content.
   On desktop, extracted from content flow and placed in the page grid's
   second subgrid column (col 2 of the sections subgrid). On mobile,
   renders inline as a styled callout at the end of its section.
   ========================================================================= */

/** Aside is a marker component for MDX. On desktop, its children are extracted
 *  by the section grouping logic and rendered in the right sidebar slot.
 *  On mobile, it stacks inline after its section's content.
 *  The component itself is a pass-through.
 *
 *  Use `<Aside full>` to make the aside span every heading-introduced
 *  sub-section after it (until the next `<Aside>` of any kind, or end of
 *  page). Splits happen at every heading level (#, ##, ###, ...) so the
 *  sub-sections still get `--section-gap` between them; the aside sits in
 *  a grid cell with `grid-row: start / span N` so `position: sticky` keeps
 *  it pinned alongside the full range. */
export function Aside({ children, full }: { children: React.ReactNode; full?: boolean }) {
  void full // marker prop — used at parse time, not at render time
  return <>{children}</>
}

/** FullWidth is a marker component for MDX. Its children become a section that
 *  spans both the content and aside columns in the grid layout. */
export function FullWidth({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/* =========================================================================
   Callout — Mintlify-compatible callout primitive. Renders a framed card
   with a leading icon. Used via the generic <Callout> or typed aliases
   (Note / Warning / Info / Tip / Check / Danger). Nests cleanly inside
   <Aside> because Aside itself carries no border of its own.
   ========================================================================= */

/** Tailwind class map per preset type. Each entry drives bg tint, border,
 *  and icon color (via text-*). The body text stays default (--text-primary);
 *  only the icon picks up the variant color through currentColor. */
const CALLOUT_VARIANTS = {
  note:    'bg-blue-500/[0.03] border-blue-500/15 text-blue-700 dark:text-blue-400',
  warning: 'bg-amber-500/[0.03] border-amber-500/15 text-amber-700 dark:text-amber-400',
  info:    'bg-blue-500/[0.03] border-blue-500/15 text-blue-700 dark:text-blue-400',
  tip:     'bg-emerald-500/[0.03] border-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  check:   'bg-emerald-500/[0.03] border-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  danger:  'bg-red-500/[0.03] border-red-500/15 text-red-700 dark:text-red-400',
} as const

export type CalloutType = keyof typeof CALLOUT_VARIANTS

/** Preset inline SVG icons for typed callouts. Each uses currentColor so it
 *  inherits the variant's text-* class from the wrapper. */
const CALLOUT_ICONS: Record<CalloutType, React.ReactNode> = {
  note: (
    <svg viewBox='0 0 16 16' width='16' height='16' fill='currentColor' aria-hidden='true'>
      <path d='M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z' />
    </svg>
  ),
  warning: (
    <svg viewBox='0 0 16 16' width='16' height='16' fill='currentColor' aria-hidden='true'>
      <path d='M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575L6.457 1.047ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm1 7a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z' />
    </svg>
  ),
  info: (
    <svg viewBox='0 0 16 16' width='16' height='16' fill='currentColor' aria-hidden='true'>
      <path d='M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z' />
    </svg>
  ),
  tip: (
    <svg viewBox='0 0 16 16' width='16' height='16' fill='currentColor' aria-hidden='true'>
      <path d='M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75ZM5.75 12a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z' />
    </svg>
  ),
  check: (
    <svg viewBox='0 0 16 16' width='16' height='16' fill='currentColor' aria-hidden='true'>
      <path d='M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16Zm3.78-9.72a.751.751 0 0 0-.018-1.042.751.751 0 0 0-1.042-.018L6.75 9.19 5.28 7.72a.751.751 0 0 0-1.042.018.751.751 0 0 0-.018 1.042l2 2a.75.75 0 0 0 1.06 0l4.5-4.5Z' />
    </svg>
  ),
  danger: (
    <svg viewBox='0 0 16 16' width='16' height='16' fill='currentColor' aria-hidden='true'>
      <path d='M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm3.78 4.53v3.5a.75.75 0 0 0 1.5 0v-3.5a.75.75 0 0 0-1.5 0ZM9 11a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z' />
    </svg>
  ),
}

/** Convert `#rgb`/`#rrggbb` hex to `rgba(r, g, b, a)`. Returns the input
 *  unchanged if it doesn't match — safe fallback for non-hex user input. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  let h = m[1]!
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export interface CalloutProps {
  children: React.ReactNode
  /** Preset variant. Drives bg tint, border, and icon color via Tailwind classes. */
  type?: CalloutType
  /** Custom hex color (e.g. `#FFC107`). Overrides `type` styling and renders
   *  via inline style (Tailwind can't support arbitrary hex statically). */
  color?: string
  /** Icon: ReactNode rendered as-is, URL/path string rendered as <img>, or
   *  icon-library name string (ignored — no lucide/FA dep). */
  icon?: React.ReactNode | string
  /** FontAwesome icon style. Accepted for Mintlify API parity; currently a no-op. */
  iconType?: 'regular' | 'solid' | 'light' | 'thin' | 'sharp-solid' | 'duotone' | 'brands'
}

function resolveIcon(icon: React.ReactNode | string | undefined, fallback: React.ReactNode | undefined): React.ReactNode | undefined {
  if (icon === undefined || icon === null) return fallback
  if (typeof icon !== 'string') return icon
  // URL / path → render as <img>
  if (/^(https?:|\/)/.test(icon)) {
    return <img src={icon} alt='' width={16} height={16} style={{ display: 'block' }} />
  }
  // Bare icon-library name (lucide/fa/tabler) — not supported without a dep.
  // Fall through to preset fallback if any.
  return fallback
}

export function Callout({ children, type, color, icon, iconType }: CalloutProps) {
  void iconType // no-op; accepted for Mintlify parity
  // No font-size/line-height here — Callout inherits from parent (body-size in
  // main content, --type-toc-size inside an Aside).
  // `no-bleed` zeros the --bleed* tokens for descendants so lists, code
  // blocks, and images stay inside the callout frame (see editorial.css).
  const baseClass = 'no-bleed flex gap-3 items-start p-3 rounded-(--border-radius-md) border'
  const presetIcon = type ? CALLOUT_ICONS[type] : undefined
  const resolvedIcon = resolveIcon(icon, presetIcon)

  // Custom hex color → inline style, no variant class
  if (color) {
    return (
      <div
        className={baseClass}
        style={{
          backgroundColor: hexToRgba(color, 0.03),
          borderColor: hexToRgba(color, 0.15),
        }}
      >
        {resolvedIcon && (
          <span className='flex-shrink-0 mt-0.5 inline-flex items-center justify-center' style={{ color, width: 16, height: 16 }}>
            {resolvedIcon}
          </span>
        )}
        <div className='flex flex-col gap-2 min-w-0 flex-1 text-(color:--text-primary)'>{children}</div>
      </div>
    )
  }

  // Preset variant (or unstyled fallback)
  const variantClass = type ? CALLOUT_VARIANTS[type] : 'bg-muted border-border'
  return (
    <div className={`${baseClass} ${variantClass}`}>
      {resolvedIcon && (
        <span className='flex-shrink-0 mt-0.5 inline-flex items-center justify-center w-4 h-4'>
          {resolvedIcon}
        </span>
      )}
      <div className='flex flex-col gap-2 min-w-0 flex-1 text-(color:--text-primary)'>{children}</div>
    </div>
  )
}

/* Typed callout aliases — Mintlify parity. Each is a thin <Callout type="…">
   wrapper with preset icon + color. */
export function Note({ children }: { children: React.ReactNode }) {
  return <Callout type='note'>{children}</Callout>
}
export function Warning({ children }: { children: React.ReactNode }) {
  return <Callout type='warning'>{children}</Callout>
}
export function Info({ children }: { children: React.ReactNode }) {
  return <Callout type='info'>{children}</Callout>
}
export function Tip({ children }: { children: React.ReactNode }) {
  return <Callout type='tip'>{children}</Callout>
}
export function Check({ children }: { children: React.ReactNode }) {
  return <Callout type='check'>{children}</Callout>
}
export function Danger({ children }: { children: React.ReactNode }) {
  return <Callout type='danger'>{children}</Callout>
}

/* =========================================================================
   Hero — MDX component for page-level hero content (logo, heading, etc.).
   Extracted at parse time (like <Aside>) and rendered above the 3-column
   grid, aligned with the center content column. Shifts sidebars and main
   content below it. Accepts arbitrary props from MDX for future extensibility.
   ========================================================================= */

export function Hero({ children, ...props }: { children: React.ReactNode } & React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props}>{children}</div>
}

/* =========================================================================
   Sidebar banner — Seline-style CTA card for the right gutter.
   Tinted background, short text, full-width button, optional corner image.
   ========================================================================= */

export function SidebarBanner({
  text,
  buttonLabel,
  buttonHref,
  imageUrl,
}: {
  text: React.ReactNode
  buttonLabel: string
  buttonHref: string
  imageUrl?: string
}) {
  return (
    <div
      style={{
        position: 'relative',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--border-radius-md)',
        padding: '10px',
        fontSize: 'var(--type-toc-size)',
        fontWeight: 'var(--weight-prose)',
        lineHeight: 'var(--lh-heading)',
        color: 'var(--text-tree-label)',
        overflow: 'visible',
      }}
    >
      {text}
      {(() => {
        const isExternal = buttonHref.startsWith('http')
        const bannerStyle = {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '32px',
          marginTop: '8px',
          borderRadius: 'var(--border-radius-md)',
          fontSize: 'var(--type-toc-size)',
          fontWeight: 'var(--weight-prose)',
          backgroundColor: 'var(--text-primary)',
          color: 'var(--background)',
          textDecoration: 'none',
          position: 'relative' as const,
          zIndex: 2,
          transition: 'opacity 0.15s ease',
        }
        const handleEnter = (e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.opacity = '0.85' }
        const handleLeave = (e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.opacity = '1' }

        if (isExternal) {
          return (
            <a href={buttonHref} target='_blank' rel='noopener noreferrer' className='no-underline' style={bannerStyle} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
              {buttonLabel}
            </a>
          )
        }
        return (
          <Link href={buttonHref} className='no-underline' style={bannerStyle} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
            {buttonLabel}
          </Link>
        )
      })()}
      {imageUrl && (
        <img
          src={imageUrl}
          alt=''
          width={144}
          height={144}
          style={{
            position: 'absolute',
            zIndex: 1,
            top: '-32px',
            right: '-32px',
            height: '120px',
            width: 'auto',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}

function TabLink({ tab, isActive }: { tab: { label: string; href: string }; isActive: boolean }) {
  const isExternal = tab.href.startsWith('http')
  const tabClassName = 'slot-tab no-underline text-(length:--type-toc-size) font-[475] [font-family:var(--font-primary)] lowercase transition-colors duration-150'
  const tabStyle = {
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    textShadow: isActive ? '-0.2px 0 0 currentColor, 0.2px 0 0 currentColor' : 'none',
  }
  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isActive) {
      e.currentTarget.style.color = 'var(--text-primary)'
      const indicator = e.currentTarget.querySelector<HTMLElement>('[data-tab-indicator]')
      if (indicator) {
        indicator.style.backgroundColor = 'var(--text-tertiary)'
      }
    }
  }
  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isActive) {
      e.currentTarget.style.color = 'var(--text-secondary)'
      const indicator = e.currentTarget.querySelector<HTMLElement>('[data-tab-indicator]')
      if (indicator) {
        indicator.style.backgroundColor = 'transparent'
      }
    }
  }
  const indicator = (
    <div
      data-tab-indicator
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '1.5px',
        backgroundColor: isActive ? 'var(--text-primary)' : 'transparent',
        borderRadius: '1px',
        transition: 'background-color 0.15s ease',
      }}
    />
  )

  if (isExternal) {
    return (
      <a
        href={tab.href}
        target='_blank'
        rel='noopener noreferrer'
        className={tabClassName}
        style={tabStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {tab.label}
        {indicator}
      </a>
    )
  }

  return (
    <Link
      href={tab.href}
      className={tabClassName}
      style={tabStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {tab.label}
      {indicator}
    </Link>
  )
}

/* =========================================================================
   Page shell — CSS grid layout with named areas.

   Desktop (lg+):
     "tabs    tabs   ."
     "toc     content ."

   Mobile:
     "tabs"
     "content"

   The grid centers the content column. The TOC column is sticky.
   ========================================================================= */

export type EditorialSection = {
  content: React.ReactNode
  aside?: React.ReactNode
  fullWidth?: boolean
  /** How many grid rows this section's aside spans on desktop.
   *  1 (default) for per-section asides. For a shared `<Aside full>`, the
   *  aside is attached to the LAST sub-section of its range and the renderer
   *  computes `grid-row: (thisRow - span + 1) / span ${span}` so the aside
   *  cell covers every sub-section row. Inside that tall cell,
   *  `position: sticky` keeps the aside pinned alongside all those rows. */
  asideRowSpan?: number
}

/**
 * Top-level page shell.
 *
 * All static site data (logo, site name, tabs, header links) comes from
 * the shared `data.ts` module. Per-request state (active tab href) comes
 * from the Spiceflow loader via `useHolocronData()`. JSX content
 * (sections, hero, children) is still passed as props because it's
 * request-specific pre-rendered server output.
 */
export function EditorialPage({
  sidebar,
  children,
  sections,
  hero,
}: {
  sidebar?: React.ReactNode
  children?: React.ReactNode
  /** When provided, renders section rows with aside support instead of flat children */
  sections?: EditorialSection[]
  /** Page-level hero content rendered above the 3-column grid, aligned with center column. */
  hero?: React.ReactNode
}) {
  const { activeTabHref } = useHolocronData()
  const logo = defaultLogoSrc
  const siteName = defaultSiteName
  const tabs = siteTabs
  const headerLinks = siteHeaderLinks
  const activeTab = activeTabHref
  const hasTabBar = tabs.length > 0

  return (
    <div
      className='slot-page flex flex-col gap-(--layout-gap) min-h-screen bg-background text-(color:--text-primary) [font-family:var(--font-primary)] antialiased [text-rendering:optimizeLegibility]'
      style={{
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Header + Tab bar: full-width, sticky at top */}
      <div className='slot-navbar'>
        {/* Top row: logo + right links */}
        <div className='mx-auto flex items-center justify-between px-(--mobile-padding) py-(--header-padding-y) lg:max-w-(--grid-max-width) lg:px-0'>
          <Link href='/' className='slot-logo no-underline flex items-center'>
            {logo ? (
              <img
                src={logo}
                alt={siteName || 'Logo'}
                style={{
                  height: 'var(--logo-height)',
                  width: 'auto',
                }}
                className='dark:invert'
              />
            ) : (
              <span className='text-[15px] font-bold [font-family:var(--font-code)] lowercase tracking-[-0.01em]'>
                {siteName || 'docs'}
              </span>
            )}
          </Link>
          <div className='flex items-center gap-4'>
            {/* Icon links */}
            {headerLinks && headerLinks.length > 0 && (
              <div className='flex items-center gap-3'>
                {headerLinks.map((link) => {
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      target='_blank'
                      rel='noopener noreferrer'
                      aria-label={link.label}
                      className='no-underline flex items-center text-(color:--text-secondary) transition-colors duration-150 hover:text-(color:--text-primary)'
                    >
                      {link.icon}
                    </a>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tab row */}
        {hasTabBar && (
          <div className='slot-tabbar'>
            <div className='mx-auto flex h-(--tab-bar-height) max-w-full items-stretch gap-6 overflow-x-auto px-(--mobile-padding) lg:max-w-(--grid-max-width) lg:px-0'>
              {tabs.map((tab) => {
                return <TabLink key={tab.href} tab={tab} isActive={tab.href === (activeTab ?? tabs[0]?.href)} />
              })}
            </div>
          </div>
        )}
      </div>

      {/* Hero: rendered above the 3-column grid, using the same column widths
          so hero content aligns with the center content column (col 2). */}
      {hero && (
        <div className='mx-auto w-full max-w-full px-(--mobile-padding) lg:grid lg:grid-cols-[var(--grid-toc-width)_var(--grid-content-width)_var(--grid-sidebar-width)] lg:gap-x-(--grid-gap) lg:justify-between lg:max-w-(--grid-max-width) lg:px-0'>
          <div className='lg:col-start-2'>{hero}</div>
        </div>
      )}

      <div className='grid grid-cols-1 gap-y-(--section-gap) w-full max-w-full mx-auto px-(--mobile-padding) lg:grid-cols-[var(--grid-toc-width)_var(--grid-content-width)_var(--grid-sidebar-width)] lg:gap-x-(--grid-gap) lg:justify-between lg:max-w-(--grid-max-width) lg:px-0'>
        {/* TOC sidebar: sticky within its grid cell */}
        <div className='slot-sidebar-left'>
          <div
            style={{
              position: 'sticky',
              top: hasTabBar ? 'var(--sticky-top)' : '0px',
              maxHeight: hasTabBar ? 'calc(100vh - var(--sticky-top))' : '100vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SideNav />
          </div>
        </div>

        {sections ? (
          /* Flattened sections layout: section wrappers are DIRECT children of
             the page grid. Page grid's `gap-y-(--section-gap)` provides
             rhythm between sections.

             Per-section wrapper: inner subgrid spanning `lg:col-[2/-1]` of
             the page grid. Content at col [1], per-section aside at col [2].
             Sticky scope for per-section asides = this inner wrapper
             (one section's bounds).

             Shared <Aside full> (asideRowSpan > 1): a SEPARATE direct
             page-grid child at `lg:col-[3]` with explicit `grid-row: start /
             span N`. Sticky containing block = multi-row grid area so
             sticky pins across the whole range. Rendered once, placed in
             DOM after the LAST sub-section of its range — on mobile
             (grid-cols-1), auto-placement by DOM order stacks it at the end. */
          <Fragment>
            {sections.map((section, i) => {
              const row = i + 1
              if (section.fullWidth) {
                return (
                  <div
                    key={i}
                    className='flex flex-col gap-(--prose-gap) text-(length:--type-body-size) lg:col-[2/-1]'
                    style={{ gridRow: row }}
                  >
                    {section.content}
                  </div>
                )
              }
              const span = section.asideRowSpan ?? 1
              const isShared = span > 1
              const asideClass =
                'slot-aside flex flex-col gap-3 bg-foreground/[0.03] text-(length:--type-toc-size) leading-[1.5]'
              return (
                <Fragment key={i}>
                  {/* Inner per-section wrapper: subgrid, content + per-section aside */}
                  <div
                    className='flex flex-col gap-y-(--prose-gap) lg:grid lg:grid-cols-subgrid lg:col-[2/-1]'
                    style={{ gridRow: row }}
                  >
                    <div className='slot-main flex flex-col gap-(--prose-gap) lg:col-[1] lg:overflow-visible text-(length:--type-body-size)'>
                      {section.content}
                    </div>
                    {section.aside && !isShared && (
                      <div
                        className={`${asideClass} lg:col-[2] lg:sticky lg:top-(--sticky-top) lg:self-start lg:max-h-[calc(100vh-var(--header-height))] lg:overflow-y-auto`}
                      >
                        {section.aside}
                      </div>
                    )}
                  </div>
                  {/* Shared aside: single element, direct page-grid child.
                      Desktop: explicit col 3 + row-span (via CSS var read at lg).
                      Mobile: grid-row stays `auto` → auto-placed by DOM order,
                      stacks at end of range without forcing an implicit 2nd
                      column in grid-cols-1. */}
                  {section.aside && isShared && (
                    <div
                      className={`${asideClass} lg:col-[3] lg:[grid-row:var(--shared-row)] lg:sticky lg:top-(--sticky-top) lg:self-start lg:max-h-[calc(100vh-var(--header-height))] lg:overflow-y-auto`}
                      style={{ '--shared-row': `${row - span + 1} / span ${span}` } as React.CSSProperties}
                    >
                      {section.aside}
                    </div>
                  )}
                </Fragment>
              )
            })}
          </Fragment>
        ) : (
          <>
            {/* Flat layout: single article column + optional static sidebar */}
            <div className='slot-main pb-24 lg:col-[2] text-(length:--type-body-size)'>
              <article className='flex flex-col gap-(--prose-gap)'>{children}</article>
            </div>

            <div className='slot-sidebar-right'>
              <div
                style={{
                  position: 'sticky',
                  top: hasTabBar ? 'var(--sticky-top)' : '12px',
                  paddingTop: '4px',
                }}
              >
                {sidebar}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
