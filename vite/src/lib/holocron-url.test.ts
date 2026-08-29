/** Verifies canonical Holocron request-path and hosted URL helpers. */

import { describe, expect, test } from 'vitest'
import { canonicalizePathname } from './holocron-url.ts'

describe('canonicalizePathname', () => {
  test.each([
    ['/passer-d%27un-plan', "/passer-d'un-plan"],
    ['/questions-%28compte%29', '/questions-(compte)'],
    ['/api%3Areference', '/api:reference'],
    ['/caf%C3%A9', '/café'],
    ['/cafe%CC%81', '/café'],
    ['/guide/', '/guide'],
    ['/', '/'],
    ['/double%2527encoded', '/double%27encoded'],
    ['/good%20path/bad%ZZ', '/good path/bad%ZZ'],
  ])('%s becomes %s', (input, expected) => {
    expect(canonicalizePathname(input)).toBe(expected)
  })
})
