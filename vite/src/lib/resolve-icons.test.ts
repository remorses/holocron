/**
 * Icon resolver tests for ambiguous string icon fallback behavior.
 */

import { describe, expect, test, vi } from 'vitest'
import { resolveIconSvgs } from './resolve-icons.ts'

describe('resolveIconSvgs', () => {
  test('does not warn when an ambiguous string icon resolves via fontawesome fallback', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const atlas = resolveIconSvgs([
      { library: 'lucide', name: 'discord' },
      { library: 'fontawesome', name: 'discord' },
    ])

    expect(atlas.icons['fontawesome:discord']).toBeDefined()
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  test('warns once when an ambiguous string icon resolves nowhere', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    resolveIconSvgs([
      { library: 'lucide', name: 'definitely-missing-icon' },
      { library: 'fontawesome', name: 'definitely-missing-icon' },
    ])

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('[holocron] icon "definitely-missing-icon" was not found in lucide or fontawesome.')
    warn.mockRestore()
  })
})
