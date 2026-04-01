/**
 * Build-time image processor — dimensions + 64px placeholder generation.
 *
 * Pure functions, no runtime state. Results are cached in
 * dist/holocron-images.json keyed by git blob SHA so the same image
 * content (even at different paths) is processed only once.
 *
 * sharp and image-size are build-only dependencies — never imported at
 * request time.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const PLACEHOLDER_WIDTH = 64
const CACHE_FILENAME = 'holocron-images.json'

export type ImageMeta = {
  width: number
  height: number
  /** data:image/png;base64,... — 64px placeholder for pixelated loading */
  placeholder: string
}

/** Cache file structure: git SHA → processed image data */
type ImageCache = Record<string, ImageMeta>

/**
 * Load the image cache from a previous build.
 * Returns a mutable record that callers write to during processing.
 */
export function loadImageCache({ distDir }: { distDir: string }): ImageCache {
  const cachePath = path.join(distDir, CACHE_FILENAME)
  if (!fs.existsSync(cachePath)) {
    return {}
  }
  try {
    return JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as ImageCache
  } catch {
    return {}
  }
}

/** Write the image cache back to dist/ */
export function saveImageCache({ distDir, cache }: { distDir: string; cache: ImageCache }): void {
  const cachePath = path.join(distDir, CACHE_FILENAME)
  fs.mkdirSync(path.dirname(cachePath), { recursive: true })
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2))
}

/**
 * Process a single image file — returns dimensions + placeholder.
 * Checks the SHA cache first; only runs sharp on cache miss.
 */
export async function processImage({
  filePath,
  cache,
}: {
  filePath: string
  cache: ImageCache
}): Promise<ImageMeta | undefined> {
  if (!fs.existsSync(filePath)) {
    return undefined
  }

  const buf = fs.readFileSync(filePath)
  const sha = gitBlobSha(buf)

  // Cache hit — return existing
  const cached = cache[sha]
  if (cached) {
    return cached
  }

  // Cache miss — process with sharp + image-size
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

  const meta: ImageMeta = {
    width: size.width,
    height: size.height,
    placeholder: `data:image/png;base64,${placeholderBuf.toString('base64')}`,
  }

  // Store in cache by SHA (same content at different paths → one entry)
  cache[sha] = meta
  return meta
}

function gitBlobSha(buf: Buffer): string {
  return crypto
    .createHash('sha1')
    .update(`blob ${buf.length}\0`)
    .update(buf)
    .digest('hex')
}
