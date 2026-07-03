/**
 * Pure-TS video dimension probing for imageboard tabs.
 *
 * Reads pixel width/height from container headers without ffmpeg:
 *   - MP4 / MOV / M4V — ISO BMFF box walk: moov → trak → tkhd. The file is
 *     never read fully; only box headers are read until `moov` is found,
 *     then the (small) moov payload is loaded and walked in memory. Works
 *     for both faststart (moov first) and non-faststart (moov last) files.
 *   - WebM / MKV — minimal EBML walk: Segment → Tracks → TrackEntry →
 *     Video → PixelWidth/PixelHeight. Only the first 4 MiB are scanned;
 *     Tracks metadata lives near the start in practice.
 *
 * Returns undefined when the container can't be parsed — callers render
 * the video without a fixed aspect ratio in that case.
 */

import fs from 'node:fs'

export type VideoDimensions = { width: number; height: number }

const VIDEO_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov', '.webm', '.mkv'])

export function isVideoExtension(ext: string): boolean {
  return VIDEO_EXTENSIONS.has(ext.toLowerCase())
}

/** Probe a video file's pixel dimensions from its container header. */
export function probeVideoDimensions(filePath: string): VideoDimensions | undefined {
  const lower = filePath.toLowerCase()
  try {
    if (lower.endsWith('.webm') || lower.endsWith('.mkv')) {
      return probeEbml(filePath)
    }
    return probeIsoBmff(filePath)
  } catch {
    return undefined
  }
}

/* ── ISO BMFF (mp4/mov/m4v) ──────────────────────────────────────────── */

function probeIsoBmff(filePath: string): VideoDimensions | undefined {
  const fd = fs.openSync(filePath, 'r')
  try {
    const fileSize = fs.fstatSync(fd).size
    let offset = 0
    while (offset + 8 <= fileSize) {
      const header = Buffer.alloc(16)
      fs.readSync(fd, header, 0, 16, offset)
      let boxSize = header.readUInt32BE(0)
      const type = header.toString('latin1', 4, 8)
      let payloadStart = offset + 8
      if (boxSize === 1) {
        // 64-bit largesize follows the type
        const large = header.readBigUInt64BE(8)
        if (large > BigInt(Number.MAX_SAFE_INTEGER)) return undefined
        boxSize = Number(large)
        payloadStart = offset + 16
      } else if (boxSize === 0) {
        // box extends to end of file
        boxSize = fileSize - offset
      }
      if (boxSize < 8) return undefined

      if (type === 'moov') {
        const payloadSize = offset + boxSize - payloadStart
        // moov is metadata-only and small (KBs to a few MBs). Cap defensively.
        if (payloadSize <= 0 || payloadSize > 64 * 1024 * 1024) return undefined
        const moov = Buffer.alloc(payloadSize)
        fs.readSync(fd, moov, 0, payloadSize, payloadStart)
        return findTkhdDimensions(moov)
      }
      offset += boxSize
    }
    return undefined
  } finally {
    fs.closeSync(fd)
  }
}

/** Walk an in-memory box payload for trak → tkhd and read width/height. */
function findTkhdDimensions(buf: Buffer): VideoDimensions | undefined {
  for (const trak of childBoxes(buf, 'trak')) {
    for (const tkhd of childBoxes(trak, 'tkhd')) {
      const version = tkhd.readUInt8(0)
      // tkhd payload layout: width/height are the last 8 bytes,
      // 16.16 fixed-point. version 0 payload = 84 bytes, version 1 = 96.
      const base = version === 1 ? 88 : 76
      if (tkhd.length < base + 8) continue
      const width = tkhd.readUInt32BE(base) / 65536
      const height = tkhd.readUInt32BE(base + 4) / 65536
      // Audio tracks have 0×0 — skip and keep looking.
      if (width > 0 && height > 0) {
        return { width: Math.round(width), height: Math.round(height) }
      }
    }
  }
  return undefined
}

/** Iterate direct child boxes of the given type, yielding their payloads. */
function* childBoxes(buf: Buffer, type: string): Generator<Buffer> {
  let offset = 0
  while (offset + 8 <= buf.length) {
    let size = buf.readUInt32BE(offset)
    const boxType = buf.toString('latin1', offset + 4, offset + 8)
    let payloadStart = offset + 8
    if (size === 1) {
      if (offset + 16 > buf.length) return
      const large = buf.readBigUInt64BE(offset + 8)
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return
      size = Number(large)
      payloadStart = offset + 16
    } else if (size === 0) {
      size = buf.length - offset
    }
    if (size < 8 || offset + size > buf.length) return
    if (boxType === type) {
      yield buf.subarray(payloadStart, offset + size)
    }
    offset += size
  }
}

/* ── EBML (webm/mkv) ─────────────────────────────────────────────────── */

const EBML_SCAN_LIMIT = 4 * 1024 * 1024

const SEGMENT_ID = 0x18538067
const TRACKS_ID = 0x1654ae6b
const TRACK_ENTRY_ID = 0xae
const VIDEO_ID = 0xe0
const PIXEL_WIDTH_ID = 0xb0
const PIXEL_HEIGHT_ID = 0xba

function probeEbml(filePath: string): VideoDimensions | undefined {
  const fd = fs.openSync(filePath, 'r')
  let buf: Buffer
  try {
    const size = Math.min(fs.fstatSync(fd).size, EBML_SCAN_LIMIT)
    buf = Buffer.alloc(size)
    fs.readSync(fd, buf, 0, size, 0)
  } finally {
    fs.closeSync(fd)
  }
  return ebmlFind({ buf, start: 0, end: buf.length, idPath: [SEGMENT_ID, TRACKS_ID, TRACK_ENTRY_ID, VIDEO_ID] })
}

/** Recursively descend the given container-ID path, then read pixel dims. */
function ebmlFind({ buf, start, end, idPath }: { buf: Buffer; start: number; end: number; idPath: number[] }): VideoDimensions | undefined {
  const [targetId, ...rest] = idPath
  let offset = start
  while (offset < end) {
    const id = readEbmlId(buf, offset)
    if (!id) return undefined
    const size = readEbmlVint(buf, offset + id.length)
    if (!size) return undefined
    const payloadStart = offset + id.length + size.length
    // Unknown-size elements (all VINT_DATA bits set) extend to the parent's end.
    const payloadEnd = size.unknown ? end : Math.min(payloadStart + size.value, end)

    if (id.value === targetId) {
      if (rest.length > 0) {
        const found = ebmlFind({ buf, start: payloadStart, end: payloadEnd, idPath: rest })
        if (found) return found
        // TrackEntry for audio has no Video element — keep scanning siblings.
      } else {
        const dims = readPixelDimensions({ buf, start: payloadStart, end: payloadEnd })
        if (dims) return dims
      }
    }
    if (size.unknown) {
      // Can't skip an unknown-size element we didn't descend into.
      return undefined
    }
    offset = payloadEnd
  }
  return undefined
}

/** Read PixelWidth/PixelHeight uints inside a Video element. */
function readPixelDimensions({ buf, start, end }: { buf: Buffer; start: number; end: number }): VideoDimensions | undefined {
  let width = 0
  let height = 0
  let offset = start
  while (offset < end && !(width && height)) {
    const id = readEbmlId(buf, offset)
    if (!id) return undefined
    const size = readEbmlVint(buf, offset + id.length)
    if (!size || size.unknown) return undefined
    const payloadStart = offset + id.length + size.length
    const payloadEnd = payloadStart + size.value
    if (payloadEnd > end) return undefined
    if (id.value === PIXEL_WIDTH_ID) width = readEbmlUint({ buf, offset: payloadStart, length: size.value })
    if (id.value === PIXEL_HEIGHT_ID) height = readEbmlUint({ buf, offset: payloadStart, length: size.value })
    offset = payloadEnd
  }
  return width && height ? { width, height } : undefined
}

/** EBML element IDs keep the length-marker bit, unlike sizes. */
function readEbmlId(buf: Buffer, offset: number): { value: number; length: number } | undefined {
  if (offset >= buf.length) return undefined
  const first = buf[offset]!
  const length = ebmlVintLength(first)
  if (!length || length > 4 || offset + length > buf.length) return undefined
  let value = 0
  for (let i = 0; i < length; i++) {
    value = value * 256 + buf[offset + i]!
  }
  return { value, length }
}

/** EBML sizes strip the length-marker bit. All-ones data means "unknown". */
function readEbmlVint(buf: Buffer, offset: number): { value: number; length: number; unknown: boolean } | undefined {
  if (offset >= buf.length) return undefined
  const first = buf[offset]!
  const length = ebmlVintLength(first)
  if (!length || length > 8 || offset + length > buf.length) return undefined
  let value = first & (0xff >> length)
  let allOnes = value === 0xff >> length
  for (let i = 1; i < length; i++) {
    const byte = buf[offset + i]!
    if (byte !== 0xff) allOnes = false
    value = value * 256 + byte
  }
  return { value, length, unknown: allOnes }
}

function ebmlVintLength(firstByte: number): number {
  for (let i = 0; i < 8; i++) {
    if (firstByte & (0x80 >> i)) return i + 1
  }
  return 0
}

function readEbmlUint({ buf, offset, length }: { buf: Buffer; offset: number; length: number }): number {
  let value = 0
  for (let i = 0; i < length; i++) {
    value = value * 256 + buf[offset + i]!
  }
  return value
}
