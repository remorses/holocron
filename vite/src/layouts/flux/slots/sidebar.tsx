/**
 * Holocron sidebar skin modeled after Fumadocs Flux, using the shared shadcn-style token layer.
 */

'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type ComponentProps } from 'react'
import * as Base from '../../../components/sidebar/base.tsx'
import { cn } from '../../../utils/cn.ts'
import { createPageTreeRenderer } from '../../../components/sidebar/page-tree.tsx'
import { createSidebarDb, searchSidebar, type SearchState } from '../../../components/sidebar/search.ts'
import { TreeContextProvider } from '../../../contexts/tree.tsx'
import { flattenSidebarSearchItems, searchPath } from '../../../page-tree/index.ts'
import type * as PageTree from '../../../page-tree/index.ts'
import { isActiveUrl } from '../../../utils/urls.ts'

const SidebarPageTree = createPageTreeRenderer({
  SidebarFolder: Base.SidebarFolder,
  SidebarFolderContent: Base.SidebarFolderContent,
  SidebarFolderLink: Base.SidebarFolderLink,
  SidebarFolderTrigger: Base.SidebarFolderTrigger,
  SidebarSeparator: Base.SidebarSeparator,
  SidebarItem: Base.SidebarItem,
})

function getItemOffset(depth: number) {
  return `calc(${2 + 3 * depth} * var(--spacing))`
}

function itemClasses({ variant, highlight }: { variant?: 'link' | 'button'; highlight?: boolean }) {
    return cn(
    'relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-muted-foreground wrap-anywhere [&_svg]:size-4 [&_svg]:shrink-0',
    variant === 'link' && 'transition-colors hover:bg-accent/50 hover:text-accent-foreground/80 hover:transition-none data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:hover:transition-colors',
    variant === 'button' && 'transition-colors hover:bg-accent/50 hover:text-accent-foreground/80 hover:transition-none',
    highlight && "data-[active=true]:before:content-[''] data-[active=true]:before:bg-primary data-[active=true]:before:absolute data-[active=true]:before:w-px data-[active=true]:before:inset-y-2.5 data-[active=true]:before:start-2.5",
  )
}

function collectFolderIds(nodes: PageTree.Node[], next: Set<string>) {
  for (const node of nodes) {
    if (node.type !== 'folder') {
      continue
    }
    if (node.defaultOpen) {
      next.add(node.$id)
    }
    collectFolderIds(node.children, next)
  }
}

type SidebarProps = ComponentProps<'nav'> & {
  tree: PageTree.Root
  currentPageHref?: string
  activeId?: string
}

export function Sidebar({ tree, currentPageHref, activeId, className, ...props }: SidebarProps) {
  const activeUrl = activeId && currentPageHref ? `${currentPageHref}#${activeId}` : currentPageHref ?? ''
  const searchItems = flattenSidebarSearchItems(tree.children)
  const db = createSidebarDb({ items: searchItems })

  const defaultExpanded = useMemo(() => {
    const next = new Set<string>()
    collectFolderIds(tree.children, next)
    const path = new Set(
      (
        searchPath(tree.children, currentPageHref || '') ??
        (currentPageHref ? searchPath(tree.children, currentPageHref) : null) ??
        []
      )
        .filter((node): node is PageTree.Folder => { return node.type === 'folder' })
        .map((node) => { return node.$id }),
    )
    for (const id of path) {
      next.add(id)
    }
    return next
  }, [currentPageHref, tree])

  const [expanded, setExpanded] = useState<Set<string>>(defaultExpanded)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [, startTransition] = useTransition()
  const [searchState, setSearchState] = useState<SearchState>({
    matchedIds: null,
    expandOverride: null,
    dimmedIds: null,
    focusableIds: null,
  })

  useEffect(() => {
    if (expanded.size !== defaultExpanded.size) {
      setExpanded(defaultExpanded)
      return
    }

    for (const id of defaultExpanded) {
      if (!expanded.has(id)) {
        setExpanded(defaultExpanded)
        return
      }
    }
  }, [defaultExpanded, expanded])

  const effectiveExpanded = useMemo(() => {
    if (!searchState.expandOverride) {
      return expanded
    }
    return new Set([...expanded, ...searchState.expandOverride])
  }, [expanded, searchState.expandOverride])

  const itemHrefById = new Map(searchItems.filter((item) => { return item.href }).map((item) => { return [item.id, item.href!] as const }))

  const toggleFolder = useCallback((id: string, nextOpen: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (nextOpen) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    setHighlightedIndex(0)
    startTransition(setSearchState.bind(null, searchSidebar({ db, query: value, items: searchItems })))
  }, [db, searchItems])

  const handleSearchInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setHighlightedIndex(0)
    startTransition(setSearchState.bind(null, searchSidebar({ db, query: e.target.value, items: searchItems })))
  }, [db, searchItems])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const focusable = searchState.focusableIds
    if (e.key === 'Escape') {
      e.preventDefault()
      handleQueryChange('')
      searchInputRef.current?.blur()
      return
    }

    if (!focusable || focusable.length === 0) {
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.min(prev + 1, focusable.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const href = itemHrefById.get(focusable[highlightedIndex] ?? '')
      if (href) {
        handleQueryChange('')
        window.location.href = href.startsWith('#') ? href : href
      }
    }
  }, [handleQueryChange, highlightedIndex, itemHrefById, searchState.focusableIds])

  function SidebarItemNode({ item }: { item: PageTree.Item }) {
    const depth = Base.useFolderDepth()
    const isDimmed = searchState.dimmedIds?.has(item.$id) ?? false
    const isHighlighted = (searchState.focusableIds?.[highlightedIndex] ?? '') === item.$id

    return (
      <Base.SidebarItem
        href={item.url}
        external={item.external}
        active={isActiveUrl(item.url, activeUrl || currentPageHref || '')}
        data-dimmed={isDimmed}
        className={cn(
          itemClasses({ variant: 'link', highlight: depth >= 1 }),
          isDimmed && 'opacity-[0.35]',
          isHighlighted && 'bg-accent/60 text-accent-foreground',
        )}
        style={{ paddingInlineStart: getItemOffset(depth) }}
      >
        {item.name}
      </Base.SidebarItem>
    )
  }

  function SidebarFolderNode({ item, children }: { item: PageTree.Folder; children: React.ReactNode }) {
    const depth = Base.useFolderDepth() + 1
    const open = effectiveExpanded.has(item.$id)
    const isDimmed = searchState.dimmedIds?.has(item.$id) ?? false
    const folderClassName = cn(
      item.index ? itemClasses({ variant: 'link', highlight: depth > 1 }) : itemClasses({ variant: item.collapsible === false ? undefined : 'button', highlight: false }),
      'w-full',
      isDimmed && 'opacity-[0.35]',
    )

    return (
        <Base.SidebarFolder
          depth={depth}
          open={open}
          onOpenChange={toggleFolder.bind(null, item.$id)}
          collapsible={item.collapsible ?? true}
          defaultOpen={item.defaultOpen}
          className='space-y-px'
      >
        {item.index ? (
          <Base.SidebarFolderLink
            href={item.index.url}
            active={isActiveUrl(item.index.url, activeUrl || currentPageHref || '')}
            className={folderClassName}
            style={{ paddingInlineStart: getItemOffset(depth - 1) }}
          >
            {item.name}
          </Base.SidebarFolderLink>
        ) : (
          <Base.SidebarFolderTrigger
            className={folderClassName}
            style={{ paddingInlineStart: getItemOffset(depth - 1) }}
          >
            {item.name}
          </Base.SidebarFolderTrigger>
        )}
        <Base.SidebarFolderContent
          className={cn(
            'relative',
            depth === 1 && "before:content-[''] before:absolute before:w-px before:inset-y-1 before:bg-border before:start-2.5",
          )}
        >
          {children}
        </Base.SidebarFolderContent>
      </Base.SidebarFolder>
    )
  }

  function SidebarSeparatorNode({ item }: { item: PageTree.Separator }) {
    const depth = Base.useFolderDepth()
    return (
      <Base.SidebarSeparator
        className='inline-flex items-center gap-2 mb-1.5 px-2 mt-6 empty:mb-0 first:mt-0 text-sm font-semibold text-foreground [&_svg]:size-4 [&_svg]:shrink-0'
        style={{ paddingInlineStart: getItemOffset(depth) }}
      >
        {item.name}
      </Base.SidebarSeparator>
    )
  }

  return (
    <TreeContextProvider tree={tree} activeUrl={activeUrl || currentPageHref || ''} fallbackUrl={currentPageHref}>
      <nav id='hc-sidebar' aria-label='Table of contents' className={cn('flex min-h-0 flex-col text-sm', className)} {...props}>
        <div className='px-4 pt-4 pb-2'>
          <input
            ref={searchInputRef}
            type='text'
            value={query}
            onChange={handleSearchInputChange}
            onKeyDown={handleSearchKeyDown}
            placeholder='Search...'
            className='inline-flex w-full items-center gap-2 rounded-lg border bg-secondary/50 p-1.5 ps-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:border-ring'
            aria-label='Search sidebar'
          />
        </div>
        <Base.SidebarViewport>
          <SidebarPageTree currentUrl={activeUrl || currentPageHref || ''} Item={SidebarItemNode} Folder={SidebarFolderNode} Separator={SidebarSeparatorNode} />
        </Base.SidebarViewport>
      </nav>
    </TreeContextProvider>
  )
}
