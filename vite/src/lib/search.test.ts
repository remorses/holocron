/**
 * Unit tests for searchSidebar, heading visibility, and highlight segments.
 * Pure function tests — no fixtures, no DOM, no Orama side-effects on assertions.
 */
import { describe, test, expect } from 'vitest'
import { createSearchDb, searchSidebar, buildFocusableHrefs, visibleSidebarHeadings, splitHighlightedText, type SearchEntry, type SearchState } from './search.ts'

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
    const state = searchSidebar({ db, query: 'Installation', entries })!
    const focusable = buildFocusableHrefs(state, entries)
    expect(focusable).toMatchInlineSnapshot(`
      [
        "/guide#install",
      ]
    `)
  })
})

describe('visibleSidebarHeadings', () => {
  const headings = [
    { slug: 'install', text: 'Installation' },
    { slug: 'config', text: 'Configuration' },
    { slug: 'empty', text: '' },
  ]

  test('without search, returns headings that have text', () => {
    expect(visibleSidebarHeadings({
      headings,
      pageHref: '/guide',
      searchState: null,
      isActive: true,
      tocSuppressed: false,
    })).toMatchInlineSnapshot(`
      {
        "headings": [
          {
            "slug": "install",
            "text": "Installation",
          },
          {
            "slug": "config",
            "text": "Configuration",
          },
        ],
        "show": true,
      }
    `)
  })

  test('with search, returns only matched headings and not siblings', () => {
    const state: SearchState = {
      query: 'install',
      matchedHrefs: new Set(['/guide#install']),
      expandGroupKeys: new Set(['Docs']),
      visiblePages: new Set(['/guide']),
    }
    expect(visibleSidebarHeadings({
      headings,
      pageHref: '/guide',
      searchState: state,
      isActive: false,
      tocSuppressed: false,
    })).toMatchInlineSnapshot(`
      {
        "headings": [
          {
            "slug": "install",
            "text": "Installation",
          },
        ],
        "show": true,
      }
    `)
  })

  test('with search and no heading hits, returns no headings', () => {
    const state: SearchState = {
      query: 'guide',
      matchedHrefs: new Set(['/guide']),
      expandGroupKeys: new Set(['Docs']),
      visiblePages: new Set(['/guide']),
    }
    expect(visibleSidebarHeadings({
      headings,
      pageHref: '/guide',
      searchState: state,
      isActive: true,
      tocSuppressed: false,
    })).toMatchInlineSnapshot(`
      {
        "headings": [],
        "show": false,
      }
    `)
  })

  test('search heading hits on a group root page still surface those headings', () => {
    const state: SearchState = {
      query: 'Installation',
      matchedHrefs: new Set(['/guide#install']),
      expandGroupKeys: new Set(['Guide']),
      visiblePages: new Set(['/guide']),
    }
    expect(visibleSidebarHeadings({
      headings,
      pageHref: '/guide',
      searchState: state,
      isActive: false,
      tocSuppressed: true,
    })).toMatchInlineSnapshot(`
      {
        "headings": [
          {
            "slug": "install",
            "text": "Installation",
          },
        ],
        "show": true,
      }
    `)
  })
})

describe('splitHighlightedText', () => {
  test('returns the full text unmatched for empty query or short tokens', () => {
    expect(splitHighlightedText({ text: 'Installation', query: '' })).toMatchInlineSnapshot(`
      [
        {
          "matched": false,
          "text": "Installation",
        },
      ]
    `)
    expect(splitHighlightedText({ text: 'API auth', query: 'API' })).toMatchInlineSnapshot(`
      [
        {
          "matched": false,
          "text": "API auth",
        },
      ]
    `)
  })

  test('highlights tokens longer than 3 characters, case insensitive', () => {
    expect(splitHighlightedText({ text: 'Getting Started', query: 'start' })).toMatchInlineSnapshot(`
      [
        {
          "matched": false,
          "text": "Getting ",
        },
        {
          "matched": true,
          "text": "Start",
        },
        {
          "matched": false,
          "text": "ed",
        },
      ]
    `)
    expect(splitHighlightedText({ text: 'Installation', query: 'INSTAL' })).toMatchInlineSnapshot(`
      [
        {
          "matched": true,
          "text": "Instal",
        },
        {
          "matched": false,
          "text": "lation",
        },
      ]
    `)
  })

  test('splits the query into words and skips short ones', () => {
    expect(splitHighlightedText({ text: 'API Authentication', query: 'api auth' })).toMatchInlineSnapshot(`
      [
        {
          "matched": false,
          "text": "API ",
        },
        {
          "matched": true,
          "text": "Auth",
        },
        {
          "matched": false,
          "text": "entication",
        },
      ]
    `)
  })

  test('highlights every occurrence and merges overlapping tokens', () => {
    expect(splitHighlightedText({ text: 'Config configuration', query: 'config' })).toMatchInlineSnapshot(`
      [
        {
          "matched": true,
          "text": "Config",
        },
        {
          "matched": false,
          "text": " ",
        },
        {
          "matched": true,
          "text": "config",
        },
        {
          "matched": false,
          "text": "uration",
        },
      ]
    `)
    expect(splitHighlightedText({ text: 'Getting Started', query: 'start started' })).toMatchInlineSnapshot(`
      [
        {
          "matched": false,
          "text": "Getting ",
        },
        {
          "matched": true,
          "text": "Started",
        },
      ]
    `)
  })

  test('strips punctuation from query tokens', () => {
    expect(splitHighlightedText({ text: 'Authentication', query: 'authentication,' })).toMatchInlineSnapshot(`
      [
        {
          "matched": true,
          "text": "Authentication",
        },
      ]
    `)
  })

  test('matches folded diacritics', () => {
    expect(splitHighlightedText({ text: 'Café Guide', query: 'cafe' })).toMatchInlineSnapshot(`
      [
        {
          "matched": true,
          "text": "Café",
        },
        {
          "matched": false,
          "text": " Guide",
        },
      ]
    `)
  })

  test('maps folded indexes back onto the original string', () => {
    expect(splitHighlightedText({ text: 'İ ABCD tail', query: 'abcd' })).toMatchInlineSnapshot(`
      [
        {
          "matched": false,
          "text": "İ ",
        },
        {
          "matched": true,
          "text": "ABCD",
        },
        {
          "matched": false,
          "text": " tail",
        },
      ]
    `)
  })
})
