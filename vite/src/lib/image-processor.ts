/**
 * Build-time image processor — dimensions + compact placeholder generation.
 *
 * Results are cached in dist/holocron-images.json:
 * - images: git blob SHA → meta, so the same content at different paths runs sharp once
 * - files: path → size, mtime and SHA, so unchanged local files are never read again
 * - remote: URL → SHA, so a remote image is downloaded once per cache lifetime
 *
 * sharp is a build-only dependency — never imported at request time.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { PACKAGE_VERSION } from './package-version.ts'
import { formatHolocronWarning, logger } from './logger.ts'

const PLACEHOLDER_WIDTH = 16
const CACHE_FILENAME = 'holocron-images.json'
const REMOTE_IMAGE_TIMEOUT_MS = 5_000

export type ImageMeta = {
  width: number
  height: number
  /** data:image/webp;base64,... — compact placeholder for pixelated loading */
  placeholder: string
}

export type ImageCache = {
  images: Record<string, ImageMeta>
  files: Record<string, { size: number; mtimeMs: number; sha: string }>
  remote: Record<string, string>
}

type ImageCacheEnvelope = ImageCache & { version: string }

export function emptyImageCache(): ImageCache {
  return { images: {}, files: {}, remote: {} }
}

/**
 * Load the image cache from a previous build.
 * Returns a mutable object that callers write to during processing.
 */
export function loadImageCache({ distDir }: { distDir: string }): ImageCache {
  const cachePath = path.join(distDir, CACHE_FILENAME)
  if (!fs.existsSync(cachePath)) {
    return emptyImageCache()
  }
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    if (raw && typeof raw === 'object' && raw.version === PACKAGE_VERSION) {
      const envelope = raw as ImageCacheEnvelope
      return { images: envelope.images ?? {}, files: envelope.files ?? {}, remote: envelope.remote ?? {} }
    }
    return emptyImageCache()
  } catch {
    return emptyImageCache()
  }
}

/** Write the image cache back to dist/ */
export function saveImageCache({ distDir, cache }: { distDir: string; cache: ImageCache }): void {
  const cachePath = path.join(distDir, CACHE_FILENAME)
  fs.mkdirSync(path.dirname(cachePath), { recursive: true })
  const envelope: ImageCacheEnvelope = { version: PACKAGE_VERSION, ...cache }
  fs.writeFileSync(cachePath, JSON.stringify(envelope))
}

/** Content SHA of a local file. Reads the file only when its size or mtime changed. */
export function localFileSha({ filePath, cache }: { filePath: string; cache: ImageCache }): string | undefined {
  let stat: fs.Stats
  try {
    stat = fs.statSync(filePath)
  } catch {
    return undefined
  }
  const known = cache.files[filePath]
  if (known && known.size === stat.size && known.mtimeMs === stat.mtimeMs) {
    return known.sha
  }
  const sha = gitBlobSha(fs.readFileSync(filePath))
  cache.files[filePath] = { size: stat.size, mtimeMs: stat.mtimeMs, sha }
  return sha
}

/**
 * Process a single image file — returns dimensions + placeholder.
 * Only reads the file and runs sharp when the cache has no entry for it.
 */
export async function processImage({
  filePath,
  cache,
}: {
  filePath: string
  cache: ImageCache
}): Promise<ImageMeta | undefined> {
  const sha = localFileSha({ filePath, cache })
  if (!sha) return undefined
  const cached = cache.images[sha]
  if (cached) return cached

  // SVGs are vector and load instantly — skip the rasterized placeholder
  // which would produce an ugly 16px pixelated WebP of crisp vector art.
  const meta = await readImageMeta({ buffer: fs.readFileSync(filePath), skipPlaceholder: filePath.endsWith('.svg') })
  if (meta) cache.images[sha] = meta
  return meta
}

/** Process a remote image. Downloads it only when the URL is not in the cache. */
export async function processRemoteImage({
  url,
  cache,
}: {
  url: string
  cache: ImageCache
}): Promise<ImageMeta | undefined> {
  const knownSha = cache.remote[url]
  const known = knownSha ? cache.images[knownSha] : undefined
  if (known) return known

  const buffer = await fetchRemoteImageBuffer(url)
  if (!buffer) return undefined
  const sha = gitBlobSha(buffer)
  const meta = cache.images[sha] ?? await readImageMeta({ buffer, skipPlaceholder: false })
  if (!meta) return undefined
  cache.images[sha] = meta
  cache.remote[url] = sha
  return meta
}

async function fetchRemoteImageBuffer(url: string): Promise<Buffer | undefined> {
  const response = await fetch(url, { signal: AbortSignal.timeout(REMOTE_IMAGE_TIMEOUT_MS) })
  if (!response.ok) {
    logger.warn(formatHolocronWarning(
      `failed to fetch remote image ${url}: HTTP ${response.status}`,
    ))
    return undefined
  }
  const contentType = response.headers.get('content-type')
  if (contentType && !contentType.startsWith('image/')) {
    logger.warn(formatHolocronWarning(
      `failed to fetch remote image ${url}: unexpected content-type "${contentType}"`,
    ))
    return undefined
  }
  return Buffer.from(await response.arrayBuffer())
}

async function readImageMeta({
  buffer,
  skipPlaceholder,
}: {
  buffer: Buffer
  skipPlaceholder: boolean
}): Promise<ImageMeta | undefined> {
  // Use sharp for both dimensions and placeholder generation so fixture
  // builds do not depend on a second image parser behaving identically
  // across local macOS and GitHub's Linux runners.
  const sharp = await import('sharp').then((m) => {
    return m.default
  })

  const metadata = await sharp(buffer).metadata()
  if (!metadata.width || !metadata.height) {
    return undefined
  }

  let placeholder = ''
  if (!skipPlaceholder) {
    const placeholderBuf = await sharp(buffer)
      .resize(PLACEHOLDER_WIDTH)
      .webp({ quality: 50 })
      .toBuffer()
    placeholder = `data:image/webp;base64,${placeholderBuf.toString('base64')}`
  }

  return { width: metadata.width, height: metadata.height, placeholder }
}

function gitBlobSha(buf: Buffer): string {
  return crypto
    .createHash('sha1')
    .update(`blob ${buf.length}\0`)
    .update(buf)
    .digest('hex')
}
