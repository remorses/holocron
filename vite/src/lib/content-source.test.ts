/**
 * Tests the markdown content source abstraction used by Holocron sync.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { createFilesystemContentSource, type HolocronContentSource } from './content-source.ts'
import { syncNavigation } from './sync.ts'
import { readConfig } from '../config.ts'

const tmpDirs: string[] = []

afterEach(() => {
  for (const dir of tmpDirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
  tmpDirs.length = 0
})

function createTmpProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-content-source-test-'))
  const distDir = path.join(root, 'dist')
  const publicDir = path.join(root, 'public')
  tmpDirs.push(root)
  fs.mkdirSync(distDir, { recursive: true })
  fs.mkdirSync(publicDir, { recursive: true })
  return { root, distDir, publicDir }
}

describe('content source', () => {
  test('filesystem source lists files, reads content, and stores cache blobs', async () => {
    const project = createTmpProject()
    fs.writeFileSync(path.join(project.root, 'index.mdx'), '# Home')
    fs.writeFileSync(path.join(project.root, 'guide.mdx'), '# Guide')

    const source = createFilesystemContentSource({
      root: project.root,
      pagesDir: project.root,
      distDir: project.distDir,
    })

    const files = await source.listFiles()
    expect(files.map((file) => file.slug).sort()).toEqual(['guide', 'index'])
    expect(await source.readFile('guide')).toBe('# Guide')

    await source.setCache('holocron:test-cache', JSON.stringify({ ok: true }))
    expect(await source.getCache('holocron:test-cache')).toBe('{"ok":true}')
  })

  test('syncNavigation reuses cached data through the source cache interface', async () => {
    const source = createMemoryContentSource({
      files: {
        page: {
          checksum: 'sha-1',
          content: '---\ntitle: Memory Page\n---\n\n## Intro',
        },
      },
    })

    const project = createTmpProject()
    fs.writeFileSync(
      path.join(project.root, 'holocron.jsonc'),
      JSON.stringify({ navigation: [{ group: 'Docs', pages: ['page'] }] }, null, 2),
    )
    const config = readConfig({ root: project.root })

    const first = await syncNavigation({
      config,
      source,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    expect(first.parsedCount).toBe(1)
    expect(first.cachedCount).toBe(0)

    const second = await syncNavigation({
      config,
      source,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    expect(second.parsedCount).toBe(0)
    expect(second.cachedCount).toBe(1)
    expect(source.readCount).toBe(1)
  })
})

function createMemoryContentSource({
  files,
}: {
  files: Record<string, { checksum: string; content: string }>
}): HolocronContentSource & { readCount: number } {
  const cache = new Map<string, string>()
  let readCount = 0
  return {
    get readCount() {
      return readCount
    },
    async listFiles() {
      return Object.entries(files).map(([slug, file]) => ({ slug, checksum: file.checksum }))
    },
    async readFile(slug) {
      const file = files[slug]
      if (!file) return undefined
      readCount++
      return file.content
    },
    async getCache(key) {
      return cache.get(key) ?? null
    },
    async setCache(key, value) {
      cache.set(key, value)
    },
  }
}
