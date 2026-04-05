import { describe, test, expect } from 'vitest'
import {
  isNavPage,
  isNavGroup,
  getActiveTab,
  getActiveGroups,
  findPage,
  collectAllPages,
  buildPageIndex,
  hasVisibleSidebarEntries,
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

/* ── hasVisibleSidebarEntries ────────────────────────────────────────── */

describe('hasVisibleSidebarEntries', () => {
  test('group with one visible page → true', () => {
    const g: NavGroup = {
      group: 'G',
      pages: [makePage('a')],
    }
    expect(hasVisibleSidebarEntries(g)).toBe(true)
  })

  test('hidden group → false (regardless of children)', () => {
    const g: NavGroup = {
      group: 'G',
      hidden: true,
      pages: [makePage('a')],
    }
    expect(hasVisibleSidebarEntries(g)).toBe(false)
  })

  test('group with zero pages → true (intentional section divider)', () => {
    const g: NavGroup = { group: 'G', pages: [] }
    expect(hasVisibleSidebarEntries(g)).toBe(true)
  })

  test('wrapper with only a hidden-group child → false', () => {
    const hiddenChild: NavGroup = {
      group: 'Hidden',
      hidden: true,
      pages: [makePage('secret')],
    }
    const wrapper: NavGroup = {
      group: 'Wrapper',
      pages: [hiddenChild],
    }
    expect(hasVisibleSidebarEntries(wrapper)).toBe(false)
  })

  test('wrapper with a visible-group child (containing pages) → true', () => {
    const visibleChild: NavGroup = {
      group: 'Visible',
      pages: [makePage('p')],
    }
    const wrapper: NavGroup = {
      group: 'Wrapper',
      pages: [visibleChild],
    }
    expect(hasVisibleSidebarEntries(wrapper)).toBe(true)
  })

  test('deeply-nested hidden-only chain collapses to false', () => {
    // wrapper > middle > hidden-leaf (all nested groups have pages but
    // the leaf is hidden). The whole chain should be pruned.
    const hiddenLeaf: NavGroup = {
      group: 'Leaf',
      hidden: true,
      pages: [makePage('x')],
    }
    const middle: NavGroup = {
      group: 'Middle',
      pages: [hiddenLeaf],
    }
    const wrapper: NavGroup = {
      group: 'Wrapper',
      pages: [middle],
    }
    expect(hasVisibleSidebarEntries(wrapper)).toBe(false)
  })

  test('group with both hidden and visible children → true', () => {
    const hiddenChild: NavGroup = {
      group: 'Hidden',
      hidden: true,
      pages: [makePage('a')],
    }
    const wrapper: NavGroup = {
      group: 'Wrapper',
      pages: [hiddenChild, makePage('b')],
    }
    expect(hasVisibleSidebarEntries(wrapper)).toBe(true)
  })
})


