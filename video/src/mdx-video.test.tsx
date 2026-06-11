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
import { SafeMdxRenderer } from 'safe-mdx'
import { mdxParse, extractImports, resolveModulePath } from 'safe-mdx/parse'
import type { EagerModules } from 'safe-mdx/parse'
import { MdastToJsx } from 'safe-mdx'
import { splitIntoSections, calculateTotalDuration } from './mdx-parse'

// Helper: parse MDX and split into sections in one call
function split(mdx: string) {
  const ast = mdxParse(mdx)
  return splitIntoSections(ast)
}

// Helper: summarize sections for readable snapshots
function summarize(mdx: string) {
  const { sections, frontmatter } = split(mdx)
  return {
    frontmatter,
    sections: sections.map((s) => ({
      heading: s.heading,
      durationInFrames: s.durationInFrames,
      transitionFrames: s.transitionFrames,
      nodes: s.nodes.length,
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
        "sections": [
          {
            "durationInFrames": 150,
            "heading": "Intro",
            "nodes": 1,
            "transitionFrames": 0,
          },
          {
            "durationInFrames": 150,
            "heading": "Middle",
            "nodes": 1,
            "transitionFrames": 0,
          },
          {
            "durationInFrames": 150,
            "heading": "End",
            "nodes": 1,
            "transitionFrames": 0,
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

  test('background before first heading goes to preamble, not a section', () => {
    const result = split(`
<Background>
<MeshGradientBg colors={['#6366f1']} />
</Background>

# Scene

Content
    `)
    // Content before the first heading goes to preamble, not an implicit section
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].heading).toBe('Scene')
    expect(result.preamble.length).toBeGreaterThan(0)
  })

  test('background after heading is a regular content node', () => {
    const result = summarize(`
# Scene

<Background>
<MeshGradientBg colors={['#6366f1']} />
</Background>

Content
    `)
    // Background is included in section.nodes alongside content
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].nodes).toBe(2) // Background + Content paragraph
  })

  test('each section keeps its own background nodes', () => {
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
    expect(result.sections[0].nodes).toBe(2) // Background + Content
    expect(result.sections[1].nodes).toBe(2) // Background + Content
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

  test('transition in heading (frames)', () => {
    const result = summarize(`
# Scene 1 duration=5s transition=20

Content

# Scene 2 duration=3s

More content
    `)
    expect(result.sections[0].heading).toBe('Scene 1')
    expect(result.sections[0].durationInFrames).toBe(150) // 5s * 30fps
    expect(result.sections[0].transitionFrames).toBe(20)
    expect(result.sections[1].transitionFrames).toBe(0)
  })

  test('transition in heading (seconds)', () => {
    const result = summarize(`
# Intro duration=3s transition=0.5s

Content

# Outro duration=3s

More
    `)
    expect(result.sections[0].transitionFrames).toBe(15) // 0.5s * 30fps
  })

  test('calculateTotalDuration subtracts transition overlaps', () => {
    const { sections } = split(`
# A duration=100 transition=20

x

# B duration=200

y
    `)
    // 100 + 200 - 20 = 280
    expect(calculateTotalDuration(sections)).toBe(280)
  })

  test('content before first heading goes to preamble', () => {
    const result = split(`
Some orphan content

# Scene

More content
    `)
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].heading).toBe('Scene')
    expect(result.preamble.length).toBeGreaterThan(0)
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
  test('background node preserved in section nodes with children', () => {
    const mdx = `
# Scene

<Background>
<div style={{ background: 'red' }}>gradient</div>
</Background>

Content
`
    const ast = mdxParse(mdx)
    const result = splitIntoSections(ast)

    // Background is a regular node in section.nodes
    const bgNode = result.sections[0].nodes.find((n: any) => n.name === 'Background')
    expect(bgNode).toBeDefined()
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

// ---------------------------------------------------------------------------
// keyframes() — animation interpolation
// ---------------------------------------------------------------------------

import { keyframes, fromLottieProperty, extractLottieDimensionEasing } from './mdx-video'

describe('keyframes', () => {
  test('single keyframe returns its value', () => {
    expect(keyframes(0, [{ time: 0, value: 42 }])).toBe(42)
    expect(keyframes(100, [{ time: 0, value: 42 }])).toBe(42)
  })

  test('linear interpolation between two keyframes', () => {
    const kfs = [
      { time: 0, value: 0 },
      { time: 100, value: 100 },
    ] as const
    expect(keyframes(0, [...kfs])).toBe(0)
    expect(keyframes(50, [...kfs])).toBe(50)
    expect(keyframes(100, [...kfs])).toBe(100)
  })

  test('clamps outside keyframe range', () => {
    const kfs = [
      { time: 10, value: 0 },
      { time: 20, value: 100 },
    ]
    expect(keyframes(0, kfs)).toBe(0)
    expect(keyframes(30, kfs)).toBe(100)
  })

  test('bezier easing changes interpolation curve', () => {
    const linear = [
      { time: 0, value: 0 },
      { time: 100, value: 100 },
    ]
    const eased = [
      { time: 0, value: 0, easing: [0.8, 0, 1, 1] as [number, number, number, number] },
      { time: 100, value: 100 },
    ]
    const linearMid = keyframes(50, linear)
    const easedMid = keyframes(50, eased)
    // Strong ease-in at midpoint should be well below linear
    expect(linearMid).toBe(50)
    expect(easedMid).toBeLessThan(40)
    // But endpoints should be the same
    expect(keyframes(0, eased)).toBe(0)
    expect(keyframes(100, eased)).toBe(100)
  })

  test('overshoot with y > 1', () => {
    const kfs = [
      { time: 0, value: 0, easing: [0.34, 1.56, 0.64, 1] as [number, number, number, number] },
      { time: 100, value: 100 },
    ]
    // With overshoot easing, some intermediate frame should exceed 100
    const values = Array.from({ length: 101 }, (_, i) => keyframes(i, kfs))
    const max = Math.max(...values)
    expect(max).toBeGreaterThan(100)
    // Endpoints should still be correct
    expect(values[0]).toBe(0)
    expect(values[100]).toBe(100)
  })

  test('hold keyframe (step function)', () => {
    const kfs = [
      { time: 0, value: 0, hold: true },
      { time: 30, value: 100 },
      { time: 60, value: 200 },
    ]
    expect(keyframes(0, kfs)).toBe(0)
    expect(keyframes(15, kfs)).toBe(0)
    expect(keyframes(29, kfs)).toBe(0)
    expect(keyframes(30, kfs)).toBe(100)
    expect(keyframes(45, kfs)).toBe(150)
  })

  test('multi-keyframe sequence', () => {
    const kfs = [
      { time: 0, value: 0 },
      { time: 50, value: 100 },
      { time: 100, value: 0 },
    ]
    expect(keyframes(0, kfs)).toBe(0)
    expect(keyframes(25, kfs)).toBe(50)
    expect(keyframes(50, kfs)).toBe(100)
    expect(keyframes(75, kfs)).toBe(50)
    expect(keyframes(100, kfs)).toBe(0)
  })

  test('per-segment easing in multi-keyframe', () => {
    const linear = [
      { time: 0, value: 0 },
      { time: 50, value: 100 },
      { time: 100, value: 0 },
    ]
    const eased = [
      { time: 0, value: 0, easing: [0.8, 0, 1, 1] as [number, number, number, number] },
      { time: 50, value: 100, easing: [0.8, 0, 1, 1] as [number, number, number, number] },
      { time: 100, value: 0 },
    ]
    // Midpoints of each segment: linear gives 50, strong ease-in gives much less
    expect(keyframes(25, linear)).toBe(50)
    expect(keyframes(25, eased)).toBeLessThan(40)
  })

  test('vector keyframes return arrays', () => {
    const kfs = [
      { time: 0, value: [0, 0] },
      { time: 100, value: [200, 400] },
    ]
    const result = keyframes(50, kfs)
    expect(result).toEqual([100, 200])
  })

  test('vector keyframes clamp at boundaries', () => {
    const kfs = [
      { time: 10, value: [0, 100] },
      { time: 20, value: [50, 200] },
    ]
    expect(keyframes(0, kfs)).toEqual([0, 100])
    expect(keyframes(30, kfs)).toEqual([50, 200])
  })

  test('vector hold keyframe', () => {
    const kfs = [
      { time: 0, value: [10, 20], hold: true },
      { time: 30, value: [100, 200] },
    ]
    expect(keyframes(0, kfs)).toEqual([10, 20])
    expect(keyframes(15, kfs)).toEqual([10, 20])
    expect(keyframes(30, kfs)).toEqual([100, 200])
  })

  test('dimensionEasing overrides per-dimension', () => {
    const kfs = [
      { time: 0, value: [0, 0], easing: [0, 0, 1, 1] as [number, number, number, number] },
      { time: 100, value: [100, 100] },
    ]
    // Without dimension easing, both dimensions are linear
    const linear = keyframes(50, kfs) as number[]
    expect(linear[0]).toBeCloseTo(50, 0)
    expect(linear[1]).toBeCloseTo(50, 0)

    // With dimension easing overriding dim 1 with strong ease-in
    const withDimEasing = keyframes(50, kfs, {
      dimensionEasing: [undefined, [0.8, 0, 1, 1]],
    }) as number[]
    // Dim 0 stays linear (uses keyframe easing which is linear)
    expect(withDimEasing[0]).toBeCloseTo(50, 0)
    // Dim 1 uses strong ease-in, should be well below 50
    expect(withDimEasing[1]).toBeLessThan(40)
  })

  test('empty keyframes throws', () => {
    expect(() => keyframes(0, [])).toThrow('at least one keyframe')
  })
})

describe('fromLottieProperty', () => {
  test('static scalar property', () => {
    const result = fromLottieProperty({ a: 0, k: 50 })
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "time": 0,
          "value": 50,
        },
      ]
    `)
  })

  test('static vector property', () => {
    const result = fromLottieProperty({ a: 0, k: [100, 200] })
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "time": 0,
          "value": [
            100,
            200,
          ],
        },
      ]
    `)
  })

  test('animated scalar property', () => {
    const result = fromLottieProperty({
      a: 1,
      k: [
        { t: 0, s: [0], o: { x: [0.333], y: [0] }, i: { x: [0.667], y: [1] } },
        { t: 30, s: [100] },
      ],
    })
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "easing": [
            0.333,
            0,
            0.667,
            1,
          ],
          "time": 0,
          "value": 0,
        },
        {
          "time": 30,
          "value": 100,
        },
      ]
    `)
  })

  test('animated scalar with hold', () => {
    const result = fromLottieProperty({
      a: 1,
      k: [
        { t: 0, s: [50], h: 1 },
        { t: 30, s: [100] },
      ],
    })
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "hold": true,
          "time": 0,
          "value": 50,
        },
        {
          "time": 30,
          "value": 100,
        },
      ]
    `)
  })

  test('animated vector property', () => {
    const result = fromLottieProperty({
      a: 1,
      k: [
        { t: 0, s: [100, 200], o: { x: [0.5, 0.3], y: [0, 0.2] }, i: { x: [0.5, 0.7], y: [1, 0.8] } },
        { t: 60, s: [500, 400] },
      ],
    })
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "easing": [
            0.5,
            0,
            0.5,
            1,
          ],
          "time": 0,
          "value": [
            100,
            200,
          ],
        },
        {
          "time": 60,
          "value": [
            500,
            400,
          ],
        },
      ]
    `)
  })

  test('roundtrip: fromLottieProperty -> keyframes produces correct values', () => {
    const kfs = fromLottieProperty({
      a: 1,
      k: [
        { t: 0, s: [0], o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
        { t: 100, s: [200] },
      ],
    }) as any
    // Linear easing (o={0,0} i={1,1}), so midpoint should be 100
    expect(keyframes(50, kfs)).toBe(100)
    expect(keyframes(0, kfs)).toBe(0)
    expect(keyframes(100, kfs)).toBe(200)
  })
})

describe('extractLottieDimensionEasing', () => {
  test('returns undefined for scalar properties', () => {
    const result = extractLottieDimensionEasing(
      { a: 1, k: [{ t: 0, s: [0], o: { x: [0.5], y: [0] }, i: { x: [0.5], y: [1] } }, { t: 30, s: [100] }] },
      0,
    )
    expect(result).toBeUndefined()
  })

  test('returns per-dimension curves for vector properties', () => {
    const result = extractLottieDimensionEasing(
      {
        a: 1,
        k: [
          { t: 0, s: [0, 0], o: { x: [0.3, 0.5], y: [0, 0.2] }, i: { x: [0.7, 0.8], y: [1, 0.9] } },
          { t: 30, s: [100, 200] },
        ],
      },
      0,
    )
    expect(result).toMatchInlineSnapshot(`
      [
        [
          0.3,
          0,
          0.7,
          1,
        ],
        [
          0.5,
          0.2,
          0.8,
          0.9,
        ],
      ]
    `)
  })

  test('returns undefined for static properties', () => {
    expect(extractLottieDimensionEasing({ a: 0, k: [100, 200] }, 0)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// MDX file imports — React composition approach
// ---------------------------------------------------------------------------

describe('MDX file imports', () => {
  const baseComponents: Record<string, any> = {
    p: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
    h1: ({ children }: { children?: React.ReactNode }) => <h1>{children}</h1>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong>{children}</strong>,
  }

  /** Simulates the rendering pipeline from app.tsx: detect .mdx imports in the
   *  main MDX, render each one into a component, then merge into the modules map. */
  function renderWithMdxImports(mainCode: string, modules: EagerModules) {
    const ast = mdxParse(mainCode)
    const moduleKeys = Object.keys(modules)
    const merged: EagerModules = { ...modules }

    const imports = extractImports(ast)
    for (const imp of imports) {
      if (!/\.mdx?$/.test(imp.source)) continue
      const key = resolveModulePath(imp.source, './', moduleKeys)
      if (!key || !merged[key]) continue
      const rawContent = merged[key].default
      if (typeof rawContent !== 'string') continue
      const importedAst = mdxParse(rawContent)
      const renderedJsx = (
        <SafeMdxRenderer
          markdown={rawContent}
          mdast={importedAst}
          components={baseComponents}
          modules={merged}

          baseUrl="./"
        />
      )
      merged[key] = { default: () => renderedJsx }
    }

    const visitor = new MdastToJsx({
      markdown: mainCode,
      mdast: ast,
      components: baseComponents,
      modules: merged,
      baseUrl: './',
    })
    return { jsx: visitor.run(), errors: visitor.errors }
  }

  test('imported .mdx renders as React component', () => {
    const mainCode = `
import Intro from './intro.mdx'

<Intro />
`
    const modules: EagerModules = {
      './intro.mdx': { default: 'Hello from **imported** MDX' },
    }

    const { jsx, errors } = renderWithMdxImports(mainCode, modules)
    const html = renderToStaticMarkup(jsx)
    expect(html).toMatchInlineSnapshot(
      `"<p>Hello from <strong>imported</strong> MDX</p>"`,
    )
    expect(errors).toMatchInlineSnapshot(`[]`)
  })

  test('imported .mdx can use .tsx components from the same modules map', () => {
    function Badge({ label }: { label: string }) {
      return <span className="badge">{label}</span>
    }

    const mainCode = `
import Snippet from './snippet.mdx'

<Snippet />
`
    const snippetContent = `
import { Badge } from './ui'

<Badge label="new" />
`
    const modules: EagerModules = {
      './snippet.mdx': { default: snippetContent },
      './ui.tsx': { Badge },
    }

    const { jsx, errors } = renderWithMdxImports(mainCode, modules)
    const html = renderToStaticMarkup(jsx)
    expect(html).toMatchInlineSnapshot(
      `"<span class="badge">new</span>"`,
    )
    expect(errors).toMatchInlineSnapshot(`[]`)
  })

  test('unresolved .mdx import produces error gracefully', () => {
    const mainCode = `
import Missing from './missing.mdx'

<Missing />
`
    const { jsx, errors } = renderWithMdxImports(mainCode, {})
    renderToStaticMarkup(jsx)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toContain('Unresolved import')
  })

  test('imported .mdx with multiple elements', () => {
    const mainCode = `
import Content from './content.mdx'

<Content />
`
    const modules: EagerModules = {
      './content.mdx': {
        default: `First paragraph

Second paragraph with **bold**`,
      },
    }

    const { jsx, errors } = renderWithMdxImports(mainCode, modules)
    const html = renderToStaticMarkup(jsx)
    expect(html).toMatchInlineSnapshot(
      `"<p>First paragraph</p><p>Second paragraph with <strong>bold</strong></p>"`,
    )
    expect(errors).toMatchInlineSnapshot(`[]`)
  })

  test('main MDX can mix .mdx imports with .tsx imports', () => {
    function Card({ title, children }: { title: string; children?: React.ReactNode }) {
      return <div className="card"><h2>{title}</h2>{children}</div>
    }

    const mainCode = `
import { Card } from './ui'
import Snippet from './snippet.mdx'

<Card title="Welcome">
  <Snippet />
</Card>
`
    const modules: EagerModules = {
      './ui.tsx': { Card },
      './snippet.mdx': { default: 'Snippet **content**' },
    }

    const { jsx, errors } = renderWithMdxImports(mainCode, modules)
    const html = renderToStaticMarkup(jsx)
    expect(html).toMatchInlineSnapshot(
      `"<div class="card"><h2>Welcome</h2><p>Snippet <strong>content</strong></p></div>"`,
    )
    expect(errors).toMatchInlineSnapshot(`[]`)
  })
})
