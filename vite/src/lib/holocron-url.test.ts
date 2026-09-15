/** Verifies canonical Holocron request-path and hosted URL helpers. */

import { describe, expect, it, test } from 'vitest'
import { canonicalizePathname, getHolocronBaseUrl, holocronUrl } from './holocron-url.ts'

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

describe('holocronUrl', () => {
  it('defaults to holocron.so', () => {
    const previous = process.env.HOLOCRON_URL
    delete process.env.HOLOCRON_URL
    try {
      expect(getHolocronBaseUrl()).toMatchInlineSnapshot(`"https://holocron.so"`)
      expect(holocronUrl('/api/og')).toMatchInlineSnapshot(`"https://holocron.so/api/og"`)
    } finally {
      if (previous === undefined) delete process.env.HOLOCRON_URL
      else process.env.HOLOCRON_URL = previous
    }
  })

  it('uses HOLOCRON_URL without duplicating slashes', () => {
    const previous = process.env.HOLOCRON_URL
    process.env.HOLOCRON_URL = 'https://custom.example.com/'
    try {
      expect(getHolocronBaseUrl()).toMatchInlineSnapshot(`"https://custom.example.com"`)
      expect(holocronUrl('/api/og?title=Hello')).toMatchInlineSnapshot(`"https://custom.example.com/api/og?title=Hello"`)
    } finally {
      if (previous === undefined) delete process.env.HOLOCRON_URL
      else process.env.HOLOCRON_URL = previous
    }
  })
})
