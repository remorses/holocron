/**
 * Icon ref normalization tests for configured-library and prefixed-string behavior.
 */

import { describe, expect, test } from 'vitest'
import { collectLocalIconPaths, iconToRefs, isEmoji, stringIconToRefs } from './collect-icons.ts'
import { normalize } from './normalize-config.ts'

describe('stringIconToRefs', () => {
  test('uses the configured project library for plain strings', () => {
    expect(stringIconToRefs('rocket', { defaultLibrary: 'lucide' })).toEqual(['lucide:rocket'])
    expect(stringIconToRefs('rocket', { defaultLibrary: 'fontawesome' })).toEqual(['fontawesome:rocket'])
  })

  test('uses iconType only for fontawesome projects', () => {
    expect(stringIconToRefs('discord', { defaultLibrary: 'fontawesome', iconType: 'brands' })).toEqual(['fontawesome:brands:discord'])
    expect(stringIconToRefs('rocket', { defaultLibrary: 'lucide', iconType: 'brands' })).toEqual(['lucide:rocket'])
  })

  test('preserves explicit library-prefixed strings', () => {
    expect(stringIconToRefs('lucide:rocket', { defaultLibrary: 'fontawesome' })).toEqual(['lucide:rocket'])
    expect(stringIconToRefs('fontawesome:brands:discord', { defaultLibrary: 'lucide' })).toEqual(['fontawesome:brands:discord'])
  })

  test('skips URL and root-absolute path icons', () => {
    expect(stringIconToRefs('https://cdn.example.com/rocket.svg', { defaultLibrary: 'lucide' })).toEqual([])
    expect(stringIconToRefs('http://cdn.example.com/rocket.svg', { defaultLibrary: 'lucide' })).toEqual([])
    expect(stringIconToRefs('/icons/rocket.svg', { defaultLibrary: 'fontawesome' })).toEqual([])
  })

  test('keeps ZWJ emoji with skin-tone modifiers out of the icon atlas', () => {
    expect(isEmoji('👩🏽‍💻')).toBe(true)
    expect(stringIconToRefs('👩🏽‍💻', { defaultLibrary: 'lucide' })).toEqual([])
  })
})

describe('iconToRefs', () => {
  test('uses the configured project library for object icons without a library', () => {
    expect(iconToRefs({ name: 'book' }, { defaultLibrary: 'lucide' })).toEqual(['lucide:book'])
    expect(iconToRefs({ name: 'book' }, { defaultLibrary: 'fontawesome' })).toEqual(['fontawesome:book'])
  })
})

describe('collectLocalIconPaths', () => {
  test('collects root-relative icon values without treating other paths as icons', () => {
    const config = normalize({
      name: 'Docs',
      navbar: { links: [{ label: 'Home', href: '/not-an-icon.svg', icon: '/icons/root.svg' }] },
      navigation: { groups: [{ group: 'Guide', icon: '/icons/group.svg', pages: ['index'] }] },
    })
    expect(collectLocalIconPaths({ config, navigation: [] })).toEqual(['/icons/root.svg', '/icons/group.svg'])
  })
})
