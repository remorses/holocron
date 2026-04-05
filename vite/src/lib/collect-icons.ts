/**
 * Walk the normalized config + enriched navigation tree and collect every
 * referenced icon that needs build-time SVG resolution.
 *
 * Only STRUCTURED icons + LIBRARY-NAME string icons are collected. Emoji
 * icons + URL-path icons are rendered inline at runtime without any
 * pre-resolved SVG body, so they don't appear here.
 *
 * Output is a de-duped list of `{ library, name }` pairs keyed by
 * `library:name` — the same keying convention the client `<Icon>`
 * component uses to look them up in the atlas.
 */

import type { ConfigIcon, HolocronConfig } from '../config.ts'
import type { Navigation, NavGroup } from '../navigation.ts'
import { isNavGroup, isNavPage } from '../navigation.ts'

export type IconRef = {
  library: 'lucide' | 'tabler' | 'fontawesome'
  name: string
}

/** Dispatch rules for a raw icon value from the config:
 *   - undefined / empty string → no ref
 *   - emoji → no ref (rendered inline via <span>)
 *   - URL (http://, https://, /) → no ref (rendered as <img>)
 *   - other string → lucide icon name (library default)
 *   - object → { name, library? } (library defaults to lucide) */
function iconToRef(icon: ConfigIcon | undefined): IconRef | null {
  if (!icon) return null
  if (typeof icon === 'string') {
    if (icon === '') return null
    if (isEmoji(icon)) return null
    if (isUrl(icon)) return null
    return { library: 'lucide', name: icon }
  }
  // object form — library defaults to lucide (matches Mintlify's default)
  const library = icon.library ?? 'lucide'
  if (!icon.name) return null
  return { library, name: icon.name }
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
    const ref = iconToRef(group.icon)
    if (ref) out.push(ref)
    for (const entry of group.pages) {
      if (isNavGroup(entry)) {
        walkGroups([entry], out)
        continue
      }
      if (isNavPage(entry)) {
        const pageRef = iconToRef(entry.icon)
        if (pageRef) out.push(pageRef)
      }
    }
  }
}

export function collectIconRefs({
  config,
  navigation,
}: {
  config: HolocronConfig
  navigation: Navigation
}): IconRef[] {
  const refs: IconRef[] = []

  // navbar links
  for (const link of config.navbar.links) {
    const ref = iconToRef(link.icon)
    if (ref) refs.push(ref)
  }
  // navbar primary (icon auto-filled from type via normalizeNavbar)
  const primaryRef = iconToRef(config.navbar.primary?.icon)
  if (primaryRef) refs.push(primaryRef)

  // navigation tab icons
  for (const tab of navigation) {
    const ref = iconToRef(tab.icon)
    if (ref) refs.push(ref)
    walkGroups(tab.groups, refs)
  }

  // anchor icons
  for (const anchor of config.navigation.anchors) {
    const ref = iconToRef(anchor.icon)
    if (ref) refs.push(ref)
  }

  // de-dupe by `library:name` key
  const seen = new Set<string>()
  const unique: IconRef[] = []
  for (const ref of refs) {
    const key = `${ref.library}:${ref.name}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(ref)
  }
  return unique
}
