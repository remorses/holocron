'use client'

/**
 * Sidebar nav tree pieces: TocInline (flat heading list under active page),
 * NavPageLink, and NavGroupNode (recursive group renderer).
 */

import React, { useEffect, useRef } from 'react'
import { Link } from 'spiceflow/react'
import { type NavGroup, type NavPage, type NavHeading, isNavPage, isNavGroup, hasVisibleSidebarEntries } from '../../navigation.ts'
import type { SearchState } from '../../lib/search.ts'
import { ChevronIcon } from './icons.tsx'
import { ExpandableContainer } from './expandable-container.tsx'
import { Icon } from '../icon.tsx'

/** Flat list of headings shown under the active page in the sidebar.
 *  All headings are rendered at the same level regardless of depth,
 *  matching the Agentation website pattern. Includes a guide line and
 *  animated active indicator bar. */
export function TocInline({ headings, activeId, searchState, pageHref, highlightedHref, highlightedRef }: { headings: NavHeading[]; activeId: string; searchState: SearchState; pageHref: string; highlightedHref: string | null; highlightedRef: React.RefObject<HTMLAnchorElement | null> }) {
  const listRef = useRef<HTMLUListElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const isSearchActive = searchState.matchedHrefs !== null

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
      // Dim the indicator when search is filtering so the active-heading
      // bar doesn't compete visually with the search highlight.
      indicator.style.opacity = isSearchActive ? '0.3' : '1'
    }

    updateIndicator()

    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(updateIndicator)
    observer.observe(list)
    return () => observer.disconnect()
  }, [activeId, isSearchActive])

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
                className={`block leading-4 no-underline ${!isDimmed ? 'hover:[background:var(--selection-bg)] hover:rounded-[4px] hover:[box-shadow:0_0_0_4px_var(--selection-bg)]' : ''}`}
                tabIndex={isDimmed ? -1 : 0}
                style={{
                  color: (isSearchActive && !isDimmed) ? 'var(--sidebar-toc-foreground-active)' : isActive ? 'var(--sidebar-toc-foreground-active)' : 'var(--sidebar-toc-foreground)',
                  fontWeight: (isSearchActive && !isDimmed) ? 500 : isActive ? 500 : 400,
                  background: isHighlighted ? 'var(--selection-bg)' : undefined,
                  borderRadius: isHighlighted ? '4px' : undefined,
                  boxShadow: isHighlighted ? '0 0 0 4px var(--selection-bg)' : undefined,
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

export function NavPageLink({
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
        className={`flex items-center gap-1.5 text-xs no-underline ${!isDimmed ? 'hover:[background:var(--selection-bg)] hover:rounded-[4px] hover:[box-shadow:0_0_0_4px_var(--selection-bg)]' : ''}`}
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
      >
        <Icon icon={page.icon} size={12} />
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

export function NavGroupNode({
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
  // Respect user's `hidden: true` — skip both chrome and nested pages.
  // Pages under a hidden group remain routable, they're just absent
  // from the sidebar. Also prune groups that have no visible entries
  // (e.g. a wrapper group whose only descendants are all hidden).
  if (!hasVisibleSidebarEntries(group)) return null

  const groupKey = parentPath ? `${parentPath}\0${group.group}` : group.group

  if (depth === 0) {
    return (
      <div className='flex flex-col gap-2'>
        <div
          className='text-xs cursor-default mt-3 mb-0.5 flex items-center gap-1.5'
          style={{
            fontVariationSettings: '"wght" 500',
            color: 'var(--sidebar-section-foreground)',
          }}
        >
          <Icon icon={group.icon} size={13} />
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
        className='flex items-center gap-1 text-xs border-none bg-transparent cursor-pointer p-0 text-left hover:[background:var(--selection-bg)] hover:rounded-[4px] hover:[box-shadow:0_0_0_4px_var(--selection-bg)]'
        style={{
          fontVariationSettings: '"wght" 500',
          color: 'var(--sidebar-foreground)',
          paddingLeft: depth > 0 ? `${(depth - 1) * 12}px` : undefined,
        }}
      >
        <ChevronIcon expanded={isExpanded} className='text-(color:--sidebar-section-foreground)' />
        <Icon icon={group.icon} size={12} />
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
