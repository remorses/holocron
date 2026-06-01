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
