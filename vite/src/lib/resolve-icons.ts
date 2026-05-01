/**
 * Server-side SVG resolver for canonical icon refs like `lucide:rocket` and
 * `fontawesome:brands:discord`.
 */

import { icons as lucideIcons } from '@iconify-json/lucide'
import { icons as fa6BrandsIcons } from '@iconify-json/fa6-brands'
import { icons as fa6RegularIcons } from '@iconify-json/fa6-regular'
import { icons as fa6SolidIcons } from '@iconify-json/fa6-solid'
import { FA_STYLES, type IconRef, type IconLibrary } from './collect-icons.ts'
import { formatHolocronWarning, holocronLogger } from './logger.ts'

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

function resolveLucide(name: string): IconAtlasEntry | null {
  // Aliases like `home` → `house` — resolve before the lookup.
  const parent = lucideIcons.aliases?.[name]?.parent
  const key = parent ?? name
  const icon = lucideIcons.icons[key]
  if (!icon) return null
  return {
    body: icon.body,
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

export function resolveIconSvgs(refs: IconRef[]): IconAtlas {
  const atlas: IconAtlas = { icons: {} }

  for (const ref of refs) {
    const parsed = parseIconRef(ref)
    if (!parsed) {
      holocronLogger.warn(formatHolocronWarning(`icon ref "${ref}" is not a supported canonical icon ref.`))
      continue
    }

    if (parsed.library === 'lucide') {
      const entry = resolveLucide(parsed.name)
      if (!entry) {
        holocronLogger.warn(formatHolocronWarning(`lucide icon "${parsed.name}" not found. Check the icon name at https://lucide.dev/icons/.`))
        continue
      }
      atlas.icons[ref] = entry
      continue
    }

    if (parsed.library === 'fontawesome') {
      const entry = resolveFontAwesome(parsed.name, parsed.style)
      if (!entry) {
        holocronLogger.warn(formatHolocronWarning(`fontawesome icon "${parsed.name}"${parsed.style ? ` (${parsed.style})` : ''} not found.`))
        continue
      }
      atlas.icons[ref] = entry
      continue
    }

    holocronLogger.warn(formatHolocronWarning(`icon library "${parsed.library}" is not supported yet. Icon "${parsed.name}" will render empty.`))
  }
  return atlas
}
