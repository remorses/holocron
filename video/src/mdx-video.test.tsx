/**
 * Tests for mdx-video: section splitting, frontmatter parsing,
 * background extraction, and JSX output via createMdxComposition.
 *
 * Uses inline snapshots so the rendered Remotion JSX structure
 * is visible directly in the test file for easy debugging.
 */

import React from 'react'
import { describe, expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { mdxParse } from 'safe-mdx/parse'
import { MdastToJsx } from 'safe-mdx'
import { splitIntoSections, calculateTotalDuration } from './mdx-parse'

// Helper: parse MDX and split into sections in one call
function split(mdx: string) {
  const ast = mdxParse(mdx)
  return splitIntoSections(ast)
}

// Helper: summarize sections for readable snapshots
function summarize(mdx: string) {
  const { globals, sections, frontmatter } = split(mdx)
  return {
    frontmatter,
    globalBackgrounds: globals.backgrounds.length,
    sections: sections.map((s) => ({
      heading: s.heading,
      durationInFrames: s.durationInFrames,
      nodes: s.nodes.length,
      backgrounds: s.backgrounds.length,
    })),
  }
}

describe('splitIntoSections', () => {
  test('basic sections with headings', () => {
    const result = summarize(`
# Intro

Hello world

# Middle

Some content

# End

Goodbye
    `)
    expect(result).toMatchInlineSnapshot(`
      {
        "frontmatter": {
          "bpm": 120,
          "fps": 30,
        },
        "globalBackgrounds": 0,
        "sections": [
          {
            "backgrounds": 0,
            "durationInFrames": 150,
            "heading": "Intro",
            "nodes": 1,
          },
          {
            "backgrounds": 0,
            "durationInFrames": 150,
            "heading": "Middle",
            "nodes": 1,
          },
          {
            "backgrounds": 0,
            "durationInFrames": 150,
            "heading": "End",
            "nodes": 1,
          },
        ],
      }
    `)
  })

  test('frontmatter parsing with yaml', () => {
    const result = summarize(`---
fps: 60
bpm: 140
---

# Scene
`)
    expect(result.frontmatter).toMatchInlineSnapshot(`
      {
        "bpm": 140,
        "fps": 60,
      }
    `)
  })

  test('duration in heading (seconds)', () => {
    const result = summarize(`
# Opening duration=3.3s

Content
    `)
    expect(result.sections[0].heading).toBe('Opening')
    expect(result.sections[0].durationInFrames).toBe(99) // 3.3 * 30fps
  })

  test('duration in heading (frames)', () => {
    const result = summarize(`
# Scene duration=200

Content
    `)
    expect(result.sections[0].durationInFrames).toBe(200)
  })

  test('duration in heading (beats)', () => {
    const result = summarize(`---
fps: 30
bpm: 120
---

# Scene duration=4beats

Content
    `)
    // 120bpm = 2 beats/sec, 1 beat = 15 frames, 4 beats = 60 frames
    expect(result.sections[0].durationInFrames).toBe(60)
  })

  test('global background before first heading', () => {
    const result = summarize(`
<Background>
<MeshGradientBg colors={['#6366f1']} />
</Background>

# Scene

Content
    `)
    expect(result.globalBackgrounds).toBe(1)
    expect(result.sections[0].backgrounds).toBe(0)
  })

  test('section-scoped background after heading', () => {
    const result = summarize(`
# Scene

<Background>
<MeshGradientBg colors={['#6366f1']} />
</Background>

Content
    `)
    expect(result.globalBackgrounds).toBe(0)
    expect(result.sections[0].backgrounds).toBe(1)
  })

  test('each section gets its own background', () => {
    const result = summarize(`
# Scene 1

<Background>
<Bg1 />
</Background>

Content 1

# Scene 2

<Background>
<Bg2 />
</Background>

Content 2
    `)
    expect(result.sections[0].backgrounds).toBe(1)
    expect(result.sections[1].backgrounds).toBe(1)
  })

  test('import statements are skipped (not treated as content)', () => {
    const result = summarize(`
import { Foo } from './foo'

# Scene

Content
    `)
    // Import should not create an implicit section before the heading
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].heading).toBe('Scene')
  })

  test('content before first heading creates implicit section', () => {
    const result = summarize(`
Some orphan content

# Scene

More content
    `)
    expect(result.sections).toHaveLength(2)
    expect(result.sections[0].heading).toBe(null)
    expect(result.sections[0].nodes).toBeGreaterThan(0)
  })
})

describe('calculateTotalDuration', () => {
  test('sums all section durations', () => {
    const { sections } = split(`
# A duration=100

x

# B duration=200

y

# C duration=50

z
    `)
    expect(calculateTotalDuration(sections)).toBe(350)
  })
})

describe('Background rendering', () => {
  test('background node has children preserved', () => {
    const mdx = `
# Scene

<Background>
<div style={{ background: 'red' }}>gradient</div>
</Background>

Content
`
    const ast = mdxParse(mdx)
    const result = splitIntoSections(ast)
    
    // The section should have 1 background node
    expect(result.sections[0].backgrounds).toHaveLength(1)
    
    // The background node should be a <Background> with children
    const bgNode = result.sections[0].backgrounds[0]
    expect(bgNode.name).toBe('Background')
    expect(bgNode.children.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Module resolution via safe-mdx MdastToJsx
// ---------------------------------------------------------------------------

describe('safe-mdx module resolution', () => {
  // Base components map (element overrides safe-mdx needs)
  const baseComponents = {
    p: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
    h1: ({ children }: { children?: React.ReactNode }) => <h1>{children}</h1>,
  }

  test('named import: component renders from modules', () => {
    function MyBadge({ label }: { label: string }) {
      return <span className="badge">{label}</span>
    }

    const code = `
import { MyBadge } from './components'

<MyBadge label="Hello" />
`
    const mdast = mdxParse(code)
    const visitor = new MdastToJsx({
      markdown: code,
      mdast,
      components: baseComponents,
      modules: {
        './components.tsx': { MyBadge },
      },
      baseUrl: './',
    })
    const result = visitor.run()
    const html = renderToStaticMarkup(result)
    expect(html).toMatchInlineSnapshot(`"<span class="badge">Hello</span>"`)
    expect(visitor.errors).toMatchInlineSnapshot(`[]`)
  })

  test('named import: data values available in expressions', () => {
    const ITEMS = ['apple', 'banana', 'cherry']

    const code = `
import { ITEMS } from './data'

There are {ITEMS.length} items.
`
    const mdast = mdxParse(code)
    const visitor = new MdastToJsx({
      markdown: code,
      mdast,
      components: baseComponents,
      modules: {
        './data.tsx': { ITEMS },
      },
      baseUrl: './',
      evaluateOptions: { functions: true },
    })
    const result = visitor.run()
    const html = renderToStaticMarkup(result)
    expect(html).toMatchInlineSnapshot(`"<p>There are 3 items.</p>"`)
    expect(visitor.errors).toMatchInlineSnapshot(`[]`)
  })

  test('named import: data passed as prop to component', () => {
    function ItemList({ items }: { items: string[] }) {
      return <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
    }
    const MY_DATA = ['one', 'two']

    const code = `
import { ItemList, MY_DATA } from './components'

<ItemList items={MY_DATA} />
`
    const mdast = mdxParse(code)
    const visitor = new MdastToJsx({
      markdown: code,
      mdast,
      components: baseComponents,
      modules: {
        './components.tsx': { ItemList, MY_DATA },
      },
      baseUrl: './',
    })
    const result = visitor.run()
    const html = renderToStaticMarkup(result)
    expect(html).toMatchInlineSnapshot(`"<ul><li>one</li><li>two</li></ul>"`)
    expect(visitor.errors).toMatchInlineSnapshot(`[]`)
  })

  test('unresolved import: produces error, does not crash', () => {
    const code = `
import { Missing } from './nonexistent'

<Missing />
`
    const mdast = mdxParse(code)
    const visitor = new MdastToJsx({
      markdown: code,
      mdast,
      components: baseComponents,
      modules: {},
      baseUrl: './',
    })
    const result = visitor.run()
    renderToStaticMarkup(result)
    expect(visitor.errors.length).toBeGreaterThan(0)
    expect(visitor.errors[0].message).toContain('Unresolved import')
  })

  test('multiple imports from different files', () => {
    function Card({ title }: { title: string }) {
      return <div className="card">{title}</div>
    }
    const CONFIG = { theme: 'dark' }

    const code = `
import { Card } from './ui'
import { CONFIG } from './config'

<Card title={CONFIG.theme} />
`
    const mdast = mdxParse(code)
    const visitor = new MdastToJsx({
      markdown: code,
      mdast,
      components: baseComponents,
      modules: {
        './ui.tsx': { Card },
        './config.tsx': { CONFIG },
      },
      baseUrl: './',
    })
    const result = visitor.run()
    const html = renderToStaticMarkup(result)
    expect(html).toMatchInlineSnapshot(`"<div class="card">dark</div>"`)
    expect(visitor.errors).toMatchInlineSnapshot(`[]`)
  })
})
