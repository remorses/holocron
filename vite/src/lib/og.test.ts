/**
 * OG image tests covering route URL helpers and Takumi PNG generation.
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { createOgImageResponse } from './og.tsx'
import { getOgPath, resolveOgIconUrl } from './og-utils.ts'

describe('getOgPath', () => {
  test('maps root page to /og', () => {
    expect(getOgPath('/')).toBe('/og')
  })

  test('maps nested page to /og/<path>', () => {
    expect(getOgPath('/getting-started')).toBe('/og/getting-started')
    expect(getOgPath('/guides/advanced')).toBe('/og/guides/advanced')
  })
})

describe('resolveOgIconUrl', () => {
  test('prefers favicon over logo and resolves absolute URL', () => {
    const iconUrl = resolveOgIconUrl(
      {
        favicon: { light: '/favicon.png', dark: '/favicon-dark.png' },
        logo: { light: '/logo.svg' },
      },
      'https://docs.example.com/getting-started',
    )

    expect(iconUrl).toBe('https://docs.example.com/favicon.png')
  })

  test('returns undefined when favicon is missing so the built-in icon can render', () => {
    const iconUrl = resolveOgIconUrl(
      {
        favicon: { light: '', dark: '' },
        logo: { light: '/logo.svg' },
      },
      'https://docs.example.com/',
    )

    expect(iconUrl).toBeUndefined()
  })

  test('returns undefined when neither favicon nor logo exist', () => {
    const iconUrl = resolveOgIconUrl(
      {
        favicon: { light: '', dark: '' },
        logo: { light: '' },
      },
      'https://docs.example.com/',
    )

    expect(iconUrl).toBeUndefined()
  })
})

describe('createOgImageResponse', () => {
  test('renders a PNG response', { timeout: 30000 }, async () => {
    const response = createOgImageResponse({
      title: 'Getting Started',
      description: 'Set up Holocron and publish documentation with a generated Open Graph image.',
      siteName: 'Test Docs',
      pageLabel: 'docs.example.com/getting-started',
    })

    await response.ready
    expect(response.headers.get('content-type')).toBe('image/png')

    const png = Buffer.from(await response.arrayBuffer())
    const snapshotDir = path.join(import.meta.dirname, '__snapshots__')
    fs.mkdirSync(snapshotDir, { recursive: true })
    fs.writeFileSync(path.join(snapshotDir, 'og-image.png'), png)

    expect(Array.from(png.subarray(0, 4))).toMatchInlineSnapshot(`
      [
        137,
        80,
        78,
        71,
      ]
    `)
    expect(png.length).toBeGreaterThan(0)
  })

  test('renders a PNG response with the built-in holocron icon fallback', { timeout: 30000 }, async () => {
    const response = createOgImageResponse({
      title: 'No Custom Favicon',
      description: 'The OG card should fall back to the built-in Holocron icon when favicon is missing.',
      siteName: 'Test Docs',
      pageLabel: 'docs.example.com/no-custom-favicon',
    })

    await response.ready
    const png = Buffer.from(await response.arrayBuffer())
    expect(Array.from(png.subarray(0, 4))).toEqual([137, 80, 78, 71])
    expect(png.length).toBeGreaterThan(0)
  })
})
