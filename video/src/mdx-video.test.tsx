/**
 * Tests for mdx-video: section splitting, frontmatter parsing,
 * background extraction, and JSX output via createMdxComposition.
 *
 * Uses inline snapshots so the rendered Remotion JSX structure
 * is visible directly in the test file for easy debugging.
 */

import { describe, expect, test } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { mdxParse } from 'safe-mdx/parse'
import { splitIntoSections, calculateTotalDuration } from './mdx-video'

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
