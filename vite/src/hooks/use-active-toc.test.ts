/**
 * Active TOC heading selection. The reading line is scroll-margin-top
 * (sticky header), not a magic pixel offset.
 */

import { describe, expect, test } from 'vitest'
import { pickActiveHeadingId } from './use-active-toc.ts'

describe('pickActiveHeadingId', () => {
  test('keeps the heading parked on the sticky header line', () => {
    // Live subrouter.org hash scroll: previous h3 is at 9px, current h2 is at
    // 144.1px, scroll-margin-top is 144px. A 50px offset wrongly picks Presets.
    expect(pickActiveHeadingId({
      headings: [
        { id: 'presets', top: 9 },
        { id: 'difference-from-openrouter-and-api-proxies', top: 144.1 },
        { id: 'supported-subscriptions', top: 1377 },
      ],
      fallbackId: 'quick-start',
      offset: 145,
    })).toMatchInlineSnapshot(`"difference-from-openrouter-and-api-proxies"`)
  })

  test('stays on the previous heading until the next one reaches the line', () => {
    expect(pickActiveHeadingId({
      headings: [
        { id: 'presets', top: 9 },
        { id: 'difference-from-openrouter-and-api-proxies', top: 200 },
      ],
      fallbackId: 'quick-start',
      offset: 145,
    })).toMatchInlineSnapshot(`"presets"`)
  })

  test('falls back when nothing has reached the line yet', () => {
    expect(pickActiveHeadingId({
      headings: [
        { id: 'quick-start', top: 400 },
        { id: 'how-it-works', top: 800 },
      ],
      fallbackId: 'quick-start',
      offset: 145,
    })).toMatchInlineSnapshot(`"quick-start"`)
  })
})
