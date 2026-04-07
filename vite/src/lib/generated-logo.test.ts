import { describe, expect, test } from 'vitest'
import {
  decodeGeneratedLogoText,
  getGeneratedLogoPath,
  normalizeGeneratedLogoText,
  resolveLogo,
} from './generated-logo.tsx'

describe('getGeneratedLogoPath', () => {
  test('encodes text in the pathname', () => {
    expect(getGeneratedLogoPath('Test Docs', 'light')).toBe('/holocron-api/logo/light/test%20docs.png')
  })

  test('decodeGeneratedLogoText strips png suffix and decodes text', () => {
    expect(decodeGeneratedLogoText('Test%20Docs.png')).toBe('test docs')
  })

  test('normalizeGeneratedLogoText lowercases direct renderer input', () => {
    expect(normalizeGeneratedLogoText('Test Docs')).toBe('test docs')
  })

  test('resolveLogo falls back to generated themed images', () => {
    expect(resolveLogo({ light: '', href: '/home' }, 'Test Docs', '/docs/')).toEqual({
      light: '/docs/holocron-api/logo/light/test%20docs.png',
      dark: '/docs/holocron-api/logo/dark/test%20docs.png',
      href: '/home',
    })
  })
})
