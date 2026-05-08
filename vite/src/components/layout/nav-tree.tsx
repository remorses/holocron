'use client'

/**
 * Sidebar nav tree pieces: TocInline (flat heading list under active page),
 * NavPageLink, and NavGroupNode (recursive group renderer).
 */

import React, { createContext, useContext, useEffect, useRef } from 'react'
import { Link } from 'spiceflow/react'
import { type NavGroup, type NavPage, type NavHeading, isNavPage, isNavGroup, hasVisibleSidebarEntries } from '../../navigation.ts'
import { notifyHeadingClick } from '../../hooks/use-active-toc.ts'
import type { SearchState } from '../../lib/search.ts'
import { ChevronIcon } from '../markdown/icons.tsx'
import { ExpandableContainer } from '../markdown/expandable-container.tsx'
import { Icon } from '../icon.tsx'
import { NavBadge, MethodBadge } from './nav-badge.tsx'

type SidebarTreeContextValue = {
  currentPageHref?: string
  expandedGroups: Set<string>
  onToggleGroup: (groupKey: string) => void
  activeHeadingId: string
  searchState: SearchState | null
  highlightedHref: string | null
  highlightedRef: React.RefObject<HTMLAnchorElement | null>
  /** When true, sidebar expand/collapse and hover transitions are enabled.
   *  Controlled by the presence of `sidebar-animate` class on `<html>`. */
  animate: boolean
}

const sidebarTreeContext = createContext<SidebarTreeContextValue | null>(null)

function useSidebarTreeContext(): SidebarTreeContextValue {
  const value = useContext(sidebarTreeContext)
  if (!value) {
    throw new Error('Sidebar tree context missing')
  }
  return value
}

export function SidebarTreeProvider({
  value,
  children,
}: {
  value: SidebarTreeContextValue
  children: React.ReactNode
}) {
  return <sidebarTreeContext.Provider value={value}>{children}</sidebarTreeContext.Provider>
}

/** Flat list of headings shown under the active page in the sidebar.
 *  When search matches one or more headings on this page, keep sibling headings
 *  visible too so the local section context is preserved.
 *  Includes a guide line and animated active indicator bar. */
export function TocInline({
  headings,
  pageHref,
}: {
  headings: NavHeading[]
  pageHref: string
}) {
  const { activeHeadingId, searchState, highlightedHref, highlightedRef, animate } = useSidebarTreeContext()
  const listRef = useRef<HTMLUListElement>(null)
  const indicatorRef = useRef<HTMLDivElement>(null)
  const isSearchActive = searchState !== null

  const hasMatchedHeading = isSearchActive && headings.some((heading) => {
    return searchState.matchedHrefs.has(`${pageHref}#${heading.slug}`)
  })

  // If this page has matched headings, keep sibling headings visible as context.
  // If the page only matched by title, keep the TOC hidden.
  const visibleHeadings = hasMatchedHeading ? headings : isSearchActive ? [] : headings

  // Single effect: position the active-heading indicator bar.
  useEffect(() => {
    const updateIndicator = () => {
      const list = listRef.current
      const indicator = indicatorRef.current
      if (!list || !indicator) return

        const activeLink = list.querySelector<HTMLElement>(`a[data-heading-id="${activeHeadingId}"]`)
      if (!activeLink) {
        indicator.style.opacity = '0'
        return
      }

      const listRect = list.getBoundingClientRect()
      const linkRect = activeLink.getBoundingClientRect()

      indicator.style.transform = `translateY(${linkRect.top - listRect.top}px)`
      indicator.style.height = `${linkRect.height}px`
      // Dim the indicator when search is filtering so it doesn't compete visually
      indicator.style.opacity = isSearchActive ? '0.3' : '1'
    }

    updateIndicator()

    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver(updateIndicator)
    observer.observe(list)
    return observer.disconnect.bind(observer)
  }, [activeHeadingId, isSearchActive])

  if (visibleHeadings.length === 0) return null

  return (
    <div className='relative mt-1.5 pl-0.5 pb-2'>
      {/* Guide line */}
      <div
        aria-hidden
        className='pointer-events-none absolute rounded-full'
        style={{
          insetBlockStart: 'calc(2px)',// TODO why this? without it the line disappears. why?
          insetBlockEnd: 0,
          insetInlineStart: 0,
          width: '1.5px',
          backgroundColor: 'var(--border-subtle)',
        }}
      />
      {/* Active indicator bar */}
      <div
        ref={indicatorRef}
        aria-hidden
        className='pointer-events-none absolute rounded-full'
        style={{
          insetInlineStart: 0,
          width: '1.5px',
          backgroundColor: 'var(--sidebar-primary)',
          transition: animate ? 'transform 0.26s cubic-bezier(0.25, 0.46, 0.45, 0.94), height 0.26s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.15s' : 'none',
          opacity: 0,
        }}
      />
      <ul
        ref={listRef}
        className='relative list-none m-0 p-0 flex flex-col gap-2.5 pt-1.5 pl-3 leading-[1.33] box-content'
      >
        {visibleHeadings.map((heading) => {
          const isActive = heading.slug === activeHeadingId
          const headingHref = `${pageHref}#${heading.slug}`
          const isMatched = !isSearchActive || searchState.matchedHrefs.has(headingHref)
          const isDimmed = hasMatchedHeading && !isMatched
          const isHighlighted = highlightedHref === headingHref
          const isEmphasized = isActive || (isSearchActive && isMatched)
          return (
            <li key={heading.slug} style={{ opacity: isDimmed ? 0.3 : 1, transition: animate ? 'opacity 0.15s ease' : 'none' }}>
              <Link
                ref={isHighlighted ? highlightedRef : undefined}
                href={headingHref}
                data-active={isActive}
                data-heading-id={heading.slug}
                onClick={(e) => notifyHeadingClick(e)}
                className={`block leading-4 no-underline ${!isDimmed ? 'hover:[background:var(--accent)] hover:rounded-[4px] hover:[box-shadow:0_0_0_4px_var(--accent)]' : ''}`}
                tabIndex={isDimmed ? -1 : 0}
                style={{
                  color: isEmphasized ? 'var(--sidebar-primary)' : 'var(--sidebar-foreground)',
                  fontWeight: isEmphasized ? 500 : 400,
                  background: isHighlighted ? 'var(--accent)' : undefined,
                  borderRadius: isHighlighted ? '4px' : undefined,
                  boxShadow: isHighlighted ? '0 0 0 4px var(--accent)' : undefined,
                }}
              >
                {heading.text}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function NavPageLink({
  page,
  depth,
}: {
  page: NavPage
  depth: number
}) {
  const { currentPageHref, searchState, highlightedHref, highlightedRef, animate } = useSidebarTreeContext()
  const frontmatter = page.frontmatter ?? {}
  if (frontmatter.hidden) return null

  // When search is active, only render pages that matched (directly or via a heading hit).
  if (searchState !== null && !searchState.visiblePages.has(page.href)) return null

  const isActive = page.href === currentPageHref
  const isSearchActive = searchState !== null
  const isMatched = !isSearchActive || searchState.matchedHrefs.has(page.href)
  const isDimmed = isSearchActive && !isMatched
  const isHighlighted = highlightedHref === page.href
  // Emphasize only active page or search-matched pages — without search,
  // only the current page gets --sidebar-primary; all others use --sidebar-foreground.
  const isEmphasized = isActive || (isSearchActive && isMatched)

  // Show TOC when: search is active (so matched headings are visible), or page is the current page.
  // A single heading is not useful as a TOC — treat it like a page without sections.
  const showToc = page.headings.length > 1 && (isSearchActive || isActive)

  return (
    <div className='flex flex-col'>
      <Link
        ref={isHighlighted ? highlightedRef : undefined}
        href={page.href}
        className={`flex items-center gap-1.5 no-underline ${!isDimmed ? 'hover:[background:var(--accent)] hover:rounded-[4px] hover:[box-shadow:0_0_0_4px_var(--accent)]' : ''}`}
        style={{
          opacity: isDimmed ? 0.45 : 1,
          fontVariationSettings: isEmphasized ? '"wght" 550' : '"wght" 450',
          color: isEmphasized ? 'var(--sidebar-primary)' : 'var(--sidebar-foreground)',
          paddingLeft: depth > 0 ? `${depth * 12}px` : undefined,
          transition: animate ? 'color 0.15s, font-variation-settings 0.25s, opacity 0.15s ease' : 'none',
          background: isHighlighted ? 'var(--accent)' : undefined,
          borderRadius: isHighlighted ? '4px' : undefined,
          boxShadow: isHighlighted ? '0 0 0 4px var(--accent)' : undefined,
        }}
      >
        <Icon icon={page.icon} size={12} />
        <span>{frontmatter.sidebarTitle ?? page.title}</span>
        <span className='ml-auto inline-flex items-center gap-1'>
          {typeof frontmatter.api === 'string' && <MethodBadge method={frontmatter.api.split(' ')[0]!} />}
          {frontmatter.deprecated && <NavBadge label='Deprecated' variant='deprecated' />}
          {frontmatter.tag && typeof frontmatter.api !== 'string' && <NavBadge label={frontmatter.tag} />}
        </span>
      </Link>
      <ExpandableContainer open={showToc} animate={animate}>
        {page.headings.length > 1 && (
          <TocInline
            headings={page.headings}
            pageHref={page.href}
          />
        )}
      </ExpandableContainer>
    </div>
  )
}

export function NavGroupNode({
  group,
  depth,
  parentPath,
}: {
  group: NavGroup
  depth: number
  /** Ancestor group names joined by \0 — ensures unique keys even for duplicate group labels */
  parentPath: string
}) {
  const {
    expandedGroups,
    onToggleGroup,
    searchState,
    animate,
  } = useSidebarTreeContext()
  // Prune groups with no visible entries (hidden: true, or all descendants hidden).
  if (!hasVisibleSidebarEntries(group)) return null

  const groupKey = parentPath ? `${parentPath}\0${group.group}` : group.group

  // When search is active, only render groups that are ancestors of matched entries.
  if (searchState !== null && !searchState.expandGroupKeys.has(groupKey)) return null

  const isSearchActive = searchState !== null
  const isDimmed = isSearchActive

  const renderChildren = (forceExpanded: boolean) =>
    group.pages.map((entry) => {
      if (isNavPage(entry)) {
        return (
          <NavPageLink
            key={entry.href}
            page={entry}
            depth={forceExpanded ? 0 : depth}
          />
        )
      }
      if (isNavGroup(entry)) {
        return (
          <NavGroupNode
            key={entry.group}
            group={entry}
            depth={forceExpanded ? depth + 1 : depth + 1}
            parentPath={groupKey}
          />
        )
      }
      return null
    })

  // Top-level groups (depth 0) render as a flat section label — always expanded.
  if (depth === 0) {
    return (
      <div className='flex flex-col gap-2.5'>
        <div
          className='cursor-default mt-3 mb-0.5 flex items-center gap-1.5'
          style={{
            opacity: isDimmed ? 0.45 : 1,
          fontVariationSettings: '"wght" 500',
          color: 'var(--muted-foreground)',
          transition: animate ? 'opacity 0.15s ease' : 'none',
          }}
        >
          {group.group}
        </div>
        {renderChildren(true)}
      </div>
    )
  }

  // Nested groups (depth > 0) are collapsible. Search force-opens them via expandGroupKeys.
  const isExpanded = expandedGroups.has(groupKey) || (searchState?.expandGroupKeys.has(groupKey) ?? false)

  return (
    <div className='flex flex-col'>
      <button
        type='button'
        onClick={() => onToggleGroup(groupKey)}
        aria-expanded={isExpanded}
        className={`flex items-center gap-1 border-none bg-transparent cursor-pointer p-0 text-left ${!isDimmed ? 'hover:[background:var(--accent)] hover:rounded-[4px] hover:[box-shadow:0_0_0_4px_var(--accent)]' : ''}`}
        style={{
          opacity: isDimmed ? 0.45 : 1,
          fontVariationSettings: '"wght" 500',
          color: 'var(--sidebar-foreground)',
          paddingLeft: depth > 0 ? `${(depth - 1) * 12}px` : undefined,
          transition: animate ? 'opacity 0.15s ease' : 'none',
        }}
      >
        <ChevronIcon expanded={isExpanded} className='text-muted-foreground' animate={animate} />
        {group.group}
      </button>
      <ExpandableContainer open={isExpanded} animate={animate}>
        <div className='flex flex-col gap-2.5 pt-2'>
          {renderChildren(false)}
        </div>
      </ExpandableContainer>
    </div>
  )
}
