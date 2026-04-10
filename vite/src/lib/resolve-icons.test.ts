/**
 * Icon resolver tests for canonical icon ref strings.
 */

import { describe, expect, test, vi } from 'vitest'
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

  test('warns when a canonical ref resolves nowhere', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    resolveIconSvgs(['lucide:definitely-missing-icon'])

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      '[holocron] lucide icon "definitely-missing-icon" not found. Check the icon name at https://lucide.dev/icons/.',
    )
    warn.mockRestore()
  })
})
