/**
 * Regression tests for site-level font head tags that affect privacy and performance.
 */

import { describe, expect, test } from 'vitest'
import { normalize } from './normalize-config.ts'
import { buildFontHeadState } from './site-head.tsx'

describe('SiteHead fonts', () => {
  test('does not emit third-party font links for the default font stack', () => {
    const state = buildFontHeadState(normalize({ name: 'Docs' }))

    expect(state.stylesheetLinks).toMatchInlineSnapshot(`[]`)
    expect(state.preconnectGoogle).toBe(false)
  })

  test('preconnects to Google only when custom Google font links are emitted', () => {
    const state = buildFontHeadState(normalize({ name: 'Docs', fonts: { family: 'Inter' } }))

    expect(state.preconnectGoogle).toBe(true)
    expect(state.stylesheetLinks).toMatchInlineSnapshot(`
      [
        "https://fonts.googleapis.com/css2?family=Inter&display=swap",
      ]
    `)
  })
})
