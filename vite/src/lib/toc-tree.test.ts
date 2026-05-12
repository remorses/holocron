import { describe, test, expect } from 'vitest'
import {
  slugify,
  extractText,
  generateTocTree,
} from './toc-tree.ts'
import { mdxParse } from 'safe-mdx/parse'
import type { PhrasingContent } from 'mdast'

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
    expect(extractText(children)).toBe('Use npm install')
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
    const mdast = mdxParse(`## First

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
    const mdast = mdxParse(`## Parent

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
    const mdast = mdxParse(`## Section

### Subsection

#### Detail`)
    const tree = generateTocTree(mdast)
    expect(tree.length).toBe(1)
    expect(tree[0]!.children.length).toBe(1)
    expect(tree[0]!.children[0]!.children.length).toBe(1)
    expect(tree[0]!.children[0]!.children[0]!.label).toBe('Detail')
  })

  test('skipped level: h2 → h4 (h4 still nests under h2)', () => {
    const mdast = mdxParse(`## Top

#### Skipped to h4`)
    const tree = generateTocTree(mdast)
    expect(tree.length).toBe(1)
    expect(tree[0]!.children.length).toBe(1)
    expect(tree[0]!.children[0]!.label).toBe('Skipped to h4')
    expect(tree[0]!.children[0]!.type).toBe('h4')
  })

  test('new h2 after nested children resets depth', () => {
    const mdast = mdxParse(`## First

### Nested

## Second`)
    const tree = generateTocTree(mdast)
    expect(tree.length).toBe(2)
    expect(tree[0]!.children.length).toBe(1)
    expect(tree[1]!.children.length).toBe(0)
    expect(tree[1]!.label).toBe('Second')
  })

  test('empty document produces empty tree', () => {
    const mdast = mdxParse(`Just plain text, no headings at all.`)
    expect(generateTocTree(mdast)).toMatchInlineSnapshot(`[]`)
  })

  test('non-heading nodes are ignored', () => {
    const mdast = mdxParse(`Some paragraph text.

## Only Heading

More paragraph text.`)
    const tree = generateTocTree(mdast)
    expect(tree.length).toBe(1)
    expect(tree[0]!.label).toBe('Only Heading')
  })

  test('realistic MDX page with frontmatter and mixed content', () => {
    const mdast = mdxParse(`---
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
    const mdast = mdxParse(`## Install with **npm** or *yarn*`)
    const tree = generateTocTree(mdast)
    expect(tree[0]!.label).toBe('Install with npm or yarn')
  })
})

