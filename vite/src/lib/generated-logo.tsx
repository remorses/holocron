/**
 * Generated fallback logo route helpers shared by site data and route parsing.
 */

import type { HolocronConfig } from '../config.ts'

export type GeneratedLogoTheme = 'light' | 'dark'
export type ResolvedLogo = HolocronConfig['logo']

const DEFAULT_LOGO_TEXT = 'documentation'
const GENERATED_LOGO_ROUTE = '/holocron-api/logo'
export const LIGHT_LOGO_COLOR = '#111111'
export const DARK_LOGO_COLOR = '#ffffff'

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

export function resolveLogo(logo: ResolvedLogo, siteName: string, baseUrl: string): ResolvedLogo {
  if (logo.light) return logo
  return {
    light: withBasePath(getGeneratedLogoPath(siteName, 'light'), baseUrl),
    dark: withBasePath(getGeneratedLogoPath(siteName, 'dark'), baseUrl),
    href: logo.href,
  }
}

export type GeneratedLogoOptions = {
  text: string
  theme: GeneratedLogoTheme
}
