import { describe, test, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { generateOgImageSvg, generateOgImagePng, type GenerateOgImageOptions } from './og'

describe('OG Image Generation', () => {
  test('generates OG image', { timeout: 30000 }, async () => {
    const options: GenerateOgImageOptions = {
      title: 'Test Documentation',
      description: 'This is a test description for the OG image generation. It should be truncated after 125 characters to ensure consistent layout.',
      faviconUrl: 'https://notaku.so/logo.svg',
      siteName: 'Fumabase Docs',
      siteTagline: 'Open Source Documentation',
    }

    const svg = await generateOgImageSvg(options)
    const png = await generateOgImagePng(options)

    // Save snapshots for visual inspection
    writeFileSync('src/lib/__snapshots__/og-image.svg', svg)
    writeFileSync('src/lib/__snapshots__/og-image.png', png)

    // Verify SVG structure
    expect(svg).toContain('<svg')
    expect(svg).toContain('width="1200"')
    expect(svg).toContain('height="630"')

    // Verify PNG was generated
    expect(png).toBeTruthy()
    expect(png.length).toBeGreaterThan(0)
    
    // PNG signature verification
    expect(png[0]).toBe(0x89)
    expect(png[1]).toBe(0x50)
    expect(png[2]).toBe(0x4e)
    expect(png[3]).toBe(0x47)
  })
})