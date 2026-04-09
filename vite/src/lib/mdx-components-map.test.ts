import { describe, expect, it } from 'vitest'

import { mdxComponents } from './mdx-components-map.tsx'

describe('mdxComponents', () => {
  it('does not override native heading tags', () => {
    const overriddenHeadingTags = Object.keys(mdxComponents).filter((key) => {
      return /^h[1-6]$/.test(key)
    })

    expect(overriddenHeadingTags).toMatchInlineSnapshot(`
      []
    `)
  })
})
