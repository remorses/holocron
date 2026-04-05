/**
 * Build-time SVG resolver. Given a de-duped list of `{library, name}`
 * refs, look each one up in the bundled iconify sets and return an atlas
 * mapping `library:name` → `{body, width, height}` ready to be serialized
 * into the `virtual:holocron-icons` module.
 *
 * Only `lucide` is wired in Phase 1. Other libraries log a warning and
 * emit no entry (client `<Icon>` renders null for missing atlas keys).
 */

import { icons as lucideIcons } from '@iconify-json/lucide'
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

export function resolveIconSvgs(refs: IconRef[]): IconAtlas {
  const atlas: IconAtlas = { icons: {} }
  for (const ref of refs) {
    const key = `${ref.library}:${ref.name}`
    if (ref.library !== 'lucide') {
      console.warn(
        `[holocron] icon library "${ref.library}" is not supported yet (only "lucide"). Icon "${ref.name}" will render empty.`,
      )
      continue
    }
    const entry = resolveLucide(ref.name)
    if (!entry) {
      console.warn(
        `[holocron] lucide icon "${ref.name}" not found. Check the icon name at https://lucide.dev/icons/.`,
      )
      continue
    }
    atlas.icons[key] = entry
  }
  return atlas
}
