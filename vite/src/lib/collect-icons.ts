/**
 * Icon ref normalization + collection helpers.
 *
 * Holocron follows Mintlify's project-level icon library setting:
 * plain icon strings use `config.icons.library`, while explicit prefixed
 * strings like `lucide:rocket` or `fontawesome:brands:discord` bypass it.
 */

import type { ConfigIcon, HolocronConfig } from '../config.ts'
import type { Navigation, NavGroup } from '../navigation.ts'
import { isNavGroup, isNavPage } from '../navigation.ts'

export type IconLibrary = HolocronConfig['icons']['library']
export type IconRef = string

export const FA_STYLES = new Set([
  'regular', 'solid', 'light', 'thin', 'sharp-solid', 'duotone', 'brands',
])

const TYPE_ICONS_BY_LIBRARY: Record<IconLibrary, Record<string, string>> = {
  lucide: {
    github: 'github',
    slack: 'slack',
    discord: 'message-circle',
    twitter: 'twitter',
    'x-twitter': 'twitter',
    x: 'twitter',
    linkedin: 'linkedin',
    youtube: 'youtube',
    facebook: 'facebook',
    instagram: 'instagram',
    website: 'globe',
    'earth-americas': 'globe',
    'hacker-news': 'newspaper',
    medium: 'book-open',
    telegram: 'send',
    bluesky: 'cloud',
    threads: 'at-sign',
    reddit: 'message-square',
    podcast: 'rss',
    button: 'external-link',
    link: 'external-link',
  },
  fontawesome: {
    github: 'github',
    slack: 'slack',
    discord: 'discord',
    twitter: 'twitter',
    'x-twitter': 'x-twitter',
    x: 'x-twitter',
    linkedin: 'linkedin',
    youtube: 'youtube',
    facebook: 'facebook',
    instagram: 'instagram',
    website: 'earth-americas',
    'earth-americas': 'earth-americas',
    'hacker-news': 'hacker-news',
    medium: 'medium',
    telegram: 'telegram',
    bluesky: 'bluesky',
    threads: 'threads',
    reddit: 'reddit',
    podcast: 'rss',
    button: 'link',
    link: 'link',
  },
  tabler: {
    github: 'brand-github',
    slack: 'brand-slack',
    discord: 'brand-discord',
    twitter: 'brand-twitter',
    'x-twitter': 'brand-x',
    x: 'brand-x',
    linkedin: 'brand-linkedin',
    youtube: 'brand-youtube',
    facebook: 'brand-facebook',
    instagram: 'brand-instagram',
    website: 'world',
    'earth-americas': 'world',
    'hacker-news': 'brand-ycombinator',
    medium: 'brand-medium',
    telegram: 'brand-telegram',
    bluesky: 'brand-bluesky',
    threads: 'brand-threads',
    reddit: 'brand-reddit',
    podcast: 'rss',
    button: 'external-link',
    link: 'external-link',
  },
}

export function getDefaultTypeIcon(type: string, library: IconLibrary): string | undefined {
  return TYPE_ICONS_BY_LIBRARY[library][type]
}

function buildIconRef({ library, name, style }: { library: IconLibrary; name: string; style?: string }): IconRef {
  if (library === 'fontawesome') {
    return style ? `fontawesome:${style}:${name}` : `fontawesome:${name}`
  }
  return `${library}:${name}`
}

function isIconLibrary(value: string): value is IconLibrary {
  return value === 'lucide' || value === 'fontawesome' || value === 'tabler'
}

function parseExplicitIconRef(icon: string): IconRef | undefined {
  const parts = icon.split(':')
  if (parts.length === 2 && isIconLibrary(parts[0]!) && parts[0] !== 'fontawesome' && parts[1]) {
    return `${parts[0]}:${parts[1]}`
  }
  if (parts.length === 2 && parts[0] === 'fontawesome' && parts[1]) {
    return buildIconRef({ library: 'fontawesome', name: parts[1] })
  }
  if (parts.length === 3 && parts[0] === 'fontawesome' && parts[1] && parts[2] && FA_STYLES.has(parts[1]!)) {
    return buildIconRef({ library: 'fontawesome', style: parts[1], name: parts[2] })
  }
  return undefined
}

export function dedupeIconRefs(refs: IconRef[]): IconRef[] {
  return Array.from(new Set(refs))
}

export function stringIconToRefs(
  icon: string,
  options: { defaultLibrary: IconLibrary; iconType?: string },
): IconRef[] {
  if (icon === '' || isEmoji(icon) || isUrl(icon)) return []
  const explicit = parseExplicitIconRef(icon)
  if (explicit) return [explicit]
  if (options.defaultLibrary === 'fontawesome') {
    return [buildIconRef({
      library: 'fontawesome',
      name: icon,
      ...(options.iconType && FA_STYLES.has(options.iconType) ? { style: options.iconType } : {}),
    })]
  }
  return [buildIconRef({ library: options.defaultLibrary, name: icon })]
}

/** Dispatch rules for a raw icon value from config or MDX.
 *   - undefined / empty string → no ref
 *   - emoji → no ref (rendered inline via <span>)
 *   - URL/path → no ref (rendered as <img>)
 *   - plain string → project default library
 *   - prefixed string → explicit library/style override
 *   - object → explicit object library, otherwise project default library */
export function iconToRefs(
  icon: ConfigIcon | undefined,
  options: { defaultLibrary: IconLibrary; iconType?: string },
): IconRef[] {
  if (!icon) return []
  if (typeof icon === 'string') {
    return stringIconToRefs(icon, options)
  }
  const library = icon.library ?? options.defaultLibrary
  if (!icon.name) return []
  return [buildIconRef({
    library,
    name: icon.name,
    ...(library === 'fontawesome' && icon.style ? { style: icon.style } : {}),
  })]
}

/**
 * Matches lucide / Mintlify emoji detection — a single emoji char or short
 * emoji sequence. Uses Unicode property escapes with a fallback for older
 * environments.
 */
export function isEmoji(str: string): boolean {
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

export function isUrl(str: string): boolean {
  return (
    str.startsWith('http://') ||
    str.startsWith('https://') ||
    str.startsWith('/')
  )
}

function walkGroups(groups: NavGroup[], out: IconRef[], defaultLibrary: IconLibrary): void {
  for (const group of groups) {
    out.push(...iconToRefs(group.icon, { defaultLibrary }))
    for (const entry of group.pages) {
      if (isNavGroup(entry)) {
        walkGroups([entry], out, defaultLibrary)
        continue
      }
      if (isNavPage(entry)) {
        out.push(...iconToRefs(entry.icon, { defaultLibrary }))
      }
    }
  }
}

export function collectIconRefs({
  config,
  navigation,
  mdxIconRefs = [],
}: {
  config: HolocronConfig
  navigation: Navigation
  mdxIconRefs?: IconRef[]
}): IconRef[] {
  const refs: IconRef[] = []
  const defaultLibrary = config.icons.library

  for (const link of config.navbar.links) {
    refs.push(...iconToRefs(link.icon, { defaultLibrary }))
  }
  refs.push(...iconToRefs(config.navbar.primary?.icon, { defaultLibrary }))

  for (const tab of navigation) {
    refs.push(...iconToRefs(tab.icon, { defaultLibrary }))
    walkGroups(tab.groups, refs, defaultLibrary)
  }

  for (const anchor of config.navigation.anchors) {
    refs.push(...iconToRefs(anchor.icon, { defaultLibrary }))
  }

  for (const dropdown of config.navigation.dropdowns) {
    refs.push(...iconToRefs(dropdown.icon, { defaultLibrary }))
  }

  for (const platform of Object.keys(config.footer.socials)) {
    const socialIcon = getDefaultTypeIcon(platform, defaultLibrary)
    if (socialIcon) {
      refs.push(...stringIconToRefs(socialIcon, { defaultLibrary }))
    }
  }

  refs.push(...mdxIconRefs)
  return dedupeIconRefs(refs)
}
