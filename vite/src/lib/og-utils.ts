/**
 * OG image URL helpers shared by the page metadata path and OG routes.
 */

import type { HolocronConfig } from '../config.ts'

type OgConfigImageFields = Pick<HolocronConfig, 'favicon' | 'logo'>

function toAbsoluteUrl(pathOrUrl: string | undefined, requestUrl: string): string | undefined {
  if (!pathOrUrl) return undefined
  return new URL(pathOrUrl, requestUrl).toString()
}

export function getOgPath(pageHref: string): string {
  if (pageHref === '/' || pageHref === '') return '/og'
  return `/og${pageHref}`
}

export function getAbsoluteOgImageUrl(requestUrl: string, base: string, pageHref: string): string {
  return new URL(`${base}${getOgPath(pageHref)}`, requestUrl).toString()
}

export function resolveOgIconUrl(config: OgConfigImageFields, requestUrl: string): string | undefined {
  return toAbsoluteUrl(config.favicon.light || config.favicon.dark, requestUrl)
}
