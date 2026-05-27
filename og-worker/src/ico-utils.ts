/**
 * ICO-to-PNG extraction and data URL helpers for the OG image worker.
 *
 * Separated from index.tsx so these can be tested without importing
 * cloudflare:workers (which only resolves inside the Workers runtime).
 */

function isPngMagic(data: Uint8Array): boolean {
  return data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
}

/**
 * Extract the largest PNG image embedded inside an ICO container.
 *
 * ICO layout:
 *   [0..5]  header: reserved(2) + type(2, must be 1) + count(2)
 *   [6..]   directory entries, 16 bytes each:
 *           width(1) + height(1) + palette(1) + reserved(1) +
 *           planes(2) + bpp(2) + size(4) + offset(4)
 *   [offset..offset+size]  image data (PNG or BMP)
 *
 * An ICO can contain both BMP and PNG entries. We collect all valid
 * entries, sort by size descending, and return the first one with
 * PNG magic bytes. If none contain PNG data, returns undefined.
 */
export function extractPngFromIco(buf: ArrayBuffer): Uint8Array | undefined {
  const view = new DataView(buf)
  if (buf.byteLength < 6) return undefined
  const type = view.getUint16(2, true)
  if (type !== 1) return undefined // not an ICO
  const count = view.getUint16(4, true)
  if (count === 0 || buf.byteLength < 6 + count * 16) return undefined

  // collect all valid bounded entries, sorted largest-first
  const entries: { size: number; offset: number }[] = []
  for (let i = 0; i < count; i++) {
    const entryStart = 6 + i * 16
    const size = view.getUint32(entryStart + 8, true)
    const offset = view.getUint32(entryStart + 12, true)
    if (size === 0) continue
    if (offset > buf.byteLength || offset + size > buf.byteLength) continue
    entries.push({ size, offset })
  }
  entries.sort((a, b) => b.size - a.size)

  for (const entry of entries) {
    const data = new Uint8Array(buf, entry.offset, entry.size)
    if (isPngMagic(data)) return data
  }
  return undefined
}

export function bytesToBase64DataUrl(bytes: Uint8Array, contentType: string): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:${contentType};base64,${btoa(binary)}`
}

const ICO_CONTENT_TYPES = new Set([
  'image/vnd.microsoft.icon',
  'image/x-icon',
  'image/ico',
  'image/icon',
])

/**
 * Check if a fetched resource is an ICO file based on content-type
 * and URL. Handles case-insensitive MIME types, parameters like
 * `charset=binary`, query strings, and uppercase `.ICO` extensions.
 */
export function isIcoResponse(url: string, contentType: string): boolean {
  const mediaType = contentType.split(';', 1)[0]!.trim().toLowerCase()
  if (ICO_CONTENT_TYPES.has(mediaType)) return true

  try {
    return new URL(url).pathname.toLowerCase().endsWith('.ico')
  } catch {
    return url.toLowerCase().endsWith('.ico')
  }
}
