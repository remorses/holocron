/**
 * Build-time image processor — dimensions + compact placeholder generation.
 *
 * Pure functions, no runtime state. Results are cached in
 * dist/holocron-images.json keyed by git blob SHA so the same image
 * content (even at different paths) is processed only once.
 *
 * sharp and image-size are build-only dependencies — never imported at
 * request time.
 */

import fs from 'node:fs'
import crypto from 'node:crypto'
import { cacheKeys, type HolocronContentSource } from './content-source.ts'
import { PACKAGE_VERSION } from './package-version.ts'

const PLACEHOLDER_WIDTH = 16

export type ImageMeta = {
  width: number
  height: number
  /** data:image/webp;base64,... — compact placeholder for pixelated loading */
  placeholder: string
}

/** Cache file structure: git SHA → processed image data */
export type ImageCache = Record<string, ImageMeta>

type ImageCacheEnvelope = {
  version: string
  images: ImageCache
}

/**
 * Load the image cache from a previous build.
 * Returns a mutable record that callers write to during processing.
 */
export async function loadImageCache({ source }: { source: Pick<HolocronContentSource, 'getCache'> }): Promise<ImageCache> {
  const rawCache = await source.getCache(cacheKeys.image)
  if (!rawCache) {
    return {}
  }
  try {
    const raw = JSON.parse(rawCache)
    if (raw && typeof raw === 'object' && raw.version === PACKAGE_VERSION) {
      return (raw as ImageCacheEnvelope).images
    }
    return {}
  } catch {
    return {}
  }
}

/** Write the image cache back through the content source cache interface. */
export async function saveImageCache({
  source,
  cache,
}: {
  source: Pick<HolocronContentSource, 'setCache'>
  cache: ImageCache
}): Promise<void> {
  const envelope: ImageCacheEnvelope = { version: PACKAGE_VERSION, images: cache }
  await source.setCache(cacheKeys.image, JSON.stringify(envelope, null, 2))
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

  return processImageBuffer({ buffer: fs.readFileSync(filePath), cache })
}

export async function processImageBuffer({
  buffer,
  cache,
}: {
  buffer: Buffer
  cache: ImageCache
}): Promise<ImageMeta | undefined> {
  const buf = buffer
  const sha = gitBlobSha(buf)

  // Cache hit — return existing
  const cached = cache[sha]
  if (cached) {
    return cached
  }

  // Cache miss — process with sharp + image-size
  const [{ imageSize }, sharp] = await Promise.all([
    import('image-size'),
    import('sharp').then((m) => {
      return m.default
    }),
  ])

  const size = imageSize(buf)
  if (!size.width || !size.height) {
    return undefined
  }
  const placeholderBuf = await sharp(buf)
    .resize(PLACEHOLDER_WIDTH)
    .webp({ quality: 50 })
    .toBuffer()

  const meta: ImageMeta = {
    width: size.width,
    height: size.height,
    placeholder: `data:image/webp;base64,${placeholderBuf.toString('base64')}`,
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
