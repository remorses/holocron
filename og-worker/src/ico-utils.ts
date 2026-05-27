/**
 * ICO-to-PNG extraction and data URL helpers for the OG image worker.
 *
 * Separated from index.tsx so these can be tested without importing
 * cloudflare:workers (which only resolves inside the Workers runtime).
 */

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
 * Modern favicons almost always embed PNG data. If the largest entry
 * is BMP (no PNG magic bytes) we return undefined and the OG image
 * renders without an icon instead of reserving invisible space.
 */
export function extractPngFromIco(buf: ArrayBuffer): Uint8Array | undefined {
  const view = new DataView(buf)
  if (buf.byteLength < 6) return undefined
  const type = view.getUint16(2, true)
  if (type !== 1) return undefined // not an ICO
  const count = view.getUint16(4, true)
  if (count === 0 || buf.byteLength < 6 + count * 16) return undefined

  // find the largest embedded image by byte size
  let bestSize = 0
  let bestOffset = 0
  for (let i = 0; i < count; i++) {
    const entryStart = 6 + i * 16
    const size = view.getUint32(entryStart + 8, true)
    const offset = view.getUint32(entryStart + 12, true)
    if (size > bestSize) {
      bestSize = size
      bestOffset = offset
    }
  }
  if (bestSize === 0 || bestOffset + bestSize > buf.byteLength) return undefined

  const data = new Uint8Array(buf, bestOffset, bestSize)
  // PNG magic: 89 50 4E 47
  if (data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4e || data[3] !== 0x47) {
    return undefined // BMP payload, not supported by takumi
  }
  return data
}

export function bytesToBase64DataUrl(bytes: Uint8Array, contentType: string): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:${contentType};base64,${btoa(binary)}`
}

export const ICO_CONTENT_TYPES = new Set(['image/vnd.microsoft.icon', 'image/x-icon'])
