import { describe, test, expect } from 'vitest'
import {
  isNavPage,
  isNavGroup,
  getActiveTab,
  getActiveGroups,
  findPage,
  collectAllPages,
  buildPageIndex,
  flattenForSidebar,
  type NavTab,
  type NavGroup,
  type NavPage,
  type Navigation,
} from './navigation.ts'

/* ── Test fixtures ───────────────────────────────────────────────────── */

function makePage(slug: string, overrides?: Partial<NavPage>): NavPage {
  return {
    slug,
    href: `/${slug}`,
    title: slug.charAt(0).toUpperCase() + slug.slice(1),
    gitSha: 'abc123',
    headings: [],
    ...overrides,
  }
}

function makeGroup(name: string, pages: NavPage[]): NavGroup {
  return { group: name, pages }
}

function makeNav(tabs: NavTab[]): Navigation {
  return tabs
}

/* ── Simple two-tab navigation used by many tests ────────────────────── */

const docsTab: NavTab = {
  tab: 'Docs',
  groups: [
    makeGroup('Getting Started', [
      makePage('introduction'),
      makePage('quickstart'),
    ]),
    makeGroup('API', [
      makePage('api/overview'),
      makePage('api/endpoints'),
    ]),
  ],
}

const guidesTab: NavTab = {
  tab: 'Guides',
  groups: [
    makeGroup('Tutorials', [
      makePage('guides/first-app'),
      makePage('guides/deployment'),
    ]),
  ],
}

const twoTabNav = makeNav([docsTab, guidesTab])

/* ── isNavPage / isNavGroup ──────────────────────────────────────────── */

describe('type guards', () => {
  test('isNavPage returns true for NavPage', () => {
    expect(isNavPage(makePage('intro'))).toBe(true)
  })

  test('isNavPage returns false for NavGroup', () => {
    expect(isNavPage(makeGroup('Group', []))).toBe(false)
  })

  test('isNavGroup returns true for NavGroup', () => {
    expect(isNavGroup(makeGroup('Group', []))).toBe(true)
  })

  test('isNavGroup returns false for NavPage', () => {
    expect(isNavGroup(makePage('page'))).toBe(false)
  })
})

/* ── getActiveTab ────────────────────────────────────────────────────── */

describe('getActiveTab', () => {
  test('single tab always returns that tab', () => {
    const nav = makeNav([docsTab])
    expect(getActiveTab(nav, '/anything').tab).toBe('Docs')
  })

  test('matches by URL prefix for multi-tab nav', () => {
    const result = getActiveTab(twoTabNav, '/guides/first-app')
    expect(result.tab).toBe('Guides')
  })

  test('root path matches first tab (docs)', () => {
    const result = getActiveTab(twoTabNav, '/introduction')
    expect(result.tab).toBe('Docs')
  })

  test('returns first tab as fallback for unknown paths', () => {
    const result = getActiveTab(twoTabNav, '/unknown/path')
    expect(result.tab).toBe('Docs')
  })

  test('empty nav returns empty tab', () => {
    const result = getActiveTab([], '/')
    expect(result).toMatchInlineSnapshot(`
      {
        "groups": [],
        "tab": "",
      }
    `)
  })
})

/* ── getActiveGroups ─────────────────────────────────────────────────── */

describe('getActiveGroups', () => {
  test('returns groups for the matched tab', () => {
    const groups = getActiveGroups(twoTabNav, '/guides/deployment')
    expect(groups.length).toBe(1)
    expect(groups[0]!.group).toBe('Tutorials')
  })
})

/* ── findPage ────────────────────────────────────────────────────────── */

describe('findPage', () => {
  test('finds page by slug', () => {
    const page = findPage(twoTabNav, 'quickstart')
    expect(page).toBeDefined()
    expect(page!.title).toBe('Quickstart')
  })

  test('finds page in second tab', () => {
    const page = findPage(twoTabNav, 'guides/first-app')
    expect(page).toBeDefined()
    expect(page!.href).toBe('/guides/first-app')
  })

  test('returns undefined for missing slug', () => {
    expect(findPage(twoTabNav, 'nonexistent')).toBeUndefined()
  })

  test('finds page inside nested group', () => {
    const nestedGroup: NavGroup = {
      group: 'Advanced',
      pages: [
        {
          group: 'Internals',
          pages: [makePage('internals/core')],
        },
      ],
    }
    const nav: Navigation = [{ tab: 'Docs', groups: [nestedGroup] }]
    const page = findPage(nav, 'internals/core')
    expect(page).toBeDefined()
    expect(page!.slug).toBe('internals/core')
  })
})

/* ── collectAllPages ─────────────────────────────────────────────────── */

describe('collectAllPages', () => {
  test('collects all pages from all tabs', () => {
    const pages = collectAllPages(twoTabNav)
    expect(pages.length).toBe(6)
    expect(pages.map((p) => p.slug)).toMatchInlineSnapshot(`
      [
        "introduction",
        "quickstart",
        "api/overview",
        "api/endpoints",
        "guides/first-app",
        "guides/deployment",
      ]
    `)
  })

  test('empty nav returns empty array', () => {
    expect(collectAllPages([])).toMatchInlineSnapshot(`[]`)
  })
})

/* ── buildPageIndex ──────────────────────────────────────────────────── */

describe('buildPageIndex', () => {
  test('builds map keyed by slug', () => {
    const index = buildPageIndex(twoTabNav)
    expect(index.size).toBe(6)
    expect(index.get('quickstart')?.title).toBe('Quickstart')
    expect(index.get('guides/deployment')?.href).toBe('/guides/deployment')
  })

  test('missing slug returns undefined', () => {
    const index = buildPageIndex(twoTabNav)
    expect(index.get('nope')).toBeUndefined()
  })
})

/* ── flattenForSidebar ──────────────────────────────────────────────── */

describe('flattenForSidebar', () => {
  test('flattens groups and pages into flat items', () => {
    const items = flattenForSidebar([
      makeGroup('Getting Started', [makePage('intro'), makePage('install')]),
    ])

    expect(items.map((i) => ({ label: i.label, href: i.href, type: i.type, visualLevel: i.visualLevel }))).toMatchInlineSnapshot(`
      [
        {
          "href": "#group-getting-started",
          "label": "Getting Started",
          "type": "page",
          "visualLevel": 0,
        },
        {
          "href": "/intro",
          "label": "Intro",
          "type": "page",
          "visualLevel": 1,
        },
        {
          "href": "/install",
          "label": "Install",
          "type": "page",
          "visualLevel": 1,
        },
      ]
    `)
  })

  test('includes page headings as flat children', () => {
    const page = makePage('guide', {
      headings: [
        { depth: 2, text: 'Overview', slug: 'overview' },
        { depth: 3, text: 'Methods', slug: 'methods' },
        { depth: 2, text: 'Examples', slug: 'examples' },
      ],
    })

    const items = flattenForSidebar([makeGroup('Docs', [page])])

    expect(items.map((i) => ({ label: i.label, href: i.href, type: i.type, visualLevel: i.visualLevel, parentHref: i.parentHref }))).toMatchInlineSnapshot(`
      [
        {
          "href": "#group-docs",
          "label": "Docs",
          "parentHref": null,
          "type": "page",
          "visualLevel": 0,
        },
        {
          "href": "/guide",
          "label": "Guide",
          "parentHref": "#group-docs",
          "type": "page",
          "visualLevel": 1,
        },
        {
          "href": "/guide#overview",
          "label": "Overview",
          "parentHref": "/guide",
          "type": "h2",
          "visualLevel": 2,
        },
        {
          "href": "/guide#methods",
          "label": "Methods",
          "parentHref": "/guide#overview",
          "type": "h3",
          "visualLevel": 3,
        },
        {
          "href": "/guide#examples",
          "label": "Examples",
          "parentHref": "/guide",
          "type": "h2",
          "visualLevel": 2,
        },
      ]
    `)
  })

  test('handles nested groups', () => {
    const nestedGroup: NavGroup = {
      group: 'Advanced',
      pages: [
        {
          group: 'Internals',
          pages: [makePage('core')],
        } as NavGroup,
      ],
    }

    const items = flattenForSidebar([nestedGroup])
    expect(items.map((i) => ({ label: i.label, visualLevel: i.visualLevel, parentHref: i.parentHref }))).toMatchInlineSnapshot(`
      [
        {
          "label": "Advanced",
          "parentHref": null,
          "visualLevel": 0,
        },
        {
          "label": "Internals",
          "parentHref": "#group-advanced",
          "visualLevel": 1,
        },
        {
          "label": "Core",
          "parentHref": "#group-internals",
          "visualLevel": 2,
        },
      ]
    `)
  })

  test('empty groups produce empty array', () => {
    expect(flattenForSidebar([])).toMatchInlineSnapshot(`[]`)
  })
})
