/**
 * Server-side SVG resolver for canonical icon refs like `lucide:rocket` and
 * `fontawesome:brands:discord`.
 */

import { icons as lucideIcons } from '@iconify-json/lucide'
import { icons as fa6BrandsIcons } from '@iconify-json/fa6-brands'
import { icons as fa6RegularIcons } from '@iconify-json/fa6-regular'
import { icons as fa6SolidIcons } from '@iconify-json/fa6-solid'
import { FA_STYLES, type IconRef, type IconLibrary } from './collect-icons.ts'
import { formatHolocronWarning, logger } from './logger.ts'

export type IconAtlasEntry = {
  /** Inner SVG body (path/g/circle elements), NOT wrapped in <svg>. */
  body: string
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
const LUCIDE_STROKE_WIDTH = '3'

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

function parseIconRef(ref: IconRef): { library: IconLibrary; name: string; style?: string } | null {
  const parts = ref.split(':')
  if (parts.length === 2 && (parts[0] === 'lucide' || parts[0] === 'tabler') && parts[1]) {
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

export function resolveIconSvgs(refs: IconRef[]): IconResolveResult {
  const atlas: IconAtlas = { icons: {} }
  const unresolvedRefs: string[] = []

  for (const ref of refs) {
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
