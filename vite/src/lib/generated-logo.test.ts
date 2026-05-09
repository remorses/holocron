import { describe, expect, test } from 'vitest'
import {
  normalizeGeneratedLogoText,
  getGeneratedLogoUrl,
  resolveLogo,
} from './generated-logo.tsx'

describe('getGeneratedLogoUrl', () => {
  test('builds absolute URL to holocron.so', () => {
    expect(getGeneratedLogoUrl('Test Docs')).toBe(
      'https://holocron.so/api/ai-logo/test%20docs.jpeg',
    )
  })

  test('normalizeGeneratedLogoText lowercases direct renderer input', () => {
    expect(normalizeGeneratedLogoText('Test Docs')).toBe('test docs')
  })

  test('resolveLogo falls back to one AI-generated image on holocron.so', () => {
    expect(resolveLogo({ light: '', href: '/home' }, 'Test Docs')).toEqual({
      light: 'https://holocron.so/api/ai-logo/test%20docs.jpeg',
      dark: 'https://holocron.so/api/ai-logo/test%20docs.jpeg',
      href: '/home',
      generated: true,
    })
  })
})
