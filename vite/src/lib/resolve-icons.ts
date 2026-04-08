/**
 * Build-time SVG resolver. Given a de-duped list of `{library, name}`
 * refs, look each one up in the bundled iconify sets and return an atlas
 * mapping `library:name` → `{body, width, height}` ready to be serialized
 * into the `virtual:holocron-icons` module.
 *
 * Lucide stays the primary path, but many Mintlify docs in the wild also use
 * Font Awesome names in MDX content. We resolve both into one small atlas so
 * the client can render icons without shipping full icon packs.
 */

import { icons as lucideIcons } from '@iconify-json/lucide'
import { icons as fa6BrandsIcons } from '@iconify-json/fa6-brands'
import { icons as fa6RegularIcons } from '@iconify-json/fa6-regular'
import { icons as fa6SolidIcons } from '@iconify-json/fa6-solid'
import type { IconRef } from './collect-icons.ts'

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

function fontAwesomeKey(name: string, style?: string): string {
  return style ? `fontawesome:${style}:${name}` : `fontawesome:${name}`
}

function resolveFontAwesome(name: string, style?: string): IconAtlasEntry | null {
  const sets = (() => {
    if (!style) return [fa6SolidIcons, fa6BrandsIcons, fa6RegularIcons]
    const set = FONT_AWESOME_SETS[style as FontAwesomeStyle]
    return set ? [set] : []
  })()

  for (const set of sets) {
    const icon = set.icons[name]
    if (!icon) continue
    return {
      body: icon.body,
      width: set.width ?? FA_DEFAULT_WIDTH,
      height: set.height ?? FA_DEFAULT_HEIGHT,
    }
  }

  return null
}

export function resolveIconSvgs(refs: IconRef[]): IconAtlas {
  const atlas: IconAtlas = { icons: {} }
  for (const ref of refs) {
    if (ref.library === 'lucide') {
      const entry = resolveLucide(ref.name)
      if (!entry) {
        console.warn(
          `[holocron] lucide icon "${ref.name}" not found. Check the icon name at https://lucide.dev/icons/.`,
        )
        continue
      }
      atlas.icons[`lucide:${ref.name}`] = entry
      continue
    }

    if (ref.library === 'fontawesome') {
      const entry = resolveFontAwesome(ref.name, ref.style)
      if (!entry) {
        console.warn(
          `[holocron] fontawesome icon "${ref.name}"${ref.style ? ` (${ref.style})` : ''} not found.`,
        )
        continue
      }
      atlas.icons[fontAwesomeKey(ref.name, ref.style)] = entry
      continue
    }

    console.warn(
      `[holocron] icon library "${ref.library}" is not supported yet. Icon "${ref.name}" will render empty.`,
    )
  }
  return atlas
}
