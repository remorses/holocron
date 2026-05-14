import { describe, expect, it } from 'vitest'

import { mdxComponents } from './mdx-components-map.tsx'
import { buildCodeFrame, formatMdxError, HolocronMdxParseError } from './logger.ts'

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

describe('buildCodeFrame', () => {
  it('shows context lines around the error with a caret', () => {
    const source = [
      'line 1',
      'line 2',
      'line 3',
      'line 4 has an <error',
      'line 5',
      'line 6',
      'line 7',
    ].join('\n')

    const frame = buildCodeFrame(source, 4, 15)
    // Strip ANSI codes for snapshot
    const clean = frame.replace(/\x1b\[[0-9;]*m/g, '')
    expect(clean).toMatchInlineSnapshot(`
      "  1 | line 1
        2 | line 2
        3 | line 3
      > 4 | line 4 has an <error
                          ^
        5 | line 5
        6 | line 6
        7 | line 7"
    `)
  })

  it('handles error on first line', () => {
    const source = 'bad syntax here\nline 2\nline 3'
    const frame = buildCodeFrame(source, 1, 5)
    const clean = frame.replace(/\x1b\[[0-9;]*m/g, '')
    expect(clean).toMatchInlineSnapshot(`
      "> 1 | bad syntax here
                ^
        2 | line 2
        3 | line 3"
    `)
  })
})

describe('HolocronMdxParseError', () => {
  it('includes source, line, reason, and code frame in message', () => {
    const err = new HolocronMdxParseError({
      reason: 'Unexpected character',
      line: 3,
      column: 5,
      source: '/getting-started',
      mdxSource: 'line 1\nline 2\nline 3 {bad\nline 4',
    })
    expect(err.name).toBe('HolocronMdxParseError')
    expect(err.line).toBe(3)
    expect(err.column).toBe(5)
    expect(err.reason).toBe('Unexpected character')
    expect(err.source).toBe('/getting-started')
    expect(err.message).toContain('/getting-started:3:5')
    expect(err.message).toContain('Unexpected character')
    expect(err.codeFrame).toContain('line 3 {bad')
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
