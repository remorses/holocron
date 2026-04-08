'use client'

/**
 * <Icon> — renders any ConfigIcon (string or { name, library, style }).
 *
 * Dispatch rules for string icons (matches Mintlify convention):
 *   1. Emoji (matches Unicode Emoji regex) → <span>{icon}</span>
 *   2. URL (starts with http://, https://, /) → <img src={icon}/>
 *   3. Otherwise → lucide icon name, looked up in iconAtlas
 *
 * Object icons `{ name, library?, style? }`:
 *   - library defaults to 'lucide' (matches Mintlify's default)
 *   - style is currently ignored (FontAwesome concept)
 *   - name is looked up in iconAtlas via `${library}:${name}` key
 *
 * When an icon cannot be resolved (missing from atlas, unknown library),
 * renders null. The atlas is populated at Vite plugin init by walking the
 * config+navigation — only referenced icons ship to the client bundle.
 */

import React from 'react'
import type { ConfigIcon } from '../config.ts'
import type { IconAtlas } from '../lib/resolve-icons.ts'
import { useHolocronData } from '../router.ts'

export type IconProps = {
  icon: ConfigIcon | undefined
  /** px — applied to width+height. Emoji spans use this as font-size. */
  size?: number
  className?: string
/**
   * Icon library/style — used with string `icon` to construct the atlas key.
   * Maps to Mintlify's `iconType` prop: "regular", "solid", "light", "thin",
   * "sharp-solid", "duotone", "brands" (Font Awesome styles) or any
   * library prefix like "tabler". When omitted, string icons default to
   * `lucide:{icon}`.
   *
   * TODO: The build-time atlas currently only bundles lucide icons. FA and
   * tabler iconType values will resolve to null (icon not found in atlas)
   * until those packs are added to collect-icons.ts + icon-atlas generation.
   */
  iconType?: string
  /** Foreground color as a CSS value (hex, var(), Tailwind arbitrary). Applied via `style={{ color }}`. */
  color?: string
}

/**
 * Matches lucide / Mintlify emoji detection — a single emoji char or short
 * emoji sequence. Uses Unicode property escapes with a fallback.
 */
function isEmoji(str: string): boolean {
  try {
    const emojiRegex =
      /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\u200D(\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u
    return emojiRegex.test(str)
  } catch {
    return /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]$/u.test(
      str,
    )
  }
}

function isUrl(str: string): boolean {
  return (
    str.startsWith('http://') ||
    str.startsWith('https://') ||
    str.startsWith('/')
  )
}

function renderLibraryIcon(
  iconAtlas: IconAtlas,
  key: string,
  size: number,
  className?: string,
  colorStyle?: React.CSSProperties,
): React.ReactElement | null {
  const entry = iconAtlas.icons[key]
  if (!entry) return null
  return (
    <svg
      aria-hidden='true'
      viewBox={`0 0 ${entry.width} ${entry.height}`}
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, ...colorStyle }}
      dangerouslySetInnerHTML={{ __html: entry.body }}
    />
  )
}

/** Font Awesome style values that map to the `fontawesome:` atlas prefix. */
const FA_STYLES = new Set([
  'regular', 'solid', 'light', 'thin', 'sharp-solid', 'duotone', 'brands',
])

function resolveAtlasKey(icon: string, iconType?: string): string {
  if (iconType) {
    if (FA_STYLES.has(iconType)) return `fontawesome:${icon}`
    return `${iconType}:${icon}`
  }
  return `lucide:${icon}`
}

export function Icon({ icon, size = 16, className, iconType, color }: IconProps): React.ReactElement | null {
  if (!icon) return null

  const { site } = useHolocronData()
  const iconAtlas = site.icons
  const colorStyle = color ? { color } : undefined

  if (typeof icon === 'string') {
    if (icon === '') return null
    if (isEmoji(icon)) {
      return (
        <span
          aria-hidden='true'
          className={className}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${size}px`,
            lineHeight: 1,
            flexShrink: 0,
            ...colorStyle,
          }}
        >
          {icon}
        </span>
      )
    }
    if (isUrl(icon)) {
      return (
        <img
          src={icon}
          alt=''
          width={size}
          height={size}
          className={className}
          style={{ display: 'inline-block', flexShrink: 0 }}
        />
      )
    }
    // Resolve atlas key using iconType dispatch
    return renderLibraryIcon(iconAtlas, resolveAtlasKey(icon, iconType), size, className, colorStyle)
  }

  // Object form — iconType is ignored (object already specifies library)
  if (!icon.name) return null
  const library = icon.library ?? 'lucide'
  return renderLibraryIcon(iconAtlas, `${library}:${icon.name}`, size, className, colorStyle)
}
