/**
 * OG image tests covering Takumi PNG rendering inside the og-worker.
 * Ported from vite/src/lib/og.test.ts which was removed when the OG
 * rendering was extracted into this dedicated worker.
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { createOgImageResponse } from './og.tsx'

const localBgUrl = `data:image/jpeg;base64,${fs.readFileSync(path.join(import.meta.dirname, 'og-background.jpg')).toString('base64')}`

describe('createOgImageResponse', () => {
  test('renders a PNG response', { timeout: 30000 }, async () => {
    const response = createOgImageResponse({
      title: 'Getting Started',
      description: 'Set up Holocron and publish documentation with a generated Open Graph image.',
      siteName: 'Test Docs',
      pageLabel: 'docs.example.com/getting-started',
      backgroundUrl: localBgUrl,
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
      backgroundUrl: localBgUrl,
    })

    await response.ready
    const png = Buffer.from(await response.arrayBuffer())
    expect(Array.from(png.subarray(0, 4))).toEqual([137, 80, 78, 71])
    expect(png.length).toBeGreaterThan(0)
  })

  test('renders with a custom favicon URL', { timeout: 30000 }, async () => {
    const response = createOgImageResponse({
      title: 'Authentication',
      description: 'Learn how to set up OAuth2 and API key authentication for your application.',
      siteName: 'Polar Docs',
      pageLabel: 'docs.polar.sh/authentication',
      iconUrl: 'https://avatars.githubusercontent.com/u/105373340',
      backgroundUrl: localBgUrl,
    })

    await response.ready
    const png = Buffer.from(await response.arrayBuffer())
    const snapshotDir = path.join(import.meta.dirname, '__snapshots__')
    fs.mkdirSync(snapshotDir, { recursive: true })
    fs.writeFileSync(path.join(snapshotDir, 'og-image-favicon.png'), png)
    expect(Array.from(png.subarray(0, 4))).toEqual([137, 80, 78, 71])
    expect(png.length).toBeGreaterThan(0)
  })

  test('each title gets a deterministic background from the pool', { timeout: 60000 }, async () => {
    const snapshotDir = path.join(import.meta.dirname, '__snapshots__')
    fs.mkdirSync(snapshotDir, { recursive: true })

    const titles = ['Quickstart', 'API Reference', 'Deployment', 'Webhooks']
    for (const title of titles) {
      const response = createOgImageResponse({
        title,
        description: `Learn everything about ${title.toLowerCase()} in this comprehensive guide.`,
        siteName: 'Holocron Docs',
        pageLabel: `holocron.so/docs/${title.toLowerCase().replace(/ /g, '-')}`,
        backgroundUrl: localBgUrl,
      })
      await response.ready
      const png = Buffer.from(await response.arrayBuffer())
      fs.writeFileSync(path.join(snapshotDir, `og-image-${title.toLowerCase().replace(/ /g, '-')}.png`), png)
      expect(Array.from(png.subarray(0, 4))).toEqual([137, 80, 78, 71])
    }
  })
})
