// Tests for normalize-config.ts — focuses on the `base` slug normalization
// for OpenAPI/changelog tabs (leading/trailing slashes are stripped so a
// `/docs/api` base behaves identically to `docs/api`).

import { describe, expect, test } from 'vitest'
import { normalize } from './normalize-config.ts'

function tab(config: Record<string, unknown>) {
  const c = normalize({
    name: 'Docs',
    navigation: { tabs: [config] },
  })
  return c.navigation.tabs[0]!
}

describe('normalize() — tab base slug', () => {
  test('OpenAPI: leading slash is stripped to behave like no prefix', () => {
    expect(tab({ tab: 'API', openapi: 'api.json', base: '/docs/api' }).base).toBe('docs/api')
    expect(tab({ tab: 'API', openapi: 'api.json', base: 'docs/api' }).base).toBe('docs/api')
  })

  test('OpenAPI: trailing slash and "/" edge cases', () => {
    expect(tab({ tab: 'API', openapi: 'api.json', base: 'docs/api/' }).base).toBe('docs/api')
    expect(tab({ tab: 'API', openapi: 'api.json', base: '/' }).base).toBe('')
  })

  test('OpenAPI: omitted base stays undefined (provider defaults to "api")', () => {
    expect(tab({ tab: 'API', openapi: 'api.json' }).base).toBeUndefined()
  })

  test('Changelog: leading slash is stripped', () => {
    expect(
      tab({ tab: 'Changelog', changelog: 'https://github.com/acme/acme', base: '/docs/changelog' }).base,
    ).toBe('docs/changelog')
  })
})

describe('normalize() — layout mode', () => {
  test('defaults to the full layout and accepts compact mode', () => {
    expect(normalize({ name: 'Docs' }).layout.mode).toBe('default')
    expect(normalize({ name: 'Docs', layout: { mode: 'compact' } }).layout.mode).toBe('compact')
  })
})

describe('normalize() — assistant display', () => {
  test('defaults to sidebar and accepts floating', () => {
    expect(normalize({ name: 'Docs' }).assistant).toEqual({ enabled: true, display: 'sidebar' })
    expect(normalize({ name: 'Docs', assistant: { display: 'floating' } }).assistant).toEqual({
      enabled: true,
      display: 'floating',
    })
  })

  test('compact layout defaults assistant to floating', () => {
    expect(normalize({ name: 'Docs', layout: { mode: 'compact' } }).assistant).toEqual({
      enabled: true,
      display: 'floating',
    })
  })

  test('compact layout keeps an explicit sidebar display', () => {
    expect(
      normalize({
        name: 'Docs',
        layout: { mode: 'compact' },
        assistant: { display: 'sidebar' },
      }).assistant,
    ).toEqual({
      enabled: true,
      display: 'sidebar',
    })
  })

  test('preserves assistant.supportEmail', () => {
    expect(
      normalize({
        name: 'Docs',
        assistant: { supportEmail: 'tommy@holocron.so' },
      }).assistant,
    ).toEqual({
      enabled: true,
      display: 'sidebar',
      supportEmail: 'tommy@holocron.so',
    })
  })

  test('drops invalid assistant.supportEmail', () => {
    expect(
      normalize({
        name: 'Docs',
        assistant: { supportEmail: 'not-an-email' },
      }).assistant,
    ).toEqual({ enabled: true, display: 'sidebar' })
  })
})

describe('normalize() — version language', () => {
  test('preserves a BCP 47 language tag on a version', () => {
    const config = normalize({
      name: 'Docs',
      navigation: {
        versions: [{ version: 'Nederlands', lang: 'nl-BE', pages: ['nl/index'] }],
      },
    })

    expect(config.navigation.versions[0]?.lang).toBe('nl-BE')
  })
})

describe('normalize() — poweredBy', () => {
  test('omits poweredBy when the field is missing', () => {
    expect(normalize({ name: 'Docs' }).poweredBy).toBeUndefined()
  })

  test('accepts a single { name, url } object', () => {
    expect(
      normalize({
        name: 'Docs',
        poweredBy: { name: 'Notaku', url: 'https://notaku.so' },
      }).poweredBy,
    ).toEqual([{ name: 'Notaku', url: 'https://notaku.so' }])
  })

  test('accepts a list of linked names', () => {
    expect(
      normalize({
        name: 'Docs',
        poweredBy: [
          { name: 'Notaku', url: 'https://notaku.so' },
          { name: 'Holocron', url: 'https://holocron.so' },
        ],
      }).poweredBy,
    ).toEqual([
      { name: 'Notaku', url: 'https://notaku.so' },
      { name: 'Holocron', url: 'https://holocron.so' },
    ])
  })

  test('drops items that are missing name or url', () => {
    expect(
      normalize({
        name: 'Docs',
        poweredBy: [
          { name: 'Notaku', url: 'https://notaku.so' },
          { name: '', url: 'https://example.com' },
          { name: 'Nope' },
        ],
      }).poweredBy,
    ).toEqual([{ name: 'Notaku', url: 'https://notaku.so' }])
  })
})
