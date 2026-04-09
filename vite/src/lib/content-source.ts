/**
 * Markdown content source abstraction used by Holocron sync and cache persistence.
 */

import fs from 'node:fs'
import path from 'node:path'
import { gitBlobSha } from './git-sha.ts'

export const cacheKeys = {
  site: 'holocron:site-cache',
  processedMdx: 'holocron:processed-mdx',
  image: 'holocron:image-cache',
} as const

const MARKDOWN_EXTENSIONS = ['.mdx', '.md'] as const

export type HolocronSourceFile = {
  slug: string
  checksum: string
}

export interface HolocronContentSource {
  listFiles(): Promise<HolocronSourceFile[]>
  readFile(slug: string): Promise<string | undefined>
  getCache(key: string): Promise<string | null>
  setCache(key: string, value: string): Promise<void>
  getWatchFiles?(): Promise<string[]>
}

export function defineHolocronSource(source: HolocronContentSource): HolocronContentSource {
  return source
}

export function createFilesystemContentSource({
  root,
  pagesDir,
  distDir,
}: {
  root: string
  pagesDir: string
  distDir: string
}): HolocronContentSource {
  const resolvedPagesDir = path.resolve(root, pagesDir)
  const resolvedDistDir = path.resolve(root, distDir)

  return {
    async listFiles() {
      const files = collectMarkdownFiles(resolvedPagesDir)
      return files.map(({ slug, filePath }) => ({
        slug,
        checksum: gitBlobSha(fs.readFileSync(filePath, 'utf-8')),
      }))
    },
    async readFile(slug) {
      const filePath = resolveFilesystemMdxPath(resolvedPagesDir, slug)
      return filePath ? fs.readFileSync(filePath, 'utf-8') : undefined
    },
    async getCache(key) {
      const filePath = getCacheFilePath(resolvedDistDir, key)
      if (!fs.existsSync(filePath)) {
        return null
      }
      return fs.readFileSync(filePath, 'utf-8')
    },
    async setCache(key, value) {
      const filePath = getCacheFilePath(resolvedDistDir, key)
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, value)
    },
    async getWatchFiles() {
      return collectMarkdownFiles(resolvedPagesDir).map((file) => file.filePath)
    },
  }
}

function collectMarkdownFiles(rootDir: string): Array<{ slug: string; filePath: string }> {
  const filesBySlug = new Map<string, string>()

  function walk(dir: string) {
    if (!fs.existsSync(dir)) {
      return
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const filePath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(filePath)
        continue
      }
      const ext = MARKDOWN_EXTENSIONS.find((value) => entry.name.endsWith(value))
      if (!ext) {
        continue
      }
      const slug = normalizeSlug(path.relative(rootDir, filePath).slice(0, -ext.length))
      const existing = filesBySlug.get(slug)
      if (!existing || filePath.endsWith('.mdx')) {
        filesBySlug.set(slug, filePath)
      }
    }
  }

  walk(rootDir)

  return Array.from(filesBySlug.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([slug, filePath]) => ({ slug, filePath }))
}

function resolveFilesystemMdxPath(pagesDir: string, slug: string): string | undefined {
  for (const ext of MARKDOWN_EXTENSIONS) {
    const filePath = path.join(pagesDir, slug + ext)
    if (fs.existsSync(filePath)) {
      return filePath
    }
  }
  return undefined
}

function getCacheFilePath(distDir: string, key: string): string {
  switch (key) {
    case cacheKeys.site:
      return path.join(distDir, 'holocron-cache.json')
    case cacheKeys.processedMdx:
      return path.join(distDir, 'holocron-mdx.json')
    case cacheKeys.image:
      return path.join(distDir, 'holocron-images.json')
    default:
      return path.join(distDir, `${sanitizeCacheKey(key)}.json`)
  }
}

function sanitizeCacheKey(key: string): string {
  return key.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'cache'
}

function normalizeSlug(value: string): string {
  return value.split(path.sep).join('/')
}
