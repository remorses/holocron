import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { processImage } from './image-processor.ts'

const roots: string[] = []

function createTempImage(svg: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-image-processor-test-'))
  roots.push(root)
  const filePath = path.join(root, 'image.svg')
  fs.writeFileSync(filePath, svg)
  return filePath
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
  test('emits a compact webp placeholder data URI', async () => {
    const filePath = createTempImage(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
        <rect width="1200" height="800" fill="#0f172a" />
        <rect x="80" y="80" width="1040" height="220" rx="24" fill="#38bdf8" />
        <rect x="80" y="340" width="760" height="120" rx="20" fill="#f59e0b" />
        <rect x="80" y="500" width="540" height="120" rx="20" fill="#22c55e" />
      </svg>
    `)

    const meta = await processImage({ filePath, cache: {} })

    expect(meta).toBeDefined()
    expect(meta?.width).toBe(1200)
    expect(meta?.height).toBe(800)
    expect(meta?.placeholder.startsWith('data:image/webp;base64,')).toBe(true)
    expect(Buffer.byteLength(meta!.placeholder)).toBeLessThan(300)
  })
})
