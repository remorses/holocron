import { describe, expect, test } from 'vitest'
import {
  createGeneratedLogoResponse,
  decodeGeneratedLogoText,
  getGeneratedLogoPath,
  normalizeGeneratedLogoText,
  resolveLogo,
} from './generated-logo.tsx'

async function expectPngResponse(response: Response) {
  await (response as ReturnType<typeof createGeneratedLogoResponse>).ready
  expect(response.headers.get('content-type')).toBe('image/png')

  const png = Buffer.from(await response.arrayBuffer())
  expect(Array.from(png.subarray(0, 4))).toEqual([137, 80, 78, 71])
  expect(png.length).toBeGreaterThan(0)
}

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

describe('createGeneratedLogoResponse', () => {
  test('renders a light PNG response', { timeout: 30000 }, async () => {
    const response = createGeneratedLogoResponse({ text: 'Test Docs', theme: 'light' })
    await expectPngResponse(response)
  })

  test('renders a dark PNG response', { timeout: 30000 }, async () => {
    const response = createGeneratedLogoResponse({ text: 'Test Docs', theme: 'dark' })
    await expectPngResponse(response)
  })
})
