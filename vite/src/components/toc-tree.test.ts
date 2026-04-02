import { describe, test, expect } from 'vitest'
import {
  slugify,
  extractText,
  generateTocTree,
  flattenTocTree,
  type TocTreeNode,
} from './toc-tree.ts'
import { mdxParse } from 'safe-mdx/parse'
import type { Root, PhrasingContent } from 'mdast'

/* ── Helper: parse real MDX string into mdast ────────────────────────── */

function parse(mdx: string): Root {
  return mdxParse(mdx) as Root
}

/* ── slugify ─────────────────────────────────────────────────────────── */

describe('slugify', () => {
  test('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Getting Started')).toBe('getting-started')
  })

  test('strips special characters', () => {
    expect(slugify('What is this? (FAQ)')).toBe('what-is-this-faq')
  })

  test('collapses multiple hyphens', () => {
    expect(slugify('one - two --- three')).toBe('one-two-three')
  })

  test('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  test('handles already-slugified text', () => {
    expect(slugify('already-slugified')).toBe('already-slugified')
  })
})

/* ── extractText ─────────────────────────────────────────────────────── */

describe('extractText', () => {
  test('extracts plain text', () => {
    const children: PhrasingContent[] = [{ type: 'text', value: 'Hello World' }]
    expect(extractText(children)).toBe('Hello World')
  })

  test('extracts text from nested strong/emphasis', () => {
    const children: PhrasingContent[] = [
      { type: 'text', value: 'Hello ' },
      {
        type: 'strong',
        children: [{ type: 'text', value: 'bold' }],
      },
      { type: 'text', value: ' and ' },
      {
        type: 'emphasis',
        children: [{ type: 'text', value: 'italic' }],
      },
    ]
    expect(extractText(children)).toBe('Hello bold and italic')
  })

  test('extracts text from inline code', () => {
    const children: PhrasingContent[] = [
      { type: 'text', value: 'Use ' },
      { type: 'inlineCode', value: 'npm install' },
    ]
    // inlineCode has no 'text' type and no children, returns ''
    expect(extractText(children)).toBe('Use ')
  })

  test('handles deeply nested content', () => {
    const children: PhrasingContent[] = [
      {
        type: 'strong',
        children: [
          {
            type: 'emphasis',
            children: [{ type: 'text', value: 'deep' }],
          },
        ],
      },
    ]
    expect(extractText(children)).toBe('deep')
  })

  test('handles empty children', () => {
    expect(extractText([])).toBe('')
  })
})

/* ── generateTocTree ─────────────────────────────────────────────────── */

describe('generateTocTree', () => {
  test('flat h2 headings become root-level siblings', () => {
    const mdast = parse(`## First

Some text.

## Second

More text.

## Third`)
    const tree = generateTocTree(mdast)
    expect(tree).toMatchInlineSnapshot(`
      [
        {
          "children": [],
          "href": "#first",
          "label": "First",
          "type": "h2",
        },
        {
          "children": [],
          "href": "#second",
          "label": "Second",
          "type": "h2",
        },
        {
          "children": [],
          "href": "#third",
          "label": "Third",
          "type": "h2",
        },
      ]
    `)
  })

  test('h3 nests under preceding h2', () => {
    const mdast = parse(`## Parent

Intro text.

### Child A

### Child B`)
    const tree = generateTocTree(mdast)
    expect(tree).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "children": [],
              "href": "#child-a",
              "label": "Child A",
              "type": "h3",
            },
            {
              "children": [],
              "href": "#child-b",
              "label": "Child B",
              "type": "h3",
            },
          ],
          "href": "#parent",
          "label": "Parent",
          "type": "h2",
        },
      ]
    `)
  })

  test('deep nesting h2 → h3 → h4', () => {
    const mdast = parse(`## Section

### Subsection

#### Detail`)
    const tree = generateTocTree(mdast)
    expect(tree.length).toBe(1)
    expect(tree[0]!.children.length).toBe(1)
    expect(tree[0]!.children[0]!.children.length).toBe(1)
    expect(tree[0]!.children[0]!.children[0]!.label).toBe('Detail')
  })

  test('skipped level: h2 → h4 (h4 still nests under h2)', () => {
    const mdast = parse(`## Top

#### Skipped to h4`)
    const tree = generateTocTree(mdast)
    expect(tree.length).toBe(1)
    expect(tree[0]!.children.length).toBe(1)
    expect(tree[0]!.children[0]!.label).toBe('Skipped to h4')
    expect(tree[0]!.children[0]!.type).toBe('h4')
  })

  test('new h2 after nested children resets depth', () => {
    const mdast = parse(`## First

### Nested

## Second`)
    const tree = generateTocTree(mdast)
    expect(tree.length).toBe(2)
    expect(tree[0]!.children.length).toBe(1)
    expect(tree[1]!.children.length).toBe(0)
    expect(tree[1]!.label).toBe('Second')
  })

  test('empty document produces empty tree', () => {
    const mdast = parse(`Just plain text, no headings at all.`)
    expect(generateTocTree(mdast)).toMatchInlineSnapshot(`[]`)
  })

  test('non-heading nodes are ignored', () => {
    const mdast = parse(`Some paragraph text.

## Only Heading

More paragraph text.`)
    const tree = generateTocTree(mdast)
    expect(tree.length).toBe(1)
    expect(tree[0]!.label).toBe('Only Heading')
  })

  test('realistic MDX page with frontmatter and mixed content', () => {
    const mdast = parse(`---
title: API Reference
---

## Authentication

Set up your API keys.

### OAuth2

Use OAuth2 for server-side apps.

### API Keys

Use API keys for quick prototyping.

## Endpoints

### GET /users

Returns a list of users.

### POST /users

Creates a new user.

## Rate Limiting`)
    const tree = generateTocTree(mdast)
    expect(tree.length).toBe(3)
    expect(tree[0]!.label).toBe('Authentication')
    expect(tree[0]!.children.length).toBe(2)
    expect(tree[0]!.children[0]!.label).toBe('OAuth2')
    expect(tree[0]!.children[1]!.label).toBe('API Keys')
    expect(tree[1]!.label).toBe('Endpoints')
    expect(tree[1]!.children.length).toBe(2)
    expect(tree[2]!.label).toBe('Rate Limiting')
    expect(tree[2]!.children.length).toBe(0)
  })

  test('heading with inline formatting', () => {
    const mdast = parse(`## Install with **npm** or *yarn*`)
    const tree = generateTocTree(mdast)
    expect(tree[0]!.label).toBe('Install with npm or yarn')
  })
})

/* ── flattenTocTree ──────────────────────────────────────────────────── */

describe('flattenTocTree', () => {
  test('single page with headings produces correct flat list', () => {
    const roots: TocTreeNode[] = [
      {
        label: 'My Page',
        href: '/my-page',
        type: 'page',
        children: [
          {
            label: 'Introduction',
            href: '#introduction',
            type: 'h2',
            children: [
              {
                label: 'Prerequisites',
                href: '#prerequisites',
                type: 'h3',
                children: [],
              },
            ],
          },
          {
            label: 'Usage',
            href: '#usage',
            type: 'h2',
            children: [],
          },
        ],
      },
    ]
    const flat = flattenTocTree({ roots })
    expect(flat.map((f) => ({ label: f.label, type: f.type, visualLevel: f.visualLevel, pageHref: f.pageHref }))).toMatchInlineSnapshot(`
      [
        {
          "label": "My Page",
          "pageHref": "/my-page",
          "type": "page",
          "visualLevel": 0,
        },
        {
          "label": "Introduction",
          "pageHref": "/my-page",
          "type": "h2",
          "visualLevel": 1,
        },
        {
          "label": "Prerequisites",
          "pageHref": "/my-page",
          "type": "h3",
          "visualLevel": 2,
        },
        {
          "label": "Usage",
          "pageHref": "/my-page",
          "type": "h2",
          "visualLevel": 1,
        },
      ]
    `)
  })

  test('parentHref is set correctly for nested items', () => {
    const roots: TocTreeNode[] = [
      {
        label: 'Page',
        href: '/page',
        type: 'page',
        children: [
          {
            label: 'Section',
            href: '#section',
            type: 'h2',
            children: [
              {
                label: 'Sub',
                href: '#sub',
                type: 'h3',
                children: [],
              },
            ],
          },
        ],
      },
    ]
    const flat = flattenTocTree({ roots })
    expect(flat[0]!.parentHref).toBeNull()
    expect(flat[1]!.parentHref).toBe('/page')
    expect(flat[2]!.parentHref).toBe('#section')
  })

  test('visual levels clamp at 3', () => {
    const roots: TocTreeNode[] = [
      {
        label: 'P1',
        href: '/p1',
        type: 'page',
        children: [
          {
            label: 'P2',
            href: '/p2',
            type: 'page',
            children: [
              {
                label: 'P3',
                href: '/p3',
                type: 'page',
                children: [
                  {
                    label: 'P4',
                    href: '/p4',
                    type: 'page',
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]
    const flat = flattenTocTree({ roots })
    expect(flat.map((f) => f.visualLevel)).toMatchInlineSnapshot(`
      [
        0,
        1,
        2,
        3,
      ]
    `)
  })

  test('empty roots produces empty flat list', () => {
    expect(flattenTocTree({ roots: [] })).toMatchInlineSnapshot(`[]`)
  })

  test('multiple root pages as siblings', () => {
    const roots: TocTreeNode[] = [
      { label: 'Page A', href: '/a', type: 'page', children: [] },
      { label: 'Page B', href: '/b', type: 'page', children: [] },
    ]
    const flat = flattenTocTree({ roots })
    expect(flat.length).toBe(2)
    expect(flat[0]!.pageHref).toBe('/a')
    expect(flat[1]!.pageHref).toBe('/b')
  })

  test('prefixes include tree drawing characters', () => {
    const roots: TocTreeNode[] = [
      {
        label: 'Page',
        href: '/page',
        type: 'page',
        children: [
          {
            label: 'First',
            href: '#first',
            type: 'h2',
            children: [],
          },
          {
            label: 'Last',
            href: '#last',
            type: 'h2',
            children: [],
          },
        ],
      },
    ]
    const flat = flattenTocTree({ roots })
    expect(flat[0]!.prefix).toBe('')
    expect(flat[1]!.prefix).toBe('├─ ')
    expect(flat[2]!.prefix).toBe('└─ ')
  })

  test('generateTocTree → flattenTocTree end-to-end from MDX', () => {
    const mdast = parse(`## Getting Started

### Installation

### Configuration

## API Reference

### Methods`)
    const tree = generateTocTree(mdast)
    const flat = flattenTocTree({ roots: tree })
    expect(flat.map((f) => ({
      label: f.label,
      type: f.type,
      visualLevel: f.visualLevel,
      prefix: f.prefix,
    }))).toMatchInlineSnapshot(`
      [
        {
          "label": "Getting Started",
          "prefix": "",
          "type": "h2",
          "visualLevel": 0,
        },
        {
          "label": "Installation",
          "prefix": "├─ ",
          "type": "h3",
          "visualLevel": 1,
        },
        {
          "label": "Configuration",
          "prefix": "└─ ",
          "type": "h3",
          "visualLevel": 1,
        },
        {
          "label": "API Reference",
          "prefix": "",
          "type": "h2",
          "visualLevel": 0,
        },
        {
          "label": "Methods",
          "prefix": "└─ ",
          "type": "h3",
          "visualLevel": 1,
        },
      ]
    `)
  })
})
