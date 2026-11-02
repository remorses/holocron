import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { emptyImageCache, loadImageCache, processImage, saveImageCache } from './image-processor.ts'

const roots: string[] = []

function createTempImage(svg: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-image-processor-test-'))
  roots.push(root)
  const filePath = path.join(root, 'image.svg')
  fs.writeFileSync(filePath, svg)
  return filePath
}

function createTempDir(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-image-processor-test-'))
  roots.push(root)
  return root
}

afterEach(() => {
  for (const root of roots) {
    if (fs.existsSync(root)) {
      fs.rmSync(root, { recursive: true, force: true })
    }
  }
  roots.length = 0
})

describe('processImage', () => {
  test('emits a compact webp placeholder data URI for raster-like files', async () => {
    // Use a .png extension so placeholder is generated (SVGs skip placeholders)
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
        <rect width="1200" height="800" fill="#0f172a" />
        <rect x="80" y="80" width="1040" height="220" rx="24" fill="#38bdf8" />
        <rect x="80" y="340" width="760" height="120" rx="20" fill="#f59e0b" />
        <rect x="80" y="500" width="540" height="120" rx="20" fill="#22c55e" />
      </svg>
    `
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-img-test-'))
    roots.push(root)
    const filePath = path.join(root, 'test.png')
    // sharp can process SVG content regardless of extension — it reads the buffer format
    fs.writeFileSync(filePath, svgContent)

    const meta = await processImage({ filePath, cache: emptyImageCache() })

    expect(meta).toBeDefined()
    expect(meta?.width).toBe(1200)
    expect(meta?.height).toBe(800)
    expect(meta?.placeholder.startsWith('data:image/webp;base64,')).toBe(true)
    expect(Buffer.byteLength(meta!.placeholder)).toBeLessThan(300)
  })

  test('skips placeholder for SVG files', async () => {
    const filePath = createTempImage(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
        <rect width="1200" height="800" fill="#0f172a" />
      </svg>
    `)

    const meta = await processImage({ filePath, cache: emptyImageCache() })

    expect(meta).toBeDefined()
    expect(meta?.width).toBe(1200)
    expect(meta?.height).toBe(800)
    // SVGs are vector and load instantly — no placeholder needed
    expect(meta?.placeholder).toBe('')
  })

  test('reuses cached meta for unchanged files across syncs without reading them', async () => {
    const distDir = createTempDir()
    const square = (size: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"></svg>`
    const filePath = createTempImage(square(10))
    const mtimeSeconds = 1_700_000_000
    fs.utimesSync(filePath, mtimeSeconds, mtimeSeconds)

    const cache = emptyImageCache()
    const first = await processImage({ filePath, cache })
    saveImageCache({ distDir, cache })

    // Same size and mtime: the file must not be read again, so the edit is not seen.
    fs.writeFileSync(filePath, square(20))
    fs.utimesSync(filePath, mtimeSeconds, mtimeSeconds)
    expect(await processImage({ filePath, cache: loadImageCache({ distDir }) })).toEqual(first)

    // A new mtime invalidates the entry.
    fs.utimesSync(filePath, mtimeSeconds + 5, mtimeSeconds + 5)
    expect(await processImage({ filePath, cache: loadImageCache({ distDir }) })).toMatchObject({ width: 20, height: 20 })
  })

  test('loadImageCache ignores stale package versions', () => {
    const distDir = createTempDir()
    fs.writeFileSync(
      path.join(distDir, 'holocron-images.json'),
      JSON.stringify({
        version: '0.0.0-stale',
        images: {
          stale: {
            width: 1,
            height: 1,
            placeholder: 'data:image/webp;base64,stale',
          },
        },
      }),
    )

    expect(loadImageCache({ distDir })).toEqual(emptyImageCache())
  })
})
