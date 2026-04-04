/*
 * Sidebar search powered by Orama — full-text, typo-tolerant, in-memory.
 *
 * Operates on SearchEntry[] — a flat list of all searchable items (groups,
 * pages, headings) derived from the NavGroup[] tree. Each entry carries a
 * groupPath for auto-expanding ancestor groups on match.
 */

import { create, insertMultiple, search, type AnyOrama } from '@orama/orama'

/* ── Types ───────────────────────────────────────────────────────────── */

/** Flat searchable item derived from NavGroup/NavPage/NavHeading. */
export type SearchEntry = {
  label: string
  href: string
  /** Path-based group key ("\0"-joined ancestor names) for auto-expanding. null for top-level groups. */
  groupPath: string | null
  /** Page href this entry belongs to (null for groups and pages themselves). */
  pageHref: string | null
}

export type SearchState = {
  /** Set of hrefs that matched the query. null = no active search. */
  matchedHrefs: Set<string> | null
  /** Set of group keys to force-expand. null = no override. */
  expandGroupKeys: Set<string> | null
  /** Set of hrefs to dim (opacity 0.3). null = no dimming. */
  dimmedHrefs: Set<string> | null
  /** Ordered list of hrefs that are focusable via arrow keys. null = all focusable. */
  focusableHrefs: string[] | null
}

export const emptySearchState: SearchState = {
  matchedHrefs: null,
  expandGroupKeys: null,
  dimmedHrefs: null,
  focusableHrefs: null,
}

/* ── Orama DB ────────────────────────────────────────────────────────── */

const tocSchema = {
  title: 'string',
} as const

/** Create and populate an Orama DB from search entries. Synchronous. */
export function createSearchDb({ entries }: { entries: SearchEntry[] }): AnyOrama {
  const db = create({ schema: tocSchema })
  insertMultiple(db, entries.map((e) => {
    return { title: e.label }
  })) as string[]
  return db
}

/* ── Search ──────────────────────────────────────────────────────────── */

/** Search the sidebar DB. Returns null matchedHrefs when query is empty (show all).
 *  Walks up the groupPath chain to expand all ancestor groups of matched items. */
export function searchSidebar({ db, query, entries }: {
  db: AnyOrama
  query: string
  entries: SearchEntry[]
}): SearchState {
  const trimmed = query.trim()
  if (!trimmed) {
    return emptySearchState
  }

  const results = search(db, {
    term: trimmed,
    properties: ['title'],
    tolerance: 1,
    limit: entries.length,
  }) as { hits: Array<{ id: string; score: number; document: { title: string } }> }

  if (results.hits.length === 0) {
    return {
      matchedHrefs: new Set(),
      expandGroupKeys: new Set(),
      dimmedHrefs: new Set(entries.map((e) => { return e.href })),
      focusableHrefs: [],
    }
  }

  /* Map matched titles back to hrefs. */
  const matchedTitles = new Set(results.hits.map((h) => { return h.document.title }))
  const matchedHrefs = new Set<string>()
  const expandGroupKeys = new Set<string>()

  for (const entry of entries) {
    if (matchedTitles.has(entry.label)) {
      matchedHrefs.add(entry.href)

      /* Expand the group this entry lives in */
      if (entry.groupPath) {
        expandGroupKeys.add(entry.groupPath)
        /* Walk up the \0-separated path to expand all ancestors */
        const parts = entry.groupPath.split('\0')
        for (let i = 1; i < parts.length; i++) {
          expandGroupKeys.add(parts.slice(0, i).join('\0'))
        }
      }

      /* If it's a heading match, also expand its parent page (mark it matched) */
      if (entry.pageHref) {
        matchedHrefs.add(entry.pageHref)
      }
    }
  }

  const dimmedHrefs = new Set(
    entries
      .filter((e) => { return !matchedHrefs.has(e.href) })
      .map((e) => { return e.href }),
  )

  /* Focusable in document order — only matched items */
  const focusableHrefs = entries
    .filter((e) => { return matchedHrefs.has(e.href) })
    .map((e) => { return e.href })

  return { matchedHrefs, expandGroupKeys, dimmedHrefs, focusableHrefs }
}
