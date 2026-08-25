/**
 * Icon resolver tests for canonical icon ref strings.
 */

import { describe, expect, test } from 'vitest'
import { resolveIconSvgs } from './resolve-icons.ts'

describe('resolveIconSvgs', () => {
  test('resolves canonical lucide and fontawesome refs', () => {
    const result = resolveIconSvgs([
      'lucide:github',
      'fontawesome:brands:discord',
    ])

    expect(result.atlas.icons['lucide:github']).toBeDefined()
    expect(result.atlas.icons['fontawesome:brands:discord']).toBeDefined()
    expect(result.unresolvedCount).toBe(0)
    expect(result.unresolvedRefs).toEqual([])
  })

  test('reports unresolved icon refs', () => {
    const result = resolveIconSvgs([
      'lucide:github',
      'lucide:nonexistent-icon-xyz',
      'fontawesome:brands:nonexistent-icon-abc',
      'invalid-ref',
    ])

    expect(result.atlas.icons['lucide:github']).toBeDefined()
    expect(result.unresolvedCount).toBe(3)
    expect(result.unresolvedRefs).toEqual([
      'lucide:nonexistent-icon-xyz',
      'fontawesome:brands:nonexistent-icon-abc',
      'invalid-ref',
    ])
  })
})
