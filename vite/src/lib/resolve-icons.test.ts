/**
 * Icon resolver tests for canonical icon ref strings.
 */

import { describe, expect, test } from 'vitest'
import { resolveIconSvgs } from './resolve-icons.ts'

describe('resolveIconSvgs', () => {
  test('resolves canonical lucide and fontawesome refs', () => {
    const atlas = resolveIconSvgs([
      'lucide:github',
      'fontawesome:brands:discord',
    ])

    expect(atlas.icons['lucide:github']).toBeDefined()
    expect(atlas.icons['fontawesome:brands:discord']).toBeDefined()
  })
})
