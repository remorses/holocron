/**
 * Unit tests for searchSidebar and buildFocusableHrefs.
 * Pure function tests — no fixtures, no DOM, no Orama side-effects on assertions.
 */
import { describe, test, expect } from 'vitest'
import { createSearchDb, searchSidebar, buildFocusableHrefs, type SearchEntry } from './search.ts'

/** Build a minimal SearchEntry for a page. */
function page({ href, title, groupPath }: { href: string; title: string; groupPath: string }): SearchEntry {
  return { href, label: title, searchText: title, groupPath, pageHref: null }
}

/** Build a minimal SearchEntry for a heading. */
function heading({ pageHref, slug, text, groupPath }: {
  pageHref: string
  slug: string
  text: string
  groupPath: string
}): SearchEntry {
  return {
    href: `${pageHref}#${slug}`,
    label: text,
    searchText: text,
    groupPath,
    pageHref,
  }
}

function setup(entries: SearchEntry[]) {
  const db = createSearchDb({ entries })
  const run = (query: string) => searchSidebar({ db, query, entries })
  return { run }
}

describe('searchSidebar', () => {
  test('empty query returns null', () => {
    const entries = [page({ href: '/a', title: 'Alpha', groupPath: 'Guides' })]
    const { run } = setup(entries)
    expect(run('')).toBeNull()
    expect(run('   ')).toBeNull()
  })

  test('page title match — visiblePages + expandGroupKeys', () => {
    const entries = [
      page({ href: '/a', title: 'Introduction', groupPath: 'Guides' }),
      page({ href: '/b', title: 'Authentication', groupPath: 'Guides' }),
    ]
    const { run } = setup(entries)
    const state = run('Introduction')
    expect(state).not.toBeNull()
    expect([...state!.visiblePages]).toMatchInlineSnapshot(`
      [
        "/a",
      ]
    `)
    expect([...state!.matchedHrefs]).toMatchInlineSnapshot(`
      [
        "/a",
      ]
    `)
    // ancestor group key present
    expect(state!.expandGroupKeys.has('Guides')).toBe(true)
    // non-matching page not visible
    expect(state!.visiblePages.has('/b')).toBe(false)
  })

  test('heading match — parent page is in visiblePages, not just the heading href', () => {
    const entries = [
      page({ href: '/guide', title: 'Guide', groupPath: 'Docs' }),
      heading({ pageHref: '/guide', slug: 'setup', text: 'Setup section', groupPath: 'Docs' }),
    ]
    const { run } = setup(entries)
    const state = run('Setup')
    expect(state).not.toBeNull()
    // heading href in matchedHrefs
    expect(state!.matchedHrefs.has('/guide#setup')).toBe(true)
    // parent page surfaced in visiblePages
    expect(state!.visiblePages.has('/guide')).toBe(true)
    // parent page itself is NOT in matchedHrefs (only the heading matched)
    expect(state!.matchedHrefs.has('/guide')).toBe(false)
  })

  test('heading match in unnamed root pages group expands the empty group key', () => {
    const entries = [
      page({ href: '/', title: 'Home', groupPath: '' }),
      heading({ pageHref: '/', slug: 'install', text: 'Install', groupPath: '' }),
    ]
    const { run } = setup(entries)
    const state = run('Install')

    expect(state).not.toBeNull()
    expect(state!.matchedHrefs.has('/#install')).toBe(true)
    expect(state!.visiblePages.has('/')).toBe(true)
    expect(state!.expandGroupKeys.has('')).toBe(true)
  })

  test('nested groups — full ancestor chain in expandGroupKeys', () => {
    const groupPath = 'outer\0inner\0leaf'
    const entries = [page({ href: '/deep', title: 'Deep page', groupPath })]
    const { run } = setup(entries)
    const state = run('Deep')
    expect(state).not.toBeNull()
    expect(state!.expandGroupKeys.has('outer')).toBe(true)
    expect(state!.expandGroupKeys.has('outer\0inner')).toBe(true)
    expect(state!.expandGroupKeys.has('outer\0inner\0leaf')).toBe(true)
  })

  test('zero hits — empty sets (not null)', () => {
    const entries = [page({ href: '/a', title: 'Introduction', groupPath: 'Guides' })]
    const { run } = setup(entries)
    const state = run('xyzzy_no_match_ever')
    expect(state).not.toBeNull()
    expect(state!.matchedHrefs.size).toBe(0)
    expect(state!.visiblePages.size).toBe(0)
    expect(state!.expandGroupKeys.size).toBe(0)
  })

  test('sibling exclusion — non-matching sibling absent from visiblePages', () => {
    const entries = [
      page({ href: '/a', title: 'Alpha', groupPath: 'Guides' }),
      page({ href: '/b', title: 'Beta', groupPath: 'Guides' }),
      page({ href: '/c', title: 'Gamma', groupPath: 'Guides' }),
    ]
    const { run } = setup(entries)
    const state = run('Alpha')
    expect(state).not.toBeNull()
    expect(state!.visiblePages.has('/a')).toBe(true)
    expect(state!.visiblePages.has('/b')).toBe(false)
    expect(state!.visiblePages.has('/c')).toBe(false)
  })

  test('multiple tabs — entries from different tabs are searched together', () => {
    const entries = [
      page({ href: '/guide', title: 'Getting Started', groupPath: 'Guides' }),
      page({ href: '/api/auth', title: 'Authentication', groupPath: 'API' }),
    ]
    const { run } = setup(entries)
    const state = run('Getting')
    expect(state).not.toBeNull()
    expect(state!.visiblePages.has('/guide')).toBe(true)
    expect(state!.visiblePages.has('/api/auth')).toBe(false)
  })
})

describe('buildFocusableHrefs', () => {
  test('returns matched hrefs in document (insertion) order', () => {
    const entries = [
      page({ href: '/a', title: 'Alpha', groupPath: 'Guides' }),
      page({ href: '/b', title: 'Beta', groupPath: 'Guides' }),
      page({ href: '/c', title: 'Gamma', groupPath: 'Guides' }),
    ]
    const db = createSearchDb({ entries })
    const state = searchSidebar({ db, query: 'Alpha', entries })!
    const focusable = buildFocusableHrefs(state, entries)
    expect(focusable).toMatchInlineSnapshot(`
      [
        "/a",
      ]
    `)
  })

  test('heading hrefs are included in document order', () => {
    const entries = [
      page({ href: '/guide', title: 'Guide', groupPath: 'Docs' }),
      heading({ pageHref: '/guide', slug: 'install', text: 'Installation', groupPath: 'Docs' }),
      heading({ pageHref: '/guide', slug: 'config', text: 'Configuration', groupPath: 'Docs' }),
      page({ href: '/other', title: 'Other', groupPath: 'Docs' }),
    ]
    const db = createSearchDb({ entries })
    // Search for something that matches the page title
    const state = searchSidebar({ db, query: 'Installation', entries })!
    const focusable = buildFocusableHrefs(state, entries)
    expect(focusable).toMatchInlineSnapshot(`
      [
        "/guide#install",
      ]
    `)
  })
})
