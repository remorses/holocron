/**
 * Sidebar search — Orama full-text index + query over SearchEntry[].
 * Pure logic, no React/DOM. Feeds the SideNav search input.
 */

import { create, insertMultiple, search, type AnyOrama } from '@orama/orama'

/* ── Types ───────────────────────────────────────────────────────────── */

/** Flat searchable item derived from NavGroup/NavPage/NavHeading. */
export type SearchEntry = {
  label: string
  href: string
  searchText: string
  /** Path-based group key ("\0"-joined ancestor names). null for top-level groups. */
  groupPath: string | null
  /** Page href this entry belongs to (null for page entries themselves). */
  pageHref: string | null
}

/**
 * Active search result state. `null` when no query is active (show everything).
 *
 * All three fields are derived in one pass — no redundant sets.
 *   matchedHrefs   — page hrefs + heading hrefs that matched the query
 *   expandGroupKeys — ancestor group paths to force-open (same set used for visibility)
 *   visiblePages   — pages to render: matched pages ∪ parent pages of matched headings
 */
export type SearchState = {
  query: string
  matchedHrefs: Set<string>
  expandGroupKeys: Set<string>
  visiblePages: Set<string>
}

export type HighlightRange = {
  start: number
  end: number
}

export type HighlightSegment = {
  text: string
  matched: boolean
}

/* ── Orama DB ────────────────────────────────────────────────────────── */

const tocSchema = {
  href: 'string',
  text: 'string',
} as const

/** Create and populate an Orama DB from search entries. Synchronous. */
export function createSearchDb({ entries }: { entries: SearchEntry[] }): AnyOrama {
  const db = create({ schema: tocSchema })
  const insertResult = insertMultiple(db, entries.map((e) => ({ href: e.href, text: e.searchText })))
  if (insertResult instanceof Promise) {
    throw new Error('Expected synchronous search index insert')
  }
  return db
}

/* ── Search ──────────────────────────────────────────────────────────── */

/**
 * Search the sidebar DB. Returns `null` when query is empty (show all).
 * Returns state with empty sets when there are no hits.
 *
 * One pass builds all three output sets:
 *   matchedHrefs   — hrefs that matched (pages + headings)
 *   expandGroupKeys — every ancestor group prefix (for force-expanding parent groups)
 *   visiblePages   — pages to show in the sidebar (matched pages + parent pages of heading hits)
 */
export function searchSidebar({ db, query, entries }: {
  db: AnyOrama
  query: string
  entries: SearchEntry[]
}): SearchState | null {
  const trimmed = query.trim()
  if (!trimmed) return null

  const searchResult = search(db, {
    term: trimmed,
    properties: ['text'],
    tolerance: 1,
    limit: entries.length,
  })
  if (searchResult instanceof Promise) {
    throw new Error('Expected synchronous sidebar search')
  }

  const rawHits = new Set(searchResult.hits.map((h) => h.document.href))

  const matchedHrefs = new Set<string>()
  const expandGroupKeys = new Set<string>()
  const visiblePages = new Set<string>()

  for (const entry of entries) {
    if (!rawHits.has(entry.href)) continue

    matchedHrefs.add(entry.href)

    // Expand ancestor groups so the matched entry is reachable
    if (entry.groupPath !== null) {
      const parts = entry.groupPath.split('\0')
      for (let i = 1; i <= parts.length; i++) {
        expandGroupKeys.add(parts.slice(0, i).join('\0'))
      }
    }

    if (entry.pageHref) {
      // Heading hit — keep the parent page visible too
      visiblePages.add(entry.pageHref)
    } else {
      // Page hit
      visiblePages.add(entry.href)
    }
  }

  return { query: trimmed, matchedHrefs, expandGroupKeys, visiblePages }
}

/* ── Derived helpers (used by SideNav) ──────────────────────────────── */

/**
 * Ordered list of hrefs focusable via arrow keys.
 * Derived from the static entries list so document order is preserved.
 */
export function buildFocusableHrefs(state: SearchState, entries: SearchEntry[]): string[] {
  return entries
    .filter((e) => state.matchedHrefs.has(e.href))
    .map((e) => e.href)
}

/** Headings shown under a page in the sidebar. Search keeps only hits, not siblings. */
export function filterVisibleHeadings<T extends { slug: string; text: string }>({
  headings,
  pageHref,
  searchState,
}: {
  headings: T[]
  pageHref: string
  searchState: SearchState | null
}): T[] {
  const withText = headings.filter((heading) => heading.text)
  if (searchState === null) return withText
  return withText.filter((heading) => searchState.matchedHrefs.has(`${pageHref}#${heading.slug}`))
}

const MIN_HIGHLIGHT_TOKEN = 4

/** Match ranges for sidebar labels. Split the query into words and skip tokens shorter than 4 chars. */
export function findHighlightRanges({ text, query }: { text: string; query: string }): HighlightRange[] {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= MIN_HIGHLIGHT_TOKEN)
  if (!text || tokens.length === 0) return []

  const haystack = text.toLowerCase()
  const ranges: HighlightRange[] = []
  for (const token of tokens) {
    const needle = token.toLowerCase()
    let from = 0
    while (from <= haystack.length - needle.length) {
      const start = haystack.indexOf(needle, from)
      if (start === -1) break
      ranges.push({ start, end: start + needle.length })
      from = start + 1
    }
  }
  if (ranges.length === 0) return []

  ranges.sort((a, b) => a.start - b.start || a.end - b.end)
  const merged: HighlightRange[] = [{ ...ranges[0]! }]
  for (const range of ranges.slice(1)) {
    const last = merged[merged.length - 1]!
    if (range.start <= last.end) last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }
  return merged
}

/** Split a label into unmatched / matched segments for sidebar highlight marks. */
export function splitHighlightedText({ text, query }: { text: string; query: string }): HighlightSegment[] {
  const ranges = findHighlightRanges({ text, query })
  if (ranges.length === 0) return [{ text, matched: false }]
  const segments: HighlightSegment[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), matched: false })
    }
    segments.push({ text: text.slice(range.start, range.end), matched: true })
    cursor = range.end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), matched: false })
  return segments
}
