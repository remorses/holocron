/**
 * Server-only Takumi renderer for generated fallback logo PNGs.
 */

import React from 'react'
import fontDataUrl from '../assets/neug-asia-script-demo.ttf?url&inline'
import { DARK_LOGO_COLOR, LIGHT_LOGO_COLOR, normalizeGeneratedLogoText, type GeneratedLogoOptions } from './generated-logo.tsx'

type RendererInstance = InstanceType<Awaited<typeof import('takumi-js/node')>['Renderer']>

const FONT_FAMILY = 'Neug Asia Script Demo'
const FONT_SIZE = 72

let cachedFontData: Promise<ArrayBuffer> | undefined

function getFontData(): Promise<ArrayBuffer> {
  cachedFontData ??= fetch(fontDataUrl).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load generated logo font: ${response.status} ${response.statusText}`)
    }
    return response.arrayBuffer()
  })
  return cachedFontData
}

let cachedRenderer: RendererInstance | undefined

async function getRenderer(): Promise<RendererInstance> {
  if (!cachedRenderer) {
    const { Renderer } = await import('takumi-js/node')
    cachedRenderer = new Renderer()
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
  data: getFontData,
  weight: 700,
  style: 'normal',
}

async function measureTextSize(text: string): Promise<{ width: number; height: number }> {
  const renderer = await getRenderer()
  await renderer.loadFont(fontConfig)
  const { fromJsx } = await import('takumi-js/helpers/jsx')

  const { node, stylesheets } = await fromJsx(
    <span style={{ fontFamily: FONT_FAMILY, fontSize: FONT_SIZE, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>
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
        fontWeight: 700,
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
        data: getFontData,
        weight: 700,
        style: 'normal',
      },
    ],
  })
}
