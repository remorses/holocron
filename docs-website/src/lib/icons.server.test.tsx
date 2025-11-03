import { describe, test, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { getIconJsx } from './icons.server'

describe('getIconJsx', () => {
  test('returns svg element for valid lucide icon', () => {
    const result = getIconJsx({ provider: 'lucide', key: 'archive' })
    expect(result).toBeTruthy()
    expect(result?.type).toBe('svg')

    const svgString = renderToString(result!)
    expect(svgString).toContain('<svg')
    expect(svgString).toContain('viewBox="0 0 24 24"')
    expect(svgString).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  test('returns null for unsupported provider', () => {
    const result = getIconJsx({ provider: 'heroicons', key: 'archive' })
    expect(result).toBeNull()
  })

  test('returns null for missing key', () => {
    const result = getIconJsx({ provider: 'lucide', key: '' })
    expect(result).toBeNull()
  })

  test('returns null for non-existent icon', () => {
    const result = getIconJsx({
      provider: 'lucide',
      key: 'non-existent-icon-name',
    })
    expect(result).toBeNull()
  })

  test('handles common lucide icons', () => {
    const iconNames = ['archive', 'circle', 'x', 'arrow-right', 'check']

    iconNames.forEach((iconName) => {
      const result = getIconJsx({ provider: 'lucide', key: iconName })
      expect(result).toBeTruthy()
      const svgString = renderToString(result!)
      expect(svgString).toContain('<svg')
    })
  })
  ;['archive', 'cog', 'house'].forEach((iconKey) => {
    test(`defaults to lucide provider when not specified (${iconKey})`, () => {
      const result = getIconJsx({ key: iconKey })
      expect(result).toBeTruthy()
      expect(result?.type).toBe('svg')
    })
  })

  test('svg has correct dimensions', () => {
    const result = getIconJsx({ provider: 'lucide', key: 'archive' })
    const svgString = renderToString(result!)
    expect(svgString).toMatchInlineSnapshot(
      `"<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8m-10 4h4"/></g></svg>"`,
    )
  })
})
