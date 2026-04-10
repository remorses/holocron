/**
 * Icon ref normalization tests for configured-library and prefixed-string behavior.
 */

import { describe, expect, test } from 'vitest'
import { iconToRefs, stringIconToRefs } from './collect-icons.ts'

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
})

describe('iconToRefs', () => {
  test('uses the configured project library for object icons without a library', () => {
    expect(iconToRefs({ name: 'book' }, { defaultLibrary: 'lucide' })).toEqual(['lucide:book'])
    expect(iconToRefs({ name: 'book' }, { defaultLibrary: 'fontawesome' })).toEqual(['fontawesome:book'])
  })
})
