/**
 * Generated fallback logo route helpers + renderer backed by Takumi's ImageResponse.
 *
 * The font is referenced via `new URL(..., import.meta.url)` so Vite can emit
 * and rewrite it into production server output.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { ImageResponse } from 'takumi-js/response'
import type { HolocronConfig } from '../config.ts'

export type GeneratedLogoTheme = 'light' | 'dark'
export type ResolvedLogo = HolocronConfig['logo']

const DEFAULT_LOGO_TEXT = 'documentation'
const GENERATED_LOGO_ROUTE = '/holocron-api/logo'
const LIGHT_LOGO_COLOR = '#111111'
const DARK_LOGO_COLOR = '#ffffff'
const MIN_LOGO_WIDTH = 280
const MAX_LOGO_WIDTH = 960
const LOGO_WIDTH_PER_CHARACTER = 62
const LOGO_HEIGHT = 180

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

const FONT_FAMILY = 'Neug Asia Script Demo'
const fontUrl = new URL('../assets/neug-asia-script-demo.ttf', import.meta.url)
const FONT_ASSET_PREFIX = 'neug-asia-script-demo'
const isBuiltRuntime = import.meta.url.endsWith('.js')

let cachedFontData: Buffer | undefined

function findEmittedFontPath(searchDir: string): string | undefined {
  if (!fs.existsSync(searchDir)) return undefined
  const assetName = fs
    .readdirSync(searchDir)
    .find((entry) => entry.startsWith(FONT_ASSET_PREFIX) && entry.endsWith('.ttf'))
  return assetName ? path.join(searchDir, assetName) : undefined
}

function getFontPath(): string {
  const directFontPath = fileURLToPath(fontUrl)
  if (fs.existsSync(directFontPath)) return directFontPath

  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  const emittedFontPath =
    findEmittedFontPath(path.join(moduleDir, 'assets')) ||
    findEmittedFontPath(path.join(moduleDir, '../client/assets'))

  if (emittedFontPath) return emittedFontPath

  throw new Error(`Generated logo font not found at ${directFontPath}`)
}

function getFontData(): Buffer {
  cachedFontData ??= fs.readFileSync(getFontPath())
  return cachedFontData
}

function getTakumiModule() {
  if (!isBuiltRuntime) return undefined
  return import('@takumi-rs/wasm/vite').then((module) => module.default)
}

function getLogoSize(text: string): { width: number; height: number } {
  const textLength = Array.from(text).length
  return {
    width: Math.max(MIN_LOGO_WIDTH, Math.min(MAX_LOGO_WIDTH, Math.round(textLength * LOGO_WIDTH_PER_CHARACTER))),
    height: LOGO_HEIGHT,
  }
}

function GeneratedLogoTemplate({ text, theme }: GeneratedLogoOptions) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '14px 24px 28px',
        color: theme === 'dark' ? DARK_LOGO_COLOR : LIGHT_LOGO_COLOR,
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 112,
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </div>
    </div>
  )
}

export function createGeneratedLogoResponse(options: GeneratedLogoOptions): ImageResponse {
  const text = normalizeGeneratedLogoText(options.text)
  const { width, height } = getLogoSize(text)

  return new ImageResponse(<GeneratedLogoTemplate {...options} text={text} />, {
    width,
    height,
    format: 'png',
    module: getTakumiModule(),
    loadDefaultFonts: false,
    fonts: [
      {
        name: FONT_FAMILY,
        data: getFontData(),
        weight: 400,
        style: 'normal',
      },
    ],
  })
}
