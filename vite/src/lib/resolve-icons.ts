/**
 * Server-side SVG resolver for canonical icon refs like `lucide:rocket` and
 * `fontawesome:brands:discord`.
 *
 * Plugin / generateHolocronData only. Do not import this from RSC code —
 * the Iconify packs are ~2 MB and would land in the worker bundle.
 */

import { icons as lucideIcons } from '@iconify-json/lucide'
import { icons as fa6BrandsIcons } from '@iconify-json/fa6-brands'
import { icons as fa6RegularIcons } from '@iconify-json/fa6-regular'
import { icons as fa6SolidIcons } from '@iconify-json/fa6-solid'
import fs from 'node:fs'
import path from 'node:path'
import { FA_STYLES, isLocalSvgIcon, type IconRef, type IconLibrary } from './collect-icons.ts'
import { formatHolocronError, formatHolocronWarning, logger } from './logger.ts'

export type IconAtlasEntry = {
  /** Inner SVG body (path/g/circle elements), NOT wrapped in <svg>. */
  body: string
  /** viewBox origin x. Lucide icons omit this (treated as 0). */
  left?: number
  /** viewBox origin y. Lucide icons omit this (treated as 0). */
  top?: number
  /** viewBox width (lucide = 24). */
  width: number
  /** viewBox height (lucide = 24). */
  height: number
}

export type IconAtlas = {
  icons: Record<string, IconAtlasEntry>
}

const LUCIDE_DEFAULT_WIDTH = 24
const LUCIDE_DEFAULT_HEIGHT = 24
const FA_DEFAULT_WIDTH = 512
const FA_DEFAULT_HEIGHT = 512

const FONT_AWESOME_SETS = {
  brands: fa6BrandsIcons,
  regular: fa6RegularIcons,
  solid: fa6SolidIcons,
} as const

type FontAwesomeStyle = keyof typeof FONT_AWESOME_SETS

/** Lucide default stroke-width is 2 in a 24×24 viewBox. At small render
 *  sizes (12–14px in sidebar/tabs) this produces very thin 1px strokes.
 *  Bumping to 2.5 keeps the icon legible without looking heavy. */
const LUCIDE_STROKE_WIDTH = '2.5'

function resolveLucide(name: string): IconAtlasEntry | null {
  // Aliases like `home` → `house` — resolve before the lookup.
  const parent = lucideIcons.aliases?.[name]?.parent
  const key = parent ?? name
  const icon = lucideIcons.icons[key]
  if (!icon) return null
  return {
    body: icon.body.replace(/stroke-width="2"/g, `stroke-width="${LUCIDE_STROKE_WIDTH}"`),
    width: lucideIcons.width ?? LUCIDE_DEFAULT_WIDTH,
    height: lucideIcons.height ?? LUCIDE_DEFAULT_HEIGHT,
  }
}

function resolveFontAwesome(name: string, style?: string): IconAtlasEntry | null {
  const sets = (() => {
    if (!style) return [fa6SolidIcons, fa6BrandsIcons, fa6RegularIcons]
    const set = Object.hasOwn(FONT_AWESOME_SETS, style)
      ? FONT_AWESOME_SETS[style as FontAwesomeStyle]
      : undefined
    return set ? [set] : []
  })()

  for (const set of sets) {
    const icon = set.icons[name]
    if (!icon) continue
    return {
      body: icon.body,
      // Font Awesome icons can override the pack-level box width. Using only
      // the set defaults clips wide glyphs like `discord` and `user-plus`.
      width: icon.width ?? set.width ?? FA_DEFAULT_WIDTH,
      height: icon.height ?? set.height ?? FA_DEFAULT_HEIGHT,
    }
  }

  return null
}

const UNSAFE_SVG = /<script\b|<foreignObject\b|<iframe\b|<object\b|<embed\b|<style\b|<image\b|\bon[a-z]+\s*=|javascript:/i

function parseViewBox(svg: string): { left: number; top: number; width: number; height: number } | null {
  const viewBox = svg.match(/\bviewBox\s*=\s*["']\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*["']/i)
  if (viewBox) {
    const left = Number(viewBox[1])
    const top = Number(viewBox[2])
    const width = Number(viewBox[3])
    const height = Number(viewBox[4])
    if ([left, top, width, height].every(Number.isFinite) && width > 0 && height > 0) {
      return { left, top, width, height }
    }
  }
  const widthAttr = Number(svg.match(/\bwidth\s*=\s*["']?\s*([-\d.]+)/i)?.[1])
  const heightAttr = Number(svg.match(/\bheight\s*=\s*["']?\s*([-\d.]+)/i)?.[1])
  if (Number.isFinite(widthAttr) && Number.isFinite(heightAttr) && widthAttr > 0 && heightAttr > 0) {
    return { left: 0, top: 0, width: widthAttr, height: heightAttr }
  }
  return null
}

function innerSvgMarkup(svg: string): string {
  const match = svg.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i)
  return (match?.[1] ?? svg).trim()
}

function openingSvgTag(svg: string): string {
  return svg.match(/<svg\b[^>]*>/i)?.[0] ?? ''
}

function rewriteCurrentColor(markup: string): string {
  return markup
    .replace(/\sfill=(["'])(?!none\1)[^"']*\1/gi, ' fill="currentColor"')
    .replace(/\sstroke=(["'])(?!none\1)[^"']*\1/gi, ' stroke="currentColor"')
}

function wrapRootPaint(openTag: string, body: string): string {
  const fill = /\bfill=(["'])(?!none\1)[^"']*\1/i.test(openTag)
  const stroke = /\bstroke=(["'])(?!none\1)[^"']*\1/i.test(openTag)
  if (!fill && !stroke) return body
  const attrs = [
    fill ? 'fill="currentColor"' : null,
    stroke ? 'stroke="currentColor"' : null,
  ].filter(Boolean).join(' ')
  return `<g ${attrs}>${body}</g>`
}

export function parseLocalSvgIcon(svg: string): IconAtlasEntry | null {
  const trimmed = svg.trim()
  if (!trimmed || UNSAFE_SVG.test(trimmed)) return null
  const box = parseViewBox(trimmed) ?? { left: 0, top: 0, width: LUCIDE_DEFAULT_WIDTH, height: LUCIDE_DEFAULT_HEIGHT }
  const body = wrapRootPaint(openingSvgTag(trimmed), rewriteCurrentColor(innerSvgMarkup(trimmed)))
  if (!body) return null
  return {
    body,
    ...(box.left !== 0 ? { left: box.left } : {}),
    ...(box.top !== 0 ? { top: box.top } : {}),
    width: box.width,
    height: box.height,
  }
}

function isInsideDir(filePath: string, dir: string): boolean {
  const relative = path.relative(dir, filePath)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function candidateSvgPath(pathPart: string, dir: string): string | null {
  const filePath = pathPart.startsWith('/')
    ? path.resolve(dir, pathPart.slice(1))
    : path.resolve(dir, pathPart)
  if (!isInsideDir(filePath, dir)) return null
  return filePath
}

function resolveLocalSvgFile(ref: IconRef, dirs: string[]): IconAtlasEntry | null {
  const pathPart = ref.split(/[?#]/, 1)[0]!
  for (const dir of dirs) {
    const filePath = candidateSvgPath(pathPart, dir)
    if (!filePath || !fs.existsSync(filePath)) continue
    try {
      const realDir = fs.realpathSync(dir)
      const realFile = fs.realpathSync(filePath)
      if (!isInsideDir(realFile, realDir)) continue
      return parseLocalSvgIcon(fs.readFileSync(realFile, 'utf8'))
    } catch {
      return null
    }
  }
  return null
}

function parseIconRef(ref: IconRef): { library: IconLibrary; name: string; style?: string } | null {
  const parts = ref.split(':')
  if (parts.length === 2 && parts[0] === 'lucide' && parts[1]) {
    return { library: parts[0], name: parts[1] }
  }
  if (parts.length === 2 && parts[0] === 'fontawesome' && parts[1]) {
    return { library: 'fontawesome', name: parts[1] }
  }
  if (parts.length === 3 && parts[0] === 'fontawesome' && parts[1] && parts[2] && FA_STYLES.has(parts[1])) {
    return { library: 'fontawesome', style: parts[1], name: parts[2] }
  }
  return null
}

export type IconResolveResult = {
  atlas: IconAtlas
  /** Number of icon refs that could not be resolved. */
  unresolvedCount: number
  /** The icon ref strings that failed to resolve, for error reporting. */
  unresolvedRefs: string[]
}

export function resolveIconSvgs(refs: IconRef[], dirs: string[] = []): IconResolveResult {
  const atlas: IconAtlas = { icons: {} }
  const unresolvedRefs: string[] = []

  for (const ref of refs) {
    if (isLocalSvgIcon(ref)) {
      const entry = resolveLocalSvgFile(ref, dirs)
      if (!entry) {
        logger.error(formatHolocronError(`local SVG icon "${ref}" not found.`))
        unresolvedRefs.push(ref)
        continue
      }
      atlas.icons[ref] = entry
      continue
    }

    const parsed = parseIconRef(ref)
    if (!parsed) {
      logger.warn(formatHolocronWarning(`icon ref "${ref}" is not a supported canonical icon ref.`))
      unresolvedRefs.push(ref)
      continue
    }

    if (parsed.library === 'lucide') {
      const entry = resolveLucide(parsed.name)
      if (!entry) {
        logger.warn(formatHolocronWarning(`lucide icon "${parsed.name}" not found. Check the icon name at https://lucide.dev/icons/.`))
        unresolvedRefs.push(ref)
        continue
      }
      atlas.icons[ref] = entry
      continue
    }

    if (parsed.library === 'fontawesome') {
      const entry = resolveFontAwesome(parsed.name, parsed.style)
      if (!entry) {
        logger.warn(formatHolocronWarning(`fontawesome icon "${parsed.name}"${parsed.style ? ` (${parsed.style})` : ''} not found.`))
        unresolvedRefs.push(ref)
        continue
      }
      atlas.icons[ref] = entry
      continue
    }

    logger.warn(formatHolocronWarning(`icon library "${parsed.library}" is not supported yet. Icon "${parsed.name}" will render empty.`))
    unresolvedRefs.push(ref)
  }
  return { atlas, unresolvedCount: unresolvedRefs.length, unresolvedRefs }
}
