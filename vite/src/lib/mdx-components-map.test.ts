import { describe, expect, it } from 'vitest'

import { mdxComponents } from './mdx-components-map.tsx'
import { formatMdxError } from './logger.ts'

describe('mdxComponents', () => {
  it('does not override native heading tags', () => {
    const overriddenHeadingTags = Object.keys(mdxComponents).filter((key) => {
      return /^h[1-6]$/.test(key)
    })

    expect(overriddenHeadingTags).toMatchInlineSnapshot(`
      []
    `)
  })

  it('overrides native table tags for editorial styling', () => {
    const overriddenTableTags = Object.keys(mdxComponents).filter((key) => {
      return ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption'].includes(key)
    })

    expect(overriddenTableTags).toMatchInlineSnapshot(`
      [
        "table",
        "thead",
        "tbody",
        "tfoot",
        "tr",
        "th",
        "td",
        "caption",
      ]
    `)
  })
})

describe('formatMdxError', () => {
  it('formats missing components as a concise terminal line', () => {
    const formatted = formatMdxError(
      { type: 'missing-component', line: 34, message: 'Unsupported jsx component Caption' },
      '/components',
    )

    expect(formatted.replace(/\x1b\[[0-9;]*m/g, '')).toMatchInlineSnapshot(`
      "▲ holocron MDX /components:34 Unsupported jsx component Caption"
    `)
  })
})
