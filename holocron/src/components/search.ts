/*
 * TOC search powered by Orama — full-text, typo-tolerant, in-memory.
 * Reference: https://www.mintlify.com/oramasearch/orama/quickstart.md
 *
 * Operates directly on FlatTocItem[] — no intermediate SearchEntry type.
 * Each flat item already carries parentHref and pageHref for deriving
 * which groups to expand and which items to dim. Scales to thousands
 * of entries — Orama searches in ~20us, derive pass is O(n).
 */

import { create, insertMultiple, search, type AnyOrama } from '@orama/orama'
import type { FlatTocItem } from './toc-tree.ts'

const tocSchema = {
  title: 'string',
} as const

/** Create and populate an Orama DB from flat TOC items. Synchronous. */
export function createTocDb({ items }: { items: FlatTocItem[] }): AnyOrama {
  const db = create({ schema: tocSchema })
  /* insertMultiple is sync with default components. We cast away the union
     return type since we know no async components are configured. */
  insertMultiple(db, items.map((item) => {
    return { title: item.label }
  })) as string[]
  return db
}

export type SearchState = {
  /** Set of hrefs that matched the query. null = no active search. */
  matchedHrefs: Set<string> | null
  /** Set of parent hrefs to force-expand. null = no override. */
  expandOverride: Set<string> | null
  /** Set of hrefs to dim (opacity 0.3). null = no dimming. */
  dimmedHrefs: Set<string> | null
  /** Ordered list of hrefs that are focusable via arrow keys. null = all focusable. */
  focusableHrefs: string[] | null
}

const emptySearchState: SearchState = {
  matchedHrefs: null,
  expandOverride: null,
  dimmedHrefs: null,
  focusableHrefs: null,
}

/** Search the TOC DB. Returns null matchedHrefs when query is empty (show all).
 *  Walks up the parentHref chain to expand all ancestors of matched items. */
export function searchToc({ db, query, items }: {
  db: AnyOrama
  query: string
  items: FlatTocItem[]
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
  }) as { hits: Array<{ id: string; score: number; document: { title: string } }> }

  if (results.hits.length === 0) {
    return {
      matchedHrefs: new Set(),
      expandOverride: new Set(),
      dimmedHrefs: new Set(items.map((i) => { return i.href })),
      focusableHrefs: [],
    }
  }

  /* Map matched titles back to hrefs. Orama doesn't store our custom fields,
     so we match by title. For identical titles this is fine — both would match. */
  const matchedTitles = new Set(results.hits.map((h) => { return h.document.title }))
  const itemByHref = new Map(items.map((i) => { return [i.href, i] as const }))

  const matchedHrefs = new Set<string>()
  const expandOverride = new Set<string>()

  for (const item of items) {
    if (matchedTitles.has(item.label)) {
      matchedHrefs.add(item.href)
      /* Walk up the parent chain to expand all ancestors */
      let current: FlatTocItem | undefined = item
      while (current?.parentHref) {
        expandOverride.add(current.parentHref)
        current = itemByHref.get(current.parentHref)
      }
      /* If the matched item itself has children, expand it too */
      expandOverride.add(item.href)
    }
  }

  const dimmedHrefs = new Set(
    items
      .filter((i) => { return !matchedHrefs.has(i.href) })
      .map((i) => { return i.href }),
  )

  /* Focusable in document order — only matched items */
  const focusableHrefs = items
    .filter((i) => { return matchedHrefs.has(i.href) })
    .map((i) => { return i.href })

  return { matchedHrefs, expandOverride, dimmedHrefs, focusableHrefs }
}
