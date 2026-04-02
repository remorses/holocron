/**
 * Sidebar search state derived from a flattened page-tree index.
 */

import { create, insertMultiple, search, type AnyOrama } from '@orama/orama'
import type { FlatSidebarSearchItem } from '../../page-tree/index.ts'

const sidebarSchema = {
  title: 'string',
} as const

export type SearchState = {
  matchedIds: Set<string> | null
  expandOverride: Set<string> | null
  dimmedIds: Set<string> | null
  focusableIds: string[] | null
}

const emptySearchState: SearchState = {
  matchedIds: null,
  expandOverride: null,
  dimmedIds: null,
  focusableIds: null,
}

export function createSidebarDb({ items }: { items: FlatSidebarSearchItem[] }): AnyOrama {
  const db = create({ schema: sidebarSchema })
  insertMultiple(db, items.map((item) => {
    return { title: item.label }
  })) as string[]
  return db
}

export function searchSidebar({ db, query, items }: {
  db: AnyOrama
  query: string
  items: FlatSidebarSearchItem[]
}): SearchState {
  const trimmed = query.trim()
  if (!trimmed) {
    return emptySearchState
  }

  const results = search(db, {
    term: trimmed,
    properties: ['title'],
    tolerance: 1,
    limit: items.length,
  }) as { hits: Array<{ document: { title: string } }> }

  if (results.hits.length === 0) {
    return {
      matchedIds: new Set(),
      expandOverride: new Set(),
      dimmedIds: new Set(items.map((item) => { return item.id })),
      focusableIds: [],
    }
  }

  const matchedTitles = new Set(results.hits.map((hit) => { return hit.document.title }))
  const itemById = new Map(items.map((item) => { return [item.id, item] as const }))
  const matchedIds = new Set<string>()
  const expandOverride = new Set<string>()
  const focusableIds: string[] = []

  for (const item of items) {
    if (!matchedTitles.has(item.label)) {
      continue
    }

    matchedIds.add(item.id)

    let current: FlatSidebarSearchItem | undefined = item
    while (current?.parentId) {
      expandOverride.add(current.parentId)
      current = itemById.get(current.parentId)
    }

    expandOverride.add(item.id)
    if (item.href) {
      focusableIds.push(item.id)
    }
  }

  const dimmedIds = new Set(
    items
      .filter((item) => { return !matchedIds.has(item.id) })
      .map((item) => { return item.id }),
  )

  return {
    matchedIds,
    expandOverride,
    dimmedIds,
    focusableIds,
  }
}
