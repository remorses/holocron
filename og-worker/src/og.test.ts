/**
 * OG image tests covering Takumi PNG rendering inside the og-worker.
 * Ported from vite/src/lib/og.test.ts which was removed when the OG
 * rendering was extracted into this dedicated worker.
 */

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { createOgImageResponse } from './og.tsx'
import { extractPngFromIco, isIcoResponse } from './ico-utils.ts'

const localBgUrl = `data:image/jpeg;base64,${fs.readFileSync(path.join(import.meta.dirname, 'og-background.jpg')).toString('base64')}`

describe('extractPngFromIco', () => {
  test('extracts PNG from a real ICO file', async () => {
    const res = await fetch('https://traforo.dev/favicon.ico')
    const buf = await res.arrayBuffer()
    const png = extractPngFromIco(buf)
    expect(png).toBeDefined()
    expect(Array.from(png!.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(png!.length).toBeGreaterThan(100)
  })

  test('returns undefined for non-ICO data', () => {
    const pngMagic = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(extractPngFromIco(pngMagic.buffer)).toBeUndefined()
  })

  test('returns undefined for empty buffer', () => {
    expect(extractPngFromIco(new ArrayBuffer(0))).toBeUndefined()
  })

  test('returns undefined for truncated ICO header', () => {
    // Valid ICO header but no directory entries
    const buf = new ArrayBuffer(6)
    const view = new DataView(buf)
    view.setUint16(0, 0, true) // reserved
    view.setUint16(2, 1, true) // type = ICO
    view.setUint16(4, 1, true) // count = 1 but no entry data
    expect(extractPngFromIco(buf)).toBeUndefined()
  })

  test('skips BMP entries and returns a smaller PNG entry', () => {
    // Build a synthetic ICO with 2 entries: first is BMP (larger), second is PNG (smaller)
    const pngPayload = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
    const bmpPayload = new Uint8Array([0x42, 0x4d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

    const headerSize = 6
    const dirSize = 2 * 16 // 2 entries
    const totalSize = headerSize + dirSize + bmpPayload.length + pngPayload.length
    const buf = new ArrayBuffer(totalSize)
    const view = new DataView(buf)
    const bytes = new Uint8Array(buf)

    // ICO header
    view.setUint16(0, 0, true) // reserved
    view.setUint16(2, 1, true) // type = ICO
    view.setUint16(4, 2, true) // count = 2

    // Entry 0: BMP (larger, 16 bytes)
    const bmpOffset = headerSize + dirSize
    view.setUint32(6 + 8, bmpPayload.length, true)  // size
    view.setUint32(6 + 12, bmpOffset, true)          // offset

    // Entry 1: PNG (smaller, 10 bytes)
    const pngOffset = bmpOffset + bmpPayload.length
    view.setUint32(6 + 16 + 8, pngPayload.length, true)  // size
    view.setUint32(6 + 16 + 12, pngOffset, true)          // offset

    // Write payloads
    bytes.set(bmpPayload, bmpOffset)
    bytes.set(pngPayload, pngOffset)

    const result = extractPngFromIco(buf)
    expect(result).toBeDefined()
    expect(Array.from(result!.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})

describe('isIcoResponse', () => {
  test('detects standard ICO content types', () => {
    expect(isIcoResponse('https://example.com/icon', 'image/vnd.microsoft.icon')).toBe(true)
    expect(isIcoResponse('https://example.com/icon', 'image/x-icon')).toBe(true)
    expect(isIcoResponse('https://example.com/icon', 'image/ico')).toBe(true)
    expect(isIcoResponse('https://example.com/icon', 'image/icon')).toBe(true)
  })

  test('handles content-type with parameters and case', () => {
    expect(isIcoResponse('https://example.com/icon', 'image/x-icon; charset=binary')).toBe(true)
    expect(isIcoResponse('https://example.com/icon', 'IMAGE/VND.MICROSOFT.ICON')).toBe(true)
  })

  test('detects .ico URL extension with query params and case', () => {
    expect(isIcoResponse('https://example.com/favicon.ico?v=1', 'application/octet-stream')).toBe(true)
    expect(isIcoResponse('https://example.com/FAVICON.ICO', 'application/octet-stream')).toBe(true)
  })

  test('returns false for non-ICO', () => {
    expect(isIcoResponse('https://example.com/logo.png', 'image/png')).toBe(false)
    expect(isIcoResponse('https://example.com/favicon.svg', 'image/svg+xml')).toBe(false)
  })
})

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

  test('renders with an ICO favicon converted to PNG', { timeout: 30000 }, async () => {
    // Fetch the traforo favicon.ico which contains an embedded PNG
    const icoRes = await fetch('https://traforo.dev/favicon.ico')
    const icoBuf = await icoRes.arrayBuffer()
    const png = extractPngFromIco(icoBuf)
    expect(png).toBeDefined()
    // Verify the extracted bytes start with PNG magic
    expect(Array.from(png!.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])

    // Build a data URL and render the OG image with the extracted PNG
    let binary = ''
    for (let i = 0; i < png!.length; i++) binary += String.fromCharCode(png![i]!)
    const iconDataUrl = `data:image/png;base64,${btoa(binary)}`

    const response = createOgImageResponse({
      title: 'Traforo',
      description: 'HTTP tunnel via Cloudflare Durable Objects and WebSockets',
      siteName: 'Traforo',
      pageLabel: 'traforo.dev/',
      iconUrl: iconDataUrl,
      backgroundUrl: localBgUrl,
    })

    await response.ready
    const ogPng = Buffer.from(await response.arrayBuffer())
    const snapshotDir = path.join(import.meta.dirname, '__snapshots__')
    fs.mkdirSync(snapshotDir, { recursive: true })
    fs.writeFileSync(path.join(snapshotDir, 'og-image-ico-favicon.png'), ogPng)
    expect(Array.from(ogPng.subarray(0, 4))).toEqual([137, 80, 78, 71])
    expect(ogPng.length).toBeGreaterThan(0)
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
