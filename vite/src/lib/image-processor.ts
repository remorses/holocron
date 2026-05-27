/**
 * Build-time image processor — dimensions + compact placeholder generation.
 *
 * Pure functions, no runtime state. Results are cached in
 * dist/holocron-images.json keyed by git blob SHA so the same image
 * content (even at different paths) is processed only once.
 *
 * sharp is a build-only dependency — never imported at request time.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { PACKAGE_VERSION } from './package-version.ts'

const PLACEHOLDER_WIDTH = 16
const CACHE_FILENAME = 'holocron-images.json'

export type ImageMeta = {
  width: number
  height: number
  /** data:image/webp;base64,... — compact placeholder for pixelated loading */
  placeholder: string
}

/** Cache file structure: git SHA → processed image data */
type ImageCache = Record<string, ImageMeta>

type ImageCacheEnvelope = {
  version: string
  images: ImageCache
}

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
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    if (raw && typeof raw === 'object' && raw.version === PACKAGE_VERSION) {
      return (raw as ImageCacheEnvelope).images
    }
    return {}
  } catch {
    return {}
  }
}

/** Write the image cache back to dist/ */
export function saveImageCache({ distDir, cache }: { distDir: string; cache: ImageCache }): void {
  const cachePath = path.join(distDir, CACHE_FILENAME)
  fs.mkdirSync(path.dirname(cachePath), { recursive: true })
  const envelope: ImageCacheEnvelope = { version: PACKAGE_VERSION, images: cache }
  fs.writeFileSync(cachePath, JSON.stringify(envelope, null, 2))
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

  const isSvg = filePath.endsWith('.svg')
  return processImageBuffer({ buffer: fs.readFileSync(filePath), cache, skipPlaceholder: isSvg })
}

export async function processImageBuffer({
  buffer,
  cache,
  skipPlaceholder = false,
}: {
  buffer: Buffer
  cache: ImageCache
  /** SVGs are vector and load instantly — skip the rasterized placeholder
   *  which would produce an ugly 16px pixelated WebP of crisp vector art. */
  skipPlaceholder?: boolean
}): Promise<ImageMeta | undefined> {
  const buf = buffer
  const sha = gitBlobSha(buf)

  // Cache hit — return existing
  const cached = cache[sha]
  if (cached) {
    return cached
  }

  // Cache miss — use sharp for both dimensions and placeholder generation so
  // fixture builds do not depend on a second image parser behaving identically
  // across local macOS and GitHub's Linux runners.
  const sharp = await import('sharp').then((m) => {
    return m.default
  })

  const metadata = await sharp(buf).metadata()
  if (!metadata.width || !metadata.height) {
    return undefined
  }

  let placeholder = ''
  if (!skipPlaceholder) {
    const placeholderBuf = await sharp(buf)
      .resize(PLACEHOLDER_WIDTH)
      .webp({ quality: 50 })
      .toBuffer()
    placeholder = `data:image/webp;base64,${placeholderBuf.toString('base64')}`
  }

  const meta: ImageMeta = {
    width: metadata.width,
    height: metadata.height,
    placeholder,
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
