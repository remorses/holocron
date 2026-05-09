/**
 * Takumi-backed renderer for generated fallback logo PNGs.
 *
 * Runs inside the og-worker Cloudflare Worker, separate from the main
 * holocron website worker. Uses WASM renderer since Node.js is not
 * available in Cloudflare Workers.
 */

import React from 'react'
import fontDataBuffer from './assets/bagnard.otf'

export type GeneratedLogoTheme = 'light' | 'dark'

export type GeneratedLogoOptions = {
  text: string
  theme: GeneratedLogoTheme
}

const LIGHT_LOGO_COLOR = '#111111'
const DARK_LOGO_COLOR = '#ffffff'

const FONT_FAMILY = 'Bagnard'
const FONT_WEIGHT = 400
const FONT_SIZE = 72
const fontData = Promise.resolve(fontDataBuffer)

function normalizeGeneratedLogoText(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ').toLowerCase()
  return normalized || 'documentation'
}

type RendererInstance =
  | InstanceType<Awaited<typeof import('takumi-js/node')>['Renderer']>
  | InstanceType<Awaited<typeof import('takumi-js/wasm')>['Renderer']>

let cachedRenderer: RendererInstance | undefined

async function getRenderer(): Promise<RendererInstance> {
  if (!cachedRenderer) {
    try {
      const { Renderer } = await import('takumi-js/node')
      cachedRenderer = new Renderer()
    } catch {
      const { default: wasm, init, Renderer } = await import('takumi-js/wasm')
      await init({ module_or_path: wasm })
      cachedRenderer = new Renderer()
    }
  }
  return cachedRenderer
}

const fontConfig: {
  name: string
  data: () => Promise<ArrayBuffer>
  weight: number
  style: 'normal'
} = {
  name: FONT_FAMILY,
  data: () => fontData,
  weight: FONT_WEIGHT,
  style: 'normal',
}

async function measureTextSize(text: string): Promise<{ width: number; height: number }> {
  const renderer = await getRenderer()
  await renderer.loadFont(fontConfig)
  const { fromJsx } = await import('takumi-js/helpers/jsx')

  const { node, stylesheets } = await fromJsx(
    <span style={{ fontFamily: FONT_FAMILY, fontSize: FONT_SIZE, fontWeight: FONT_WEIGHT, lineHeight: 1, whiteSpace: 'nowrap' }}>
      {text}
    </span>,
  )

  const measured = await renderer.measure(node, { stylesheets })
  return { width: Math.ceil(measured.width), height: Math.ceil(measured.height) }
}

function GeneratedLogoTemplate({ text, theme }: GeneratedLogoOptions) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        color: theme === 'dark' ? DARK_LOGO_COLOR : LIGHT_LOGO_COLOR,
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZE,
        fontWeight: FONT_WEIGHT,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  )
}

export async function createGeneratedLogoResponse(options: GeneratedLogoOptions) {
  const text = normalizeGeneratedLogoText(options.text)
  const { width, height } = await measureTextSize(text)
  const { ImageResponse } = await import('takumi-js/response')

  return new ImageResponse(<GeneratedLogoTemplate {...options} text={text} />, {
    width,
    height,
    format: 'png',
    loadDefaultFonts: false,
    fonts: [
      {
        name: FONT_FAMILY,
        data: () => fontData,
        weight: FONT_WEIGHT,
        style: 'normal',
      },
    ],
  })
}
