import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatMdxError, logMdxError, mdxComponents } from './mdx-components-map.tsx'

afterEach(() => {
  vi.restoreAllMocks()
})

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
  it('formats missing components as a readable terminal block', () => {
    const formatted = formatMdxError(
      { type: 'missing-component', line: 34, message: 'Unsupported jsx component Caption' },
      '/components',
    )

    expect(formatted.replace(/\x1b\[[0-9;]*m/g, '')).toMatchInlineSnapshot(`
      "▲ holocron MDX missing component
        source /components
        line 34
        reason Unsupported JSX component Caption
        fix register the component or import it from this MDX file"
    `)
  })
})

describe('logMdxError', () => {
  it('does not throw when stderr logging fails', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {
      throw new Error('EPIPE')
    })

    expect(() => logMdxError({ type: 'missing-component', line: 34, message: 'Unsupported jsx component Caption' })).not.toThrow()
  })
})
