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
          },
          {
            "durationInFrames": 150,
            "heading": "Middle",
            "nodes": 1,
          },
          {
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

  test('background before first heading creates implicit section', () => {
    const result = summarize(`
<Background>
<MeshGradientBg colors={['#6366f1']} />
</Background>

# Scene

Content
    `)
    // Background is now a regular node, creates an implicit first section
    expect(result.sections).toHaveLength(2)
    expect(result.sections[0].heading).toBe(null)
    expect(result.sections[0].nodes).toBe(1) // the <Background> node
    expect(result.sections[1].heading).toBe('Scene')
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
