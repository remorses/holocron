import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, test } from 'vitest'
import {
  createGeneratedLogoResponse,
  decodeGeneratedLogoText,
  getGeneratedLogoPath,
  normalizeGeneratedLogoText,
  resolveLogo,
} from './generated-logo.tsx'

async function getOpaqueBounds(buffer: Buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

  let left = info.width
  let right = -1
  let top = info.height
  let bottom = -1

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * info.channels + 3]
      if ((alpha ?? 0) === 0) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }

  if (right === -1 || bottom === -1) {
    throw new Error('Generated logo image had no opaque pixels')
  }

  return {
    left,
    right,
    top,
    bottom,
    width: info.width,
    height: info.height,
  }
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
  const tmpDir = join(import.meta.dirname, '..', '..', 'tmp', 'generated-logo')

  test('renders light and dark logo PNGs with tight-fitting dimensions', async () => {
    const cases = [
      { text: 'My Docs', theme: 'light' as const },
      { text: 'My Docs', theme: 'dark' as const },
      { text: 'longer name here', theme: 'light' as const },
      { text: 'this is a very long documentation site name', theme: 'light' as const },
      { text: 'mintlify components fixture', theme: 'light' as const },
    ]

    mkdirSync(tmpDir, { recursive: true })

    for (const { text, theme } of cases) {
      const response = await createGeneratedLogoResponse({ text, theme })
      await response.ready
      const buffer = Buffer.from(await response.arrayBuffer())
      const filename = `logo-${normalizeGeneratedLogoText(text).replace(/\s+/g, '-')}-${theme}.png`
      writeFileSync(join(tmpDir, filename), buffer)
      expect(buffer.length).toBeGreaterThan(0)
      expect(buffer[0]).toBe(0x89)
      expect(buffer[2]).toBe(0x4e)
      expect(buffer[3]).toBe(0x47)
    }

    const shortResponse = await createGeneratedLogoResponse({ text: 'My Docs', theme: 'light' })
    await shortResponse.ready
    const shortBuf = Buffer.from(await shortResponse.arrayBuffer())

    const longResponse = await createGeneratedLogoResponse({ text: 'longer name here', theme: 'light' })
    await longResponse.ready
    const longBuf = Buffer.from(await longResponse.arrayBuffer())

    const mintlifyResponse = await createGeneratedLogoResponse({ text: 'mintlify components fixture', theme: 'light' })
    await mintlifyResponse.ready
    const mintlifyBuf = Buffer.from(await mintlifyResponse.arrayBuffer())

    const readWidth = (buf: Buffer) => buf.readUInt32BE(16)
    const readHeight = (buf: Buffer) => buf.readUInt32BE(20)

    const shortW = readWidth(shortBuf)
    const shortH = readHeight(shortBuf)
    const longW = readWidth(longBuf)
    const longH = readHeight(longBuf)
    const mintlifyW = readWidth(mintlifyBuf)
    const mintlifyBounds = await getOpaqueBounds(mintlifyBuf)
    const mintlifyRightPadding = mintlifyW - mintlifyBounds.right - 1

    expect(longW).toBeGreaterThan(shortW)
    expect(shortH).toBeGreaterThan(0)
    expect(shortH).toBeLessThan(200)
    expect(longH).toBeLessThan(200)
    expect(mintlifyBounds.left / mintlifyW).toBeLessThan(0.03)
    expect(mintlifyRightPadding / mintlifyW).toBeLessThan(0.03)

    writeFileSync(join(tmpDir, 'logo-my-docs-light.png'), shortBuf)
    writeFileSync(join(tmpDir, 'logo-my-docs-dark.png'), Buffer.from(await (await createGeneratedLogoResponse({ text: 'My Docs', theme: 'dark' })).arrayBuffer()))
    writeFileSync(join(tmpDir, 'logo-longer-name-here-light.png'), longBuf)
    writeFileSync(join(tmpDir, 'logo-mintlify-components-fixture-light.png'), mintlifyBuf)
  })
})
