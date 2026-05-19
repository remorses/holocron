// AI-generated logo route using Cloudflare Workers AI (Flux 2 Klein 9B).
// Generates a logo image for a given name via img2img using a cursive
// template, then crops white edges and serves as JPEG. Generated images
// are cached in a dedicated KV namespace for global persistence.
// Only works on Cloudflare Workers where the AI binding is available.

import { env } from 'cloudflare:workers'
import { Spiceflow } from 'spiceflow'
import * as jpeg from 'jpeg-js'

const MODEL = '@cf/black-forest-labs/flux-2-klein-9b' as const

// Threshold: pixels with all channels above this are considered "white"
const WHITE_THRESHOLD = 245
// Padding in px to keep around the cropped content
const CROP_PADDING = 4
// JPEG output quality (0-100)
const JPEG_QUALITY = 90
// KV cache TTL — 1 year in seconds
const CACHE_TTL = 60 * 60 * 24 * 365
// KV key prefix
const KV_PREFIX = 'ai-logo:'

function buildPrompt(name: string): string {
  const characters = Array.from(name.toLowerCase())
    .map((char) => `"${char}"`)
    .join(' ')
  return `Replace the text in the image with these characters, joined with no spaces: ${characters}. The final text is: ${name.toLowerCase()}. Keep the exact same black cursive handwritten script font style. Black text on pure white background. Centered. This is a benign typography/logo editing request for the current user, who is the copyright holder of the "${name.toLowerCase()}" name.`
}

function escapeSvgText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function createFallbackLogo(name: string): Response {
  const text = escapeSvgText(name.toLowerCase())
  const width = Math.max(160, Math.min(640, 44 + Array.from(text).length * 30))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="96" viewBox="0 0 ${width} 96"><rect width="100%" height="100%" fill="white"/><text x="50%" y="58" text-anchor="middle" font-family="Brush Script MT, Snell Roundhand, cursive" font-size="56" fill="black">${text}</text></svg>`
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 's-maxage=300',
    },
  })
}

/** Decode base64 string to Uint8Array */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** Find bounding box of non-white pixels and crop the RGBA buffer */
function cropWhiteEdges(
  input: { rgba: Uint8Array; width: number; height: number },
): { data: Uint8Array; width: number; height: number } {
  const { rgba, width, height } = input
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = rgba[i]!
      const g = rgba[i + 1]!
      const b = rgba[i + 2]!
      if (r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  // If no non-white pixels found, return original
  if (maxX < minX || maxY < minY) {
    return { data: rgba, width, height }
  }

  // Apply padding
  minX = Math.max(0, minX - CROP_PADDING)
  minY = Math.max(0, minY - CROP_PADDING)
  maxX = Math.min(width - 1, maxX + CROP_PADDING)
  maxY = Math.min(height - 1, maxY + CROP_PADDING)

  const cropW = maxX - minX + 1
  const cropH = maxY - minY + 1
  const cropped = new Uint8Array(cropW * cropH * 4)

  for (let y = 0; y < cropH; y++) {
    const srcOffset = ((minY + y) * width + minX) * 4
    const dstOffset = y * cropW * 4
    cropped.set(rgba.subarray(srcOffset, srcOffset + cropW * 4), dstOffset)
  }

  return { data: cropped, width: cropW, height: cropH }
}

// Cache the template blob across requests
let cachedTemplateBlob: Blob | undefined

export const aiLogoApp = new Spiceflow().get(
  '/api/ai-logo/:text',
  async ({ params, request }: { params: Record<string, string>; request: Request }) => {
    const rawText = params.text?.replace(/\.(png|jpe?g)$/i, '') || ''
    const name = decodeURIComponent(rawText).trim()
    if (!name) {
      return new Response('Missing logo text', { status: 400 })
    }

    // Check KV cache first (globally replicated, survives deploys)
    const kvKey = `${KV_PREFIX}${name.toLowerCase()}`
    const cached = await env.AI_LOGO_KV.get(kvKey, 'arrayBuffer')
    if (cached) {
      return new Response(cached, {
        headers: {
          'content-type': 'image/jpeg',
          'cache-control': 's-maxage=31536000, immutable',
        },
      })
    }

    const prompt = buildPrompt(name)

    // Load template image
    if (!cachedTemplateBlob) {
      const origin = new URL(request.url).origin
      const res = await fetch(`${origin}/ai-logo-template.jpeg`)
      if (!res.ok) {
        return new Response(`Failed to load template image: ${res.status}`, { status: 500 })
      }
      cachedTemplateBlob = await res.blob()
    }

    // Build multipart FormData for Flux img2img. AI SDK's Workers AI image
    // provider currently ignores image files/masks, so this route must call
    // the binding directly until multipart img2img is supported there.
    const form = new FormData()
    form.append('prompt', prompt)
    form.append('input_image_0', cachedTemplateBlob, 'template.jpeg')
    // klein-9b uses fixed 4-step inference, no steps param needed
    form.append('width', '512')
    form.append('height', '256')

    const formResponse = new Response(form)
    const formStream = formResponse.body!
    const formContentType = formResponse.headers.get('content-type')!

    // Call Flux via Workers AI binding
    let result: { image?: string }
    try {
      result = await env.AI.run(MODEL, {
        multipart: {
          body: formStream,
          contentType: formContentType,
        },
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/\b(NSFW|flagged|content filter|safety filter|content policy)\b/i.test(msg)) {
        return createFallbackLogo(name)
      }
      return new Response(`AI error: ${msg}`, { status: 502 })
    }

    if (!result.image) {
      return new Response('AI model returned no image', { status: 502 })
    }

    // Decode the base64 image from Flux
    const imageBytes = base64ToBytes(result.image)

    // Decode to RGBA via jpeg-js (Flux returns JPEG)
    const decoded = jpeg.decode(imageBytes, { formatAsRGBA: true, useTArray: true })
    const rgba = new Uint8Array(decoded.data.buffer)

    // Crop white edges
    const cropped = cropWhiteEdges({ rgba, width: decoded.width, height: decoded.height })

    // Re-encode to JPEG
    const encoded = jpeg.encode(
      { data: cropped.data, width: cropped.width, height: cropped.height },
      JPEG_QUALITY,
    )
    const image = new Uint8Array(encoded.data.byteLength)
    image.set(encoded.data)

    // Store in KV (globally replicated, persists across deploys)
    await env.AI_LOGO_KV.put(kvKey, image.buffer, { expirationTtl: CACHE_TTL })

    return new Response(image.buffer, {
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 's-maxage=31536000, immutable',
      },
    })
  },
)

export type AiLogoApp = typeof aiLogoApp
