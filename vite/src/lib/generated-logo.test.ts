import { describe, expect, test } from 'vitest'
import {
  normalizeGeneratedLogoText,
  getGeneratedLogoUrl,
  resolveLogo,
} from './generated-logo.tsx'

describe('getGeneratedLogoUrl', () => {
  test('builds root-relative URL to local ai-logo proxy', () => {
    expect(getGeneratedLogoUrl('Test Docs')).toBe(
      '/holocron-api/ai-logo/test%20docs.jpeg',
    )
  })

  test('normalizeGeneratedLogoText lowercases direct renderer input', () => {
    expect(normalizeGeneratedLogoText('Test Docs')).toBe('test docs')
  })

  test('resolveLogo falls back to one AI-generated image via local proxy', () => {
    expect(resolveLogo({ light: '', href: '/home' }, 'Test Docs')).toEqual({
      light: '/holocron-api/ai-logo/test%20docs.jpeg',
      dark: '/holocron-api/ai-logo/test%20docs.jpeg',
      href: '/home',
      generated: true,
    })
  })
})
