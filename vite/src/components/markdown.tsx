'use client'
/*
 * Editorial markdown components.
 *
 * All components use CSS variables from globals.css (no prefix).
 * Conflicting names with shadcn: --brand-primary, --brand-secondary,
 * --link-accent, --page-border.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useActiveTocState } from '../hooks/use-active-toc.ts'
import { Link } from 'spiceflow/react'
import type { TocNodeType, TocTreeNode } from './toc-tree.ts'
import { type NavGroup, type NavPage, type NavHeading, isNavPage, isNavGroup } from '../navigation.ts'
import { createSearchDb, searchSidebar, emptySearchState, type SearchEntry, type SearchState } from './search.ts'

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
   Typography primitives — reduced set after merging near-identical values.
   4 weights (regular/prose/heading/bold), 2 line-heights (heading/prose).
   Mirrors CSS variables in globals.css. Used in inline styles for type safety.
   ========================================================================= */

const WEIGHT = { regular: 400, prose: 475, heading: 560, bold: 700 } as const
const LINE_HEIGHT = { heading: 1.4, prose: 1.6 } as const
const LETTER_SPACING = { prose: '-0.09px', code: '0.01em' } as const

/** Shared prose style — body text, lists, captions. Spread and override per component. */
const proseStyle = {
  fontFamily: 'var(--font-primary)',
  fontWeight: WEIGHT.prose,
  lineHeight: LINE_HEIGHT.prose,
  letterSpacing: LETTER_SPACING.prose,
  color: 'var(--text-primary)',
  margin: 0,
} satisfies React.CSSProperties

/* =========================================================================
   TOC sidebar (fixed left) — Agentation-style navigation
   ========================================================================= */

export type HeadingLevel = 1 | 2 | 3

const headingTagByLevel: Record<HeadingLevel, 'h1' | 'h2' | 'h3'> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
}

const headingStyleByLevel: Record<HeadingLevel, React.CSSProperties> = {
  1: {
    fontSize: 'var(--type-heading-1-size)',
    fontWeight: WEIGHT.heading,
    lineHeight: LINE_HEIGHT.heading,
    letterSpacing: LETTER_SPACING.prose,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '24px',
    paddingBottom: '24px',
  },
  2: {
    fontSize: 'var(--type-heading-2-size)',
    fontWeight: WEIGHT.heading,
    lineHeight: LINE_HEIGHT.heading,
    letterSpacing: LETTER_SPACING.prose,
    paddingTop: '10px',
    paddingBottom: '4px',
  },
  3: {
    fontSize: 'var(--type-heading-3-size)',
    fontWeight: WEIGHT.heading,
    lineHeight: LINE_HEIGHT.heading,
    letterSpacing: LETTER_SPACING.prose,
    paddingTop: '4px',
    paddingBottom: '2px',
    color: 'var(--text-secondary)',
  },
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

/* ── Inline TOC (flat heading list under active page) ────────────────── */

/** Flat list of headings shown under the active page in the sidebar.
 *  All headings are rendered at the same level regardless of depth,
 *  matching the Agentation website pattern. Includes a guide line and
 *  animated active indicator bar. */
function TocInline({ headings, activeId, searchState, pageHref }: { headings: NavHeading[]; activeId: string; searchState: SearchState; pageHref: string }) {
  const listRef = useRef<HTMLUListElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)

  const updateIndicator = useCallback(() => {
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
  }, [activeId])

  useEffect(() => {
    updateIndicator()
  }, [activeId, updateIndicator])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(updateIndicator)
    observer.observe(list)
    return () => observer.disconnect()
  }, [updateIndicator])

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
          return (
            <li key={heading.slug} style={{ opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.15s ease' }}>
              <a
                href={`#${heading.slug}`}
                className='block leading-4 no-underline transition-colors duration-[120ms]'
                tabIndex={isDimmed ? -1 : 0}
                style={{
                  color: isActive ? 'var(--sidebar-toc-foreground-active)' : 'var(--sidebar-toc-foreground)',
                  fontWeight: isActive ? 500 : 400,
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

function ExpandableContainer({ open, children }: { open: boolean; children: React.ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (!contentRef.current) return
    const observer = new ResizeObserver(() => {
      if (contentRef.current) {
        setHeight(contentRef.current.scrollHeight)
      }
    })
    observer.observe(contentRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      aria-hidden={!open}
      inert={!open || undefined}
      style={{
        overflow: 'hidden',
        height: open ? `${height}px` : '0px',
        opacity: open ? 1 : 0,
        transition: 'height 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s ease',
      }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  )
}

/* ── Nav page link ───────────────────────────────────────────────────── */

function NavPageLink({
  page,
  currentPage,
  activeHeadingId,
  depth,
  searchState,
}: {
  page: NavPage
  currentPage?: NavPage
  activeHeadingId: string
  depth: number
  searchState: SearchState
}) {
  const isActive = page.href === currentPage?.href
  const isDimmed = searchState.dimmedHrefs?.has(page.href) ?? false
  const isSearchActive = searchState.matchedHrefs !== null
  /* When search is active and this page matched, expand its TOC so headings are visible */
  const showToc = isSearchActive
    ? (searchState.matchedHrefs?.has(page.href) ?? false) && page.headings.length > 0
    : isActive && page.headings.length > 0
  return (
    <div className='flex flex-col' style={{ opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.15s ease' }}>
      <Link
        href={page.href}
        className='block text-xs no-underline transition-colors duration-150'
        tabIndex={isDimmed ? -1 : 0}
        style={{
          fontVariationSettings: isActive ? '"wght" 550' : '"wght" 450',
          color: isActive ? 'var(--sidebar-foreground-active)' : 'var(--sidebar-foreground)',
          paddingLeft: depth > 0 ? `${depth * 12}px` : undefined,
          transition: 'color 0.15s, font-variation-settings 0.25s',
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
          <TocInline headings={page.headings} activeId={activeHeadingId} searchState={searchState} pageHref={page.href} />
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
  currentPage,
  expandedGroups,
  onToggleGroup,
  activeHeadingId,
  searchState,
}: {
  group: NavGroup
  depth: number
  /** Ancestor group names joined by \0 — ensures unique keys even for duplicate group labels */
  parentPath: string
  currentPage?: NavPage
  expandedGroups: Set<string>
  onToggleGroup: (groupKey: string) => void
  activeHeadingId: string
  searchState: SearchState
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
                currentPage={currentPage}
                activeHeadingId={activeHeadingId}
                depth={0}
                searchState={searchState}
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
                currentPage={currentPage}
                expandedGroups={expandedGroups}
                onToggleGroup={onToggleGroup}
                activeHeadingId={activeHeadingId}
                searchState={searchState}
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
                  currentPage={currentPage}
                  activeHeadingId={activeHeadingId}
                  depth={depth}
                  searchState={searchState}
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
                  currentPage={currentPage}
                  expandedGroups={expandedGroups}
                  onToggleGroup={onToggleGroup}
                  activeHeadingId={activeHeadingId}
                  searchState={searchState}
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

function groupContainsPage(group: NavGroup, page: NavPage): boolean {
  for (const entry of group.pages) {
    if (isNavPage(entry) && entry.href === page.href) return true
    if (isNavGroup(entry) && groupContainsPage(entry, page)) return true
  }
  return false
}

/** Collect path-based keys for all ancestor groups containing a page */
function collectAncestorKeys(groups: NavGroup[], pageHref: string, parentPath: string, out: Set<string>) {
  for (const group of groups) {
    const key = parentPath ? `${parentPath}\0${group.group}` : group.group
    if (groupContainsPage(group, { href: pageHref } as NavPage)) {
      out.add(key)
    }
    for (const entry of group.pages) {
      if (isNavGroup(entry)) {
        collectAncestorKeys([entry], pageHref, key, out)
      }
    }
  }
}

/** Build a flat SearchEntry[] from the NavGroup tree for Orama indexing */
function buildSearchEntries(groups: NavGroup[], parentPath: string): SearchEntry[] {
  const entries: SearchEntry[] = []
  for (const group of groups) {
    const key = parentPath ? `${parentPath}\0${group.group}` : group.group
    for (const entry of group.pages) {
      if (isNavPage(entry)) {
        entries.push({ label: entry.title, href: entry.href, groupPath: key, pageHref: null })
        for (const h of entry.headings) {
          entries.push({ label: h.text, href: `${entry.href}#${h.slug}`, groupPath: key, pageHref: entry.href })
        }
      } else if (isNavGroup(entry)) {
        entries.push(...buildSearchEntries([entry], key))
      }
    }
  }
  return entries
}

export function SideNav({
  groups,
  currentPage,
}: {
  groups: NavGroup[]
  currentPage?: NavPage
}) {
  const fallbackId = currentPage?.headings[0]?.slug ?? ''
  const { activeId } = useActiveTocState({ fallbackId })

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    if (currentPage) {
      collectAncestorKeys(groups, currentPage.href, '', initial)
    }
    return initial
  })

  // Re-expand ancestor groups when currentPage changes (client-side navigation)
  useEffect(() => {
    if (!currentPage) return
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      collectAncestorKeys(groups, currentPage.href, '', next)
      return next
    })
  }, [currentPage?.href, groups])

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
  const searchEntries = useMemo(() => buildSearchEntries(groups, ''), [groups])
  const db = useMemo(() => createSearchDb({ entries: searchEntries }), [searchEntries])

  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState<SearchState>(emptySearchState)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const highlightedRef = useRef<HTMLAnchorElement>(null)
  const [isPending, startTransition] = useTransition()

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

  // Scroll highlighted item into view
  useEffect(() => {
    if (!searchState.focusableHrefs) return
    highlightedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [highlightedIndex, searchState.focusableHrefs])

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
        e.preventDefault()
        setHighlightedIndex((prev) => Math.min(prev + 1, focusable.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const href = focusable[highlightedIndex]
        if (href) {
          handleQueryChange('')
          searchInputRef.current?.blur()
          window.location.hash = href
        }
      }
    },
    [searchState.focusableHrefs, highlightedIndex, handleQueryChange],
  )

  return (
    <aside className='flex flex-col max-w-(--grid-toc-width) min-h-0'>
      {/* Search input with F hotkey badge */}
      <div className='pb-3 flex items-center relative shrink-0'>
        <input
          ref={searchInputRef}
          type='text'
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder='search...'
          className='w-full text-xs outline-none lowercase box-border'
          style={{
            padding: '2px 24px 2px 8px',
            fontFamily: 'var(--font-primary)',
            fontWeight: WEIGHT.prose,
            color: 'var(--text-primary)',
            background: 'transparent',
            border: '1px solid var(--page-border)',
            borderRadius: '6px',
            letterSpacing: 'normal',
            lineHeight: LINE_HEIGHT.prose,
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
              fontWeight: WEIGHT.regular,
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

      <nav aria-label='Navigation' className='overflow-y-auto min-h-0 pr-1 flex flex-col gap-2'>
        {groups.map((group) => (
          <NavGroupNode
            key={group.group}
            group={group}
            depth={0}
            parentPath=''
            currentPage={currentPage}
            expandedGroups={expandedGroups}
            onToggleGroup={toggleGroup}
            activeHeadingId={activeId}
            searchState={searchState}
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
      data-toc-heading='true'
      data-toc-level={level}
      style={{
        fontFamily: 'var(--font-primary)',
        color: 'var(--text-primary)',
        margin: 0,
        padding: 0,
        scrollMarginTop: 'var(--header-height)',
        ...headingStyleByLevel[level],
      }}
    >
      <span style={{ whiteSpace: level === 1 ? 'nowrap' : 'normal' }}>{children}</span>
      {level === 1 ? <span style={{ flex: 1, height: '1px', background: 'var(--divider)' }} /> : null}
    </Tag>
  )
}

export function P({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={`editorial-prose ${className}`}
      style={{
        ...proseStyle,
        opacity: 0.82,
      }}
    >
      {children}
    </p>
  )
}

export function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        ...proseStyle,
        fontSize: 'var(--type-caption-size)',
        textAlign: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </p>
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
        fontWeight: WEIGHT.heading,
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
    <div style={{ padding: '24px 0', display: 'flex', alignItems: 'center' }}>
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

export function OL({ children }: { children: React.ReactNode }) {
  return (
    <ol
      className='m-0 pl-5'
      style={{
        ...proseStyle,
        listStyleType: 'decimal',
      }}
    >
      {children}
    </ol>
  )
}

export function List({ children }: { children: React.ReactNode }) {
  return (
    <ul
      className='m-0 pl-5'
      style={{
        ...proseStyle,
        listStyleType: 'disc',
      }}
    >
      {children}
    </ul>
  )
}

export function Li({ children }: { children: React.ReactNode }) {
  return <li style={{ padding: '0 0 8px 12px' }}>{children}</li>
}

/* =========================================================================
   Code block with Prism syntax highlighting and line numbers
   ========================================================================= */

export function CodeBlock({
  children,
  lang = 'jsx',
  lineHeight = '1.85',
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
              fontWeight: WEIGHT.regular,
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
              fontWeight: WEIGHT.prose,
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
    <div className='w-full max-w-full overflow-x-auto' style={{ padding: '8px 0' }}>
      {title && (
        <div
          style={{
            fontFamily: 'var(--font-primary)',
            fontSize: 'var(--type-table-size)',
            fontWeight: WEIGHT.regular,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: LETTER_SPACING.code,
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
                    fontWeight: WEIGHT.regular,
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
                    fontWeight: WEIGHT.prose,
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
                    fontWeight: WEIGHT.prose,
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
                    fontWeight: WEIGHT.prose,
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

export type TabItem = {
  label: string
  href: string
}

/* =========================================================================
   Aside — MDX component for right-sidebar content.
   On desktop, extracted from content flow and rendered in grid column 5
   via SectionRow. On mobile, renders inline as a styled callout.
   ========================================================================= */

/** Aside is a marker component for MDX. On desktop, its children are extracted
 *  by the section grouping logic and rendered in the right sidebar slot.
 *  On mobile, SectionRow renders it inline. The component itself is a pass-through.
 *
 *  Use `<Aside full>` to merge all sections below into one row so the aside
 *  stays sticky for the rest of the page (or until the next `<Aside>`). */
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
   Hero — MDX component for page-level hero content (logo, heading, etc.).
   Extracted at parse time (like <Aside>) and rendered above the 3-column
   grid, aligned with the center content column. Shifts sidebars and main
   content below it. Accepts arbitrary props from MDX for future extensibility.
   ========================================================================= */

export function Hero({ children, ...props }: { children: React.ReactNode } & React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props}>{children}</div>
}

/* =========================================================================
   SectionRow — renders one content section as a grid row.
   Content goes in column 3, aside in column 5 (sticky).
   ========================================================================= */

export function SectionRow({ content, aside }: { content: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className='contents lg:grid lg:grid-cols-subgrid lg:col-[2/-1]'>
      <div className='slot-main flex flex-col gap-5 lg:col-[1] lg:overflow-visible text-(length:--type-body-size)'>{content}</div>
      {aside && (
        <div className='flex flex-col gap-3 my-2 p-3 rounded-(--border-radius-md) border border-(--border-subtle) text-(length:--type-toc-size) leading-[1.5] text-(color:--text-tree-label) lg:col-[2] lg:sticky lg:top-(--sticky-top) lg:self-start lg:max-h-[calc(100vh-var(--header-height))] lg:overflow-y-auto lg:my-0'>
          {aside}
        </div>
      )}
    </div>
  )
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
        fontWeight: WEIGHT.prose,
        lineHeight: LINE_HEIGHT.heading,
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
          fontWeight: WEIGHT.prose,
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

function TabLink({ tab, isActive }: { tab: TabItem; isActive: boolean }) {
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

export type HeaderLink = {
  href: string
  label: string
  icon?: React.ReactNode
}

export type EditorialSection = {
  content: React.ReactNode
  aside?: React.ReactNode
  fullWidth?: boolean
}

export function EditorialPage({
  groups,
  currentPage,
  logo,
  siteName,
  tabs,
  activeTab,
  sidebar,
  headerLinks,
  children,
  sections,
  hero,
}: {
  groups: NavGroup[]
  currentPage?: NavPage
  logo?: string
  /** Site name used for logo aria-label and fallback text */
  siteName?: string
  tabs?: TabItem[]
  activeTab?: string
  sidebar?: React.ReactNode
  headerLinks?: HeaderLink[]
  children?: React.ReactNode
  /** When provided, renders section rows with aside support instead of flat children */
  sections?: EditorialSection[]
  /** Page-level hero content rendered above the 3-column grid, aligned with center column. */
  hero?: React.ReactNode
}) {
  const hasTabBar = tabs && tabs.length > 0

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

      <div className='grid grid-cols-1 w-full max-w-full mx-auto px-(--mobile-padding) lg:grid-cols-[var(--grid-toc-width)_var(--grid-content-width)_var(--grid-sidebar-width)] lg:gap-x-(--grid-gap) lg:justify-between lg:max-w-(--grid-max-width) lg:px-0'>
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
            <SideNav groups={groups} currentPage={currentPage} />
          </div>
        </div>

        {sections ? (
          <>
            {/* Section-based layout: each section is a subgrid row with
                content in column 3 and optional aside in column 5 (sticky). */}
            <div className='contents lg:grid lg:grid-cols-subgrid lg:col-[2/-1]'>
              <div className='slot-main flex flex-col gap-5 lg:col-[1] lg:overflow-visible text-(length:--type-body-size)'></div>
            </div>
            {sections.map((section, i) => {
              if (section.fullWidth) {
                return (
                  <div key={i} className='lg:col-[2/-1] text-(length:--type-body-size) my-5'>
                    <div className='flex flex-col gap-5'>{section.content}</div>
                  </div>
                )
              }
              return <SectionRow key={i} content={section.content} aside={section.aside} />
            })}
          </>
        ) : (
          <>
            {/* Flat layout: single article column + optional static sidebar */}
            <div className='slot-main pb-24 lg:col-[2] text-(length:--type-body-size)'>
              <article className='flex flex-col gap-[20px]'>{children}</article>
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
