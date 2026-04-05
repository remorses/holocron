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
import { iconAtlas } from 'virtual:holocron-icons'

export type IconProps = {
  icon: ConfigIcon | undefined
  /** px — applied to width+height. Emoji spans use this as font-size. */
  size?: number
  className?: string
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
  key: string,
  size: number,
  className?: string,
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
      style={{ display: 'inline-block', flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: entry.body }}
    />
  )
}

export function Icon({ icon, size = 16, className }: IconProps): React.ReactElement | null {
  if (!icon) return null

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
    // lucide name (default library)
    return renderLibraryIcon(`lucide:${icon}`, size, className)
  }

  // Object form
  if (!icon.name) return null
  const library = icon.library ?? 'lucide'
  return renderLibraryIcon(`${library}:${icon.name}`, size, className)
}
