/**
 * Tests for the imageboard virtual tab provider and the video dimension
 * probe. Fixture videos in ./fixtures/ are generated with ffmpeg
 * (tiny solid-color clips, ~2KB each):
 *   ffmpeg -f lavfi -i "color=c=blue:s=320x180:d=0.5" -c:v libx264 -pix_fmt yuv420p tiny.mp4
 *   ffmpeg -f lavfi -i "color=c=red:s=256x144:d=0.5" -c:v libvpx-vp9 tiny.webm
 *   ffmpeg -f lavfi -i "color=c=green:s=320x240:d=0.5" -c:v libx264 -movflags +faststart tiny-faststart.mp4
 */

import { describe, expect, test, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { imageboardProvider } from './provider.ts'
import { probeVideoDimensions } from './video-dimensions.ts'
import type { ConfigNavTab } from '../../config.ts'

const fixturesDir = path.join(import.meta.dirname, 'fixtures')

// 1×1 transparent PNG
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

describe('probeVideoDimensions', () => {
  test('mp4 (moov at end)', () => {
    expect(probeVideoDimensions(path.join(fixturesDir, 'tiny.mp4'))).toMatchInlineSnapshot(`
      {
        "height": 180,
        "width": 320,
      }
    `)
  })

  test('mp4 faststart (moov first)', () => {
    expect(probeVideoDimensions(path.join(fixturesDir, 'tiny-faststart.mp4'))).toMatchInlineSnapshot(`
      {
        "height": 240,
        "width": 320,
      }
    `)
  })

  test('webm', () => {
    expect(probeVideoDimensions(path.join(fixturesDir, 'tiny.webm'))).toMatchInlineSnapshot(`
      {
        "height": 144,
        "width": 256,
      }
    `)
  })

  test('non-video file returns undefined', () => {
    expect(probeVideoDimensions(path.join(import.meta.dirname, 'provider.ts'))).toBeUndefined()
  })
})

describe('imageboardProvider', () => {
  let dir: string

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-imageboard-'))
    const publicDir = path.join(dir, 'public')
    const board = path.join(publicDir, 'moodboard')
    fs.mkdirSync(path.join(board, 'nested'), { recursive: true })
    fs.writeFileSync(path.join(board, 'b-newer.png'), TINY_PNG)
    fs.writeFileSync(path.join(board, 'a-older.png'), TINY_PNG)
    fs.writeFileSync(path.join(board, 'nested', 'deep.png'), TINY_PNG)
    fs.writeFileSync(path.join(board, 'notes.txt'), 'ignored')
    fs.copyFileSync(path.join(fixturesDir, 'tiny.mp4'), path.join(board, 'clip.mp4'))
    // No git repo in tmpdir → mtime fallback. Stagger mtimes explicitly.
    const now = Date.now()
    fs.utimesSync(path.join(board, 'a-older.png'), new Date(now - 30_000), new Date(now - 30_000))
    fs.utimesSync(path.join(board, 'nested', 'deep.png'), new Date(now - 20_000), new Date(now - 20_000))
    fs.utimesSync(path.join(board, 'clip.mp4'), new Date(now - 10_000), new Date(now - 10_000))
    fs.utimesSync(path.join(board, 'b-newer.png'), new Date(now), new Date(now))
  })

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test('claims only tabs with imageboard field', () => {
    expect(imageboardProvider.claims({ tab: 'X', groups: [], imageboard: './x' } as ConfigNavTab)).toBe(true)
    expect(imageboardProvider.claims({ tab: 'X', groups: [] } as ConfigNavTab)).toBe(false)
  })

  test('generates a masonry page sorted newest-first with public srcs', async () => {
    const tab: ConfigNavTab = {
      tab: 'Moodboard',
      groups: [],
      imageboard: './public/moodboard',
      columns: 4,
    }
    const result = await imageboardProvider.generate({
      tab,
      projectRoot: dir,
      pagesDir: dir,
      publicDir: path.join(dir, 'public'),
    })
    expect(result.groups).toEqual([{ group: '', pages: ['moodboard'] }])
    expect(result.watchPaths).toEqual([path.join(dir, 'public', 'moodboard')])
    expect(result.mdxContent['moodboard']).toMatchInlineSnapshot('\n' + `
      "---
      title: "Moodboard"
      description: "Moodboard — 4 items."
      mode: "custom"
      ---

      <ImageboardGrid columns="4">

      <Image src="/moodboard/b-newer.png" alt="b newer" loading="lazy" />

      <ImageboardVideo src="/moodboard/clip.mp4" width="320" height="180" />

      <Image src="/moodboard/nested/deep.png" alt="deep" loading="lazy" />

      <Image src="/moodboard/a-older.png" alt="a older" loading="lazy" />

      </ImageboardGrid>"
    `)
  })

  test('files outside public/ get relative image srcs and copied videos', async () => {
    const outside = path.join(dir, 'inspiration')
    fs.mkdirSync(outside, { recursive: true })
    fs.writeFileSync(path.join(outside, 'pic.png'), TINY_PNG)
    fs.copyFileSync(path.join(fixturesDir, 'tiny.webm'), path.join(outside, 'clip.webm'))

    const tab: ConfigNavTab = { tab: 'Inspiration', groups: [], imageboard: './inspiration' }
    const result = await imageboardProvider.generate({
      tab,
      projectRoot: dir,
      pagesDir: dir,
      publicDir: path.join(dir, 'public'),
    })
    const mdx = result.mdxContent['inspiration']!
    expect(mdx).toContain('<Image src="./inspiration/pic.png"')
    expect(mdx).toMatch(/<ImageboardVideo src="\/_holocron\/media\/[0-9a-f]{8}-clip\.webm" width="256" height="144" \/>/)
    // The video was copied into public/_holocron/media/
    const mediaDir = path.join(dir, 'public', '_holocron', 'media')
    expect(fs.readdirSync(mediaDir).some((f) => f.endsWith('-clip.webm'))).toBe(true)
  })

  test('missing folder generates a warning page', async () => {
    const tab: ConfigNavTab = { tab: 'Broken', groups: [], imageboard: './does-not-exist' }
    const result = await imageboardProvider.generate({
      tab,
      projectRoot: dir,
      pagesDir: dir,
      publicDir: path.join(dir, 'public'),
    })
    expect(result.mdxContent['does-not-exist']).toContain('<Warning>')
  })
})
