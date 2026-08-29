'use client'

/**
 * <Icon> — renders any ConfigIcon using the request-scoped icon atlas.
 *
 * Plain strings use the project's configured icon library, while explicit
 * prefixed strings like `lucide:rocket` or `fontawesome:brands:discord`
 * bypass the project default. Emoji and URL/path icons render inline.
 */

import React, { type ReactElement } from 'react'
import type { ConfigIcon } from '../config.ts'
import { iconToRefs, isEmoji, isUrl } from '../lib/collect-icons.ts'
import type { IconAtlas } from '../lib/resolve-icons.ts'
import { useHolocronDataSafe } from '../router.ts'
import { withBasePath } from '../lib/holocron-url.ts'

export type IconProps = {
  icon: ConfigIcon | undefined
  /** CSS length. Numbers are px. Emoji spans use this as font-size. */
  size?: number | string
  className?: string
  /** Font Awesome style override for string icons, matching Mintlify's `iconType` prop. */
  iconType?: string
  /** Foreground color as a CSS value (hex, var(), Tailwind arbitrary). */
  color?: string
  /** Rendered when a named icon is absent from the request-scoped atlas. */
  fallback?: ReactElement
}

function cssSize(size: number | string): string {
  return typeof size === 'number' ? `${size}px` : size
}

function hideBrokenImage(event: React.SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.hidden = true
}

function renderLibraryIcon(
  iconAtlas: IconAtlas,
  key: string,
  size: number | string,
  className?: string,
  colorStyle?: React.CSSProperties,
): React.ReactElement | null {
  const entry = iconAtlas.icons[key]
  if (!entry) return null
  const length = cssSize(size)
  return (
    <svg
      aria-hidden='true'
      viewBox={`0 0 ${entry.width} ${entry.height}`}
      width={length}
      height={length}
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, width: length, height: length, ...colorStyle }}
      dangerouslySetInnerHTML={{ __html: entry.body }}
    />
  )
}

/** Map named colors to their CSS variable references. Uses the editorial
 *  semantic palette defined in globals.css (dark-mode-aware). */
const NAMED_ICON_COLORS: Record<string, string> = {
  green: 'var(--green)',
  blue: 'var(--blue)',
  red: 'var(--red)',
  purple: 'var(--purple)',
  orange: 'var(--orange)',
  yellow: 'var(--yellow)',
  pink: 'var(--pink)',
}

/** Resolve an iconColor value to a CSS color string.
 *  Named colors (green, blue, etc.) map to CSS variables; anything else
 *  (hex, rgb, etc.) passes through as-is. */
export function resolveIconColor(iconColor: string | undefined): string | undefined {
  if (!iconColor) return undefined
  return NAMED_ICON_COLORS[iconColor] ?? iconColor
}

export function Icon({ icon, size = 16, className, iconType, color, fallback }: IconProps): React.ReactElement | null {
  const data = useHolocronDataSafe()
  const iconAtlas = data?.site?.icons
  const colorStyle = color ? { color } : undefined

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
            fontSize: cssSize(size),
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
      const length = cssSize(size)
      return (
        <img
          src={withBasePath(icon)}
          alt=''
          loading='lazy'
          decoding='async'
          onError={hideBrokenImage}
          width={typeof size === 'number' ? size : undefined}
          height={typeof size === 'number' ? size : undefined}
          className={className}
          style={{ display: 'inline-block', flexShrink: 0, width: length, height: length }}
        />
      )
    }
  }

  const defaultLibrary = data?.site?.config?.icons?.library ?? 'lucide'
  const ref = iconToRefs(icon, {
    defaultLibrary,
    iconType,
  })[0]
  return ref && iconAtlas ? renderLibraryIcon(iconAtlas, ref, size, className, colorStyle) ?? fallback ?? null : fallback ?? null
}
