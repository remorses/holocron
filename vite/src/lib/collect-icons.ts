/**
 * Walk the normalized config + enriched navigation tree and collect every
 * referenced icon that needs build-time SVG resolution.
 *
 * Bare string icons are ambiguous in the wild: existing Holocron fixtures use
 * lucide names in config/navigation, while the Polar MDX content uses many
 * Font Awesome names. For plain strings we collect both candidates, then let
 * the runtime <Icon> component prefer lucide and fall back to Font Awesome.
 * Emoji icons + URL-path icons render inline at runtime, so they do not need
 * an atlas entry.
 */

import type { ConfigIcon, HolocronConfig } from '../config.ts'
import type { Navigation, NavGroup } from '../navigation.ts'
import { isNavGroup, isNavPage } from '../navigation.ts'

export type IconRef = {
  library: 'lucide' | 'tabler' | 'fontawesome'
  name: string
  style?: string
}

const FA_STYLES = new Set([
  'regular', 'solid', 'light', 'thin', 'sharp-solid', 'duotone', 'brands',
])

export function stringIconToRefs(icon: string, iconType?: string): IconRef[] {
  if (icon === '' || isEmoji(icon) || isUrl(icon)) return []
  if (iconType) {
    if (FA_STYLES.has(iconType)) {
      return [{ library: 'fontawesome', name: icon, style: iconType }]
    }
    return [{ library: iconType as IconRef['library'], name: icon }]
  }
  return [
    { library: 'lucide', name: icon },
    { library: 'fontawesome', name: icon },
  ]
}

/** Dispatch rules for a raw icon value from the config:
 *   - undefined / empty string → no ref
 *   - emoji → no ref (rendered inline via <span>)
 *   - URL (http://, https://, /) → no ref (rendered as <img>)
 *   - other string → try lucide first, then Font Awesome fallback
 *   - object → { name, library? } (library defaults to lucide) */
export function iconToRefs(icon: ConfigIcon | undefined): IconRef[] {
  if (!icon) return []
  if (typeof icon === 'string') {
    return stringIconToRefs(icon)
  }
  const library = icon.library ?? 'lucide'
  if (!icon.name) return []
  return [{ library, name: icon.name, ...(icon.style ? { style: icon.style } : {}) }]
}

/**
 * Matches lucide / Mintlify emoji detection — a single emoji char or short
 * emoji sequence. Uses Unicode property escapes with a fallback for older
 * environments.
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

function walkGroups(groups: NavGroup[], out: IconRef[]): void {
  for (const group of groups) {
    out.push(...iconToRefs(group.icon))
    for (const entry of group.pages) {
      if (isNavGroup(entry)) {
        walkGroups([entry], out)
        continue
      }
      if (isNavPage(entry)) {
        out.push(...iconToRefs(entry.icon))
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

  // navbar links
  for (const link of config.navbar.links) {
    refs.push(...iconToRefs(link.icon))
  }
  // navbar primary (icon auto-filled from type via normalizeNavbar)
  refs.push(...iconToRefs(config.navbar.primary?.icon))

  // navigation tab icons
  for (const tab of navigation) {
    refs.push(...iconToRefs(tab.icon))
    walkGroups(tab.groups, refs)
  }

  // anchor icons
  for (const anchor of config.navigation.anchors) {
    refs.push(...iconToRefs(anchor.icon))
  }

  // dropdown icons (dropdowns may have icons shown in the select)
  for (const dropdown of config.navigation.dropdowns) {
    refs.push(...iconToRefs(dropdown.icon))
  }

  refs.push(...mdxIconRefs)

  // de-dupe by `library:name` key, including style-specific FA refs.
  const seen = new Set<string>()
  const unique: IconRef[] = []
  for (const ref of refs) {
    const key = ref.style
      ? `${ref.library}:${ref.style}:${ref.name}`
      : `${ref.library}:${ref.name}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(ref)
  }
  return unique
}
