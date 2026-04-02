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

/* ── flattenForSidebar ───────────────────────────────────────────────── */

describe('flattenForSidebar', () => {
  test('groups become level 0, pages level 1', () => {
    const groups: NavGroup[] = [
      makeGroup('Getting Started', [
        makePage('intro'),
        makePage('install'),
      ]),
    ]
    const flat = flattenForSidebar(groups)
    expect(flat.map((f) => ({ label: f.label, type: f.type, visualLevel: f.visualLevel }))).toMatchInlineSnapshot(`
      [
        {
          "label": "Getting Started",
          "type": "page",
          "visualLevel": 0,
        },
        {
          "label": "Intro",
          "type": "page",
          "visualLevel": 1,
        },
        {
          "label": "Install",
          "type": "page",
          "visualLevel": 1,
        },
      ]
    `)
  })

  test('page headings are included as nested items', () => {
    const pageWithHeadings = makePage('api', {
      headings: [
        { depth: 2, text: 'Overview', slug: 'overview' },
        { depth: 3, text: 'Methods', slug: 'methods' },
        { depth: 2, text: 'Examples', slug: 'examples' },
      ],
    })
    const groups: NavGroup[] = [makeGroup('Reference', [pageWithHeadings])]
    const flat = flattenForSidebar(groups)
    expect(flat.map((f) => ({
      label: f.label,
      type: f.type,
      visualLevel: f.visualLevel,
      parentHref: f.parentHref,
      pageHref: f.pageHref,
    }))).toMatchInlineSnapshot(`
      [
        {
          "label": "Reference",
          "pageHref": "#group-reference",
          "parentHref": null,
          "type": "page",
          "visualLevel": 0,
        },
        {
          "label": "Api",
          "pageHref": "/api",
          "parentHref": "#group-reference",
          "type": "page",
          "visualLevel": 1,
        },
        {
          "label": "Overview",
          "pageHref": "/api",
          "parentHref": "/api",
          "type": "h2",
          "visualLevel": 2,
        },
        {
          "label": "Methods",
          "pageHref": "/api",
          "parentHref": "/api",
          "type": "h3",
          "visualLevel": 3,
        },
        {
          "label": "Examples",
          "pageHref": "/api",
          "parentHref": "/api",
          "type": "h2",
          "visualLevel": 2,
        },
      ]
    `)
  })

  test('heading hrefs include page href as prefix', () => {
    const page = makePage('guide', {
      headings: [{ depth: 2, text: 'Setup', slug: 'setup' }],
    })
    const flat = flattenForSidebar([makeGroup('Docs', [page])])
    const headingItem = flat.find((f) => f.label === 'Setup')
    expect(headingItem!.href).toBe('/guide#setup')
  })

  test('nested groups increase visual depth', () => {
    const nestedGroup: NavGroup = {
      group: 'Advanced',
      pages: [
        {
          group: 'Internals',
          pages: [makePage('core')],
        } as NavGroup,
      ],
    }
    const flat = flattenForSidebar([nestedGroup])
    expect(flat.map((f) => ({ label: f.label, visualLevel: f.visualLevel }))).toMatchInlineSnapshot(`
      [
        {
          "label": "Advanced",
          "visualLevel": 0,
        },
        {
          "label": "Internals",
          "visualLevel": 1,
        },
        {
          "label": "Core",
          "visualLevel": 2,
        },
      ]
    `)
  })

  test('empty groups produce empty flat list', () => {
    expect(flattenForSidebar([])).toMatchInlineSnapshot(`[]`)
  })

  test('multiple groups with pages and headings', () => {
    const groups: NavGroup[] = [
      makeGroup('Guide', [
        makePage('intro', {
          headings: [{ depth: 2, text: 'Welcome', slug: 'welcome' }],
        }),
      ]),
      makeGroup('API', [
        makePage('api/ref', {
          headings: [
            { depth: 2, text: 'Endpoints', slug: 'endpoints' },
            { depth: 2, text: 'Auth', slug: 'auth' },
          ],
        }),
      ]),
    ]
    const flat = flattenForSidebar(groups)
    const labels = flat.map((f) => f.label)
    expect(labels).toMatchInlineSnapshot(`
      [
        "Guide",
        "Intro",
        "Welcome",
        "API",
        "Api/ref",
        "Endpoints",
        "Auth",
      ]
    `)
  })
})
