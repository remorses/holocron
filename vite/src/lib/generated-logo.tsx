/**
 * Generated fallback logo route helpers + renderer backed by Takumi's ImageResponse.
 *
 * Uses Renderer.measure() to size the image to the exact text dimensions —
 * no padding, no character-count heuristics.
 */

import React from 'react'
import fontDataUrl from '../assets/neug-asia-script-demo.ttf?url&inline'
import type { HolocronConfig } from '../config.ts'

export type GeneratedLogoTheme = 'light' | 'dark'
export type ResolvedLogo = HolocronConfig['logo']

const DEFAULT_LOGO_TEXT = 'documentation'
const GENERATED_LOGO_ROUTE = '/holocron-api/logo'
const LIGHT_LOGO_COLOR = '#111111'
const DARK_LOGO_COLOR = '#ffffff'

export function normalizeGeneratedLogoText(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ').toLowerCase()
  return normalized || DEFAULT_LOGO_TEXT
}

export function getGeneratedLogoPath(text: string, theme: GeneratedLogoTheme): string {
  const normalized = normalizeGeneratedLogoText(text)
  return `${GENERATED_LOGO_ROUTE}/${theme}/${encodeURIComponent(normalized)}.png`
}

export function decodeGeneratedLogoText(textPath: string): string {
  const withoutExtension = textPath.replace(/\.png$/i, '')
  try {
    return normalizeGeneratedLogoText(decodeURIComponent(withoutExtension))
  } catch {
    return DEFAULT_LOGO_TEXT
  }
}

export function withBasePath(pathname: string, baseUrl: string): string {
  const base = baseUrl === '/' ? '' : baseUrl.replace(/\/$/, '')
  return `${base}${pathname}`
}

function getGeneratedLogoUrls(text: string, baseUrl: string): Pick<ResolvedLogo, 'light' | 'dark'> {
  return {
    light: withBasePath(getGeneratedLogoPath(text, 'light'), baseUrl),
    dark: withBasePath(getGeneratedLogoPath(text, 'dark'), baseUrl),
  }
}

export function resolveLogo(logo: ResolvedLogo, siteName: string, baseUrl: string): ResolvedLogo {
  if (logo.light) return logo
  return {
    ...getGeneratedLogoUrls(siteName, baseUrl),
    href: logo.href,
  }
}

export type GeneratedLogoOptions = {
  text: string
  theme: GeneratedLogoTheme
}

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
