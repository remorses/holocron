/**
 * Image metadata cache — single JSON file at dist/holocron-images.json.
 *
 * Stores dimensions + 64px base64 placeholder for each local image found
 * in MDX content. Uses git blob SHA for cache invalidation (deterministic
 * across machines/CI, unlike mtime).
 *
 * During build/dev:
 *   1. createImageCache() loads dist/holocron-images.json into a Record
 *   2. Page renders call cache.get(src, publicDir) — returns cached if SHA
 *      matches, otherwise reads the file once, processes, stores in memory
 *   3. At the end, cache.flush() writes the Record to dist/holocron-images.json
 *
 * Same image referenced in multiple pages is processed exactly once thanks
 * to the in-memory Record keyed by src path.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { Root, RootContent } from 'mdast'

const PLACEHOLDER_WIDTH = 64
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const CACHE_FILENAME = 'holocron-images.json'

export type ImageMeta = {
  width: number
  height: number
  /** Git blob SHA of the source image file */
  gitSha: string
  /** data:image/png;base64,... — 64px placeholder for pixelated loading */
  placeholder: string
}

/** The full cache file: Record<src, ImageMeta> */
export type ImageCache = Record<string, ImageMeta>

/**
 * In-memory image cache backed by a single JSON file.
 * Call get() per image src, then flush() once at the end of build.
 */
export function createImageCache({ distDir }: { distDir: string }) {
  const cachePath = path.join(distDir, CACHE_FILENAME)
  const cache: ImageCache = readCacheFile(cachePath)
  // Track in-flight promises so the same image is never read twice even
  // when multiple pages request it concurrently
  const inflight: Record<string, Promise<ImageMeta | undefined>> = {}

  return {
    /**
     * Get image metadata for a src path. Returns cached if SHA matches,
     * otherwise reads the file, processes it, and stores in memory.
     * Each image file is read at most once even on cold cache.
     */
    async get({ src, publicDir }: { src: string; publicDir: string }): Promise<ImageMeta | undefined> {
      const srcPath = src.startsWith('/') ? src.slice(1) : src
      const filePath = path.join(publicDir, srcPath)

      const ext = path.extname(filePath).toLowerCase()
      if (!IMAGE_EXTENSIONS.has(ext)) {
        return undefined
      }

      // Return from in-memory cache if SHA matches (already processed this build)
      const existing = cache[src]
      if (existing) {
        // Verify file still exists and SHA still matches
        if (fs.existsSync(filePath)) {
          const sha = gitBlobShaForFile(filePath)
          if (sha === existing.gitSha) {
            return existing
          }
        }
      }

      // Deduplicate concurrent requests for the same image
      if (inflight[src]) {
        return inflight[src]
      }

      const promise = processImage({ src, filePath })
      inflight[src] = promise
      const result = await promise
      delete inflight[src]

      if (result) {
        cache[src] = result
      }
      return result
    },

    /** Build manifest for all local images in a mdast tree */
    async buildManifest({ mdast, publicDir }: { mdast: Root; publicDir: string }): Promise<Record<string, ImageMeta>> {
      const srcs = collectImageSrcs(mdast)
      const manifest: Record<string, ImageMeta> = {}

      await Promise.all(
        srcs.map(async (src) => {
          const meta = await this.get({ src, publicDir })
          if (meta) {
            manifest[src] = meta
          }
        }),
      )

      return manifest
    },

    /** Write the in-memory cache to dist/holocron-images.json */
    flush(): void {
      try {
        const dir = path.dirname(cachePath)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2))
      } catch (e) {
        console.error(`image-cache: cannot write ${cachePath}`, e)
      }
    },
  }
}

/* ── Image processing ────────────────────────────────────────────────── */

async function processImage({ src, filePath }: { src: string; filePath: string }): Promise<ImageMeta | undefined> {
  if (!fs.existsSync(filePath)) {
    return undefined
  }

  const sha = gitBlobShaForFile(filePath)

  const [{ imageSizeFromFile }, sharp] = await Promise.all([
    import('image-size/fromFile'),
    import('sharp').then((m) => {
      return m.default
    }),
  ])

  const [size, placeholderBuf] = await Promise.all([
    imageSizeFromFile(filePath),
    sharp(filePath)
      .resize(PLACEHOLDER_WIDTH)
      .png({ compressionLevel: 9 })
      .toBuffer(),
  ])

  return {
    width: size.width,
    height: size.height,
    gitSha: sha,
    placeholder: `data:image/png;base64,${placeholderBuf.toString('base64')}`,
  }
}

function gitBlobShaForFile(filePath: string): string {
  const buf = fs.readFileSync(filePath)
  return crypto
    .createHash('sha1')
    .update(`blob ${buf.length}\0`)
    .update(buf)
    .digest('hex')
}

/* ── MDX image src collection ────────────────────────────────────────── */

/** Walk mdast tree and collect all local image srcs. */
export function collectImageSrcs(root: Root): string[] {
  const srcs: string[] = []

  function walk(nodes: RootContent[]) {
    for (const node of nodes) {
      if (node.type === 'image' && node.url && !node.url.startsWith('http')) {
        srcs.push(node.url)
      }
      if (
        node.type === 'mdxJsxFlowElement' &&
        'name' in node &&
        'attributes' in node
      ) {
        const name = (node as { name?: string }).name
        if (name === 'PixelatedImage' || name === 'img') {
          const attrs = (node as { attributes: Array<{ type: string; name?: string; value?: unknown }> }).attributes
          const srcAttr = attrs.find((a) => {
            return a.type === 'mdxJsxAttribute' && a.name === 'src'
          })
          if (srcAttr) {
            const val = getAttrStringValue(srcAttr.value)
            if (val && !val.startsWith('http')) {
              srcs.push(val)
            }
          }
        }
      }
      if ('children' in node && Array.isArray(node.children)) {
        walk(node.children as RootContent[])
      }
    }
  }

  walk(root.children)
  return [...new Set(srcs)]
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Extract string value from an mdxJsxAttribute value (string or expression). */
export function getAttrStringValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object' && 'value' in value) {
    const v = (value as { value: string }).value
    if (typeof v === 'string') {
      const unquoted = v.replace(/^['"]|['"]$/g, '')
      return unquoted
    }
  }
  return undefined
}

/** Get a named attribute from an mdxJsxFlowElement node. */
export function getJsxAttr(
  node: { attributes?: Array<{ type: string; name?: string; value?: unknown }> },
  name: string,
): string | undefined {
  const attr = node.attributes?.find((a) => {
    return a.type === 'mdxJsxAttribute' && a.name === name
  })
  if (!attr) {
    return undefined
  }
  return getAttrStringValue(attr.value)
}

function readCacheFile(cachePath: string): ImageCache {
  if (!fs.existsSync(cachePath)) {
    return {}
  }
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as ImageCache
  } catch {
    return {}
  }
}
