/**
 * Holocron config — normalized types + reader.
 *
 * The docs.json schema (holocron/schema.json) has many union variants for
 * navigation, logo, favicon, navbar, etc. We normalize everything inside
 * readConfig() so consuming code never deals with unions — just clean,
 * predictable types with exactly one shape per field.
 *
 * Supports two file names (first found wins):
 *   1. holocron.jsonc — our format (JSONC with comments)
 *   2. docs.json — mintlify format (drop-in compatible)
 */

import fs from 'node:fs'
import path from 'node:path'

/* ── Normalized config types (no unions, always one shape) ───────────── */

export type HolocronConfig = {
  name: string
  logo: { light: string; dark: string; href?: string }
  favicon: { light: string; dark: string }
  colors: {
    primary: string
    light?: string
    dark?: string
  }
  navigation: {
    tabs: ConfigNavTab[]
    anchors: ConfigAnchor[]
  }
  navbar: {
    links: Array<{ label: string; href: string }>
    primary?: { label: string; href: string }
  }
  redirects: Array<{ source: string; destination: string; permanent?: boolean }>
  footer: {
    socials: Record<string, string>
  }
}

/** An anchor — persistent link rendered as a tab in the tab bar.
 *  Can point to external URLs (GitHub, blog, etc). */
export type ConfigAnchor = {
  anchor: string
  href: string
  icon?: string
}

/** A top-level tab in the navigation (contains sidebar groups) */
export type ConfigNavTab = {
  tab: string
  groups: ConfigNavGroup[]
}

/** A sidebar group containing pages and/or nested groups */
export type ConfigNavGroup = {
  group: string
  icon?: string
  pages: ConfigNavPageEntry[]
}

/** A page entry is either a slug string or a nested group */
export type ConfigNavPageEntry = string | ConfigNavGroup

/* ── Type guard (only one still needed, for page entries) ────────────── */

export function isConfigNavGroup(entry: ConfigNavPageEntry): entry is ConfigNavGroup {
  return typeof entry === 'object' && 'group' in entry
}

/* ── JSONC parser (string-aware, won't corrupt URLs in strings) ─────── */

/**
 * Strip comments and trailing commas from JSONC. Walks character by
 * character to skip string contents — so "https://..." is never touched.
 */
function stripJsonc(text: string): string {
  let result = ''
  let i = 0
  const len = text.length

  while (i < len) {
    const ch = text[i]
    const next = text[i + 1]

    // String literal — copy verbatim including escapes
    if (ch === '"') {
      let j = i + 1
      while (j < len) {
        if (text[j] === '\\') {
          j += 2
          continue
        }
        if (text[j] === '"') {
          j++
          break
        }
        j++
      }
      result += text.slice(i, j)
      i = j
      continue
    }

    // Single-line comment
    if (ch === '/' && next === '/') {
      i += 2
      while (i < len && text[i] !== '\n') {
        i++
      }
      continue
    }

    // Multi-line comment
    if (ch === '/' && next === '*') {
      i += 2
      while (i < len - 1 && !(text[i] === '*' && text[i + 1] === '/')) {
        i++
      }
      i += 2
      continue
    }

    result += ch
    i++
  }

  // Remove trailing commas before } or ]
  result = result.replace(/,\s*([\]}])/g, '$1')
  return result
}

/* ── Config reader + normalizer ──────────────────────────────────────── */

const CONFIG_FILE_NAMES = ['holocron.jsonc', 'docs.json'] as const

/**
 * Read and normalize the config file. All docs.json union variants are
 * collapsed into a single canonical shape so consumers never deal with
 * type discrimination.
 */
export function readConfig({ root, configPath }: { root: string; configPath?: string }): HolocronConfig {
  // Explicit config path takes priority
  if (configPath) {
    const resolved = path.resolve(root, configPath)
    if (fs.existsSync(resolved)) {
      const raw = fs.readFileSync(resolved, 'utf-8')
      return normalize(JSON.parse(stripJsonc(raw)))
    }
    throw new Error(`Config file not found at: ${resolved}`)
  }
  // Auto-discovery
  for (const name of CONFIG_FILE_NAMES) {
    const filePath = path.join(root, name)
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      return normalize(JSON.parse(stripJsonc(raw)))
    }
  }
  throw new Error(
    `No config file found. Create one of: ${CONFIG_FILE_NAMES.join(', ')} in ${root}`,
  )
}

/** Resolve the config file path (for watching in dev mode) */
export function resolveConfigPath({ root, configPath }: { root: string; configPath?: string }): string | undefined {
  if (configPath) {
    const resolved = path.resolve(root, configPath)
    return fs.existsSync(resolved) ? resolved : undefined
  }
  for (const name of CONFIG_FILE_NAMES) {
    const filePath = path.join(root, name)
    if (fs.existsSync(filePath)) {
      return filePath
    }
  }
  return undefined
}

/* ── Normalization from raw docs.json → HolocronConfig ───────────────── */

function normalize(raw: Record<string, unknown>): HolocronConfig {
  return {
    name: (raw.name as string) || 'Documentation',
    logo: normalizeLogo(raw.logo),
    favicon: normalizeFavicon(raw.favicon),
    colors: normalizeColors(raw.colors),
    navigation: normalizeNavigation(raw.navigation),
    navbar: normalizeNavbar(raw.navbar),
    redirects: normalizeRedirects(raw.redirects),
    footer: normalizeFooter(raw.footer),
  }
}

/** logo: string | { light, dark, href? } → { light, dark, href? } */
function normalizeLogo(raw: unknown): HolocronConfig['logo'] {
  if (!raw) {
    return { light: '', dark: '' }
  }
  if (typeof raw === 'string') {
    return { light: raw, dark: raw }
  }
  const obj = raw as Record<string, string>
  return {
    light: obj.light || '',
    dark: obj.dark || obj.light || '',
    href: obj.href,
  }
}

/** favicon: string | { light, dark } → { light, dark } */
function normalizeFavicon(raw: unknown): HolocronConfig['favicon'] {
  if (!raw) {
    return { light: '', dark: '' }
  }
  if (typeof raw === 'string') {
    return { light: raw, dark: raw }
  }
  const obj = raw as Record<string, string>
  return {
    light: obj.light || '',
    dark: obj.dark || obj.light || '',
  }
}

function normalizeColors(raw: unknown): HolocronConfig['colors'] {
  if (!raw || typeof raw !== 'object') {
    return { primary: '#000000' }
  }
  const obj = raw as Record<string, string>
  return {
    primary: obj.primary || '#000000',
    light: obj.light,
    dark: obj.dark,
  }
}

/**
 * navigation can be:
 *   - Object { tabs, global: { anchors }, anchors }  (docs.json format)
 *   - Object { groups }                               (docs.json root groups)
 *   - Object { pages }                                (docs.json root pages)
 *   - Array of tabs [{ tab, groups }]
 *   - Array of groups [{ group, pages }]
 *
 * Tabs themselves can be:
 *   - { tab, groups }  → content tab with sidebar groups
 *   - { tab, href }    → link-only tab (converted to anchor)
 *   - { tab, pages }   → tab with pages but no groups wrapper
 *
 * Always normalize to { tabs: ConfigNavTab[], anchors: ConfigAnchor[] }
 */
function normalizeNavigation(raw: unknown): HolocronConfig['navigation'] {
  if (!raw) {
    return { tabs: [], anchors: [] }
  }

  // Array format
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return { tabs: [], anchors: [] }
    }
    const first = raw[0]
    // Array of tabs
    if (first && typeof first === 'object' && 'tab' in first) {
      return normalizeTabsAndAnchors(raw as Array<Record<string, unknown>>, [])
    }
    // Array of groups → wrap in single implicit tab
    return {
      tabs: [{ tab: '', groups: raw as ConfigNavGroup[] }],
      anchors: [],
    }
  }

  // Object format
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>

    // Collect anchors from both global.anchors and root anchors (with guards)
    const globalObj = obj.global as Record<string, unknown> | undefined
    const globalAnchors = Array.isArray(globalObj?.anchors) ? globalObj.anchors as ConfigAnchor[] : []
    const rootAnchors = Array.isArray(obj.anchors) ? obj.anchors as ConfigAnchor[] : []
    const allAnchors = [...globalAnchors, ...rootAnchors]

    // Has explicit tabs
    if (Array.isArray(obj.tabs)) {
      return normalizeTabsAndAnchors(obj.tabs as Array<Record<string, unknown>>, allAnchors)
    }

    // Root groups (no tabs wrapper)
    if (Array.isArray(obj.groups)) {
      return {
        tabs: [{ tab: '', groups: obj.groups as ConfigNavGroup[] }],
        anchors: allAnchors,
      }
    }

    // Root pages (no groups wrapper)
    if (Array.isArray(obj.pages)) {
      return {
        tabs: [{ tab: '', groups: [{ group: '', pages: obj.pages as ConfigNavPageEntry[] }] }],
        anchors: allAnchors,
      }
    }

    return { tabs: [], anchors: allAnchors }
  }

  return { tabs: [], anchors: [] }
}

/**
 * Normalize raw tab objects into ConfigNavTab[] + extra anchors.
 * Handles tab variants:
 *   { tab, groups }  → kept as ConfigNavTab
 *   { tab, href }    → converted to anchor (link-only tab)
 *   { tab, pages }   → wrapped in a single group
 */
function normalizeTabsAndAnchors(
  rawTabs: Array<Record<string, unknown>>,
  existingAnchors: ConfigAnchor[],
): HolocronConfig['navigation'] {
  const tabs: ConfigNavTab[] = []
  const anchors: ConfigAnchor[] = [...existingAnchors]

  for (const raw of rawTabs) {
    const name = (raw.tab as string) || ''

    // Link-only tab → convert to anchor
    if (raw.href && !raw.groups && !raw.pages) {
      anchors.push({ anchor: name, href: raw.href as string, icon: raw.icon as string | undefined })
      continue
    }

    // Tab with groups → standard content tab
    if (raw.groups) {
      tabs.push({ tab: name, groups: raw.groups as ConfigNavGroup[] })
      continue
    }

    // Tab with pages but no groups → wrap in single unnamed group
    if (raw.pages) {
      tabs.push({ tab: name, groups: [{ group: '', pages: raw.pages as ConfigNavPageEntry[] }] })
      continue
    }

    // Tab with no content — skip
  }

  return { tabs, anchors }
}

/** Known type → display label mapping for navbar items */
const TYPE_LABELS: Record<string, string> = {
  github: 'GitHub',
  discord: 'Discord',
  slack: 'Slack',
  button: 'Button',
  link: 'Link',
}

/**
 * navbar can be:
 *   - { links: [{ label, href } | { type: "github", href }], primary: { label, href } | { type: "github", href } }
 *
 * Always normalize to { label, href }. Derive label from type if missing.
 */
function normalizeNavbar(raw: unknown): HolocronConfig['navbar'] {
  if (!raw || typeof raw !== 'object') {
    return { links: [] }
  }
  const obj = raw as Record<string, unknown>

  const rawLinks = (obj.links ?? []) as Array<Record<string, string>>
  const links = rawLinks.map((link) => {
    return {
      label: link.label || TYPE_LABELS[link.type || ''] || link.type || '',
      href: link.href || link.url || '',
    }
  })

  const rawPrimary = obj.primary as Record<string, string> | undefined
  const primary = rawPrimary
    ? {
        label: rawPrimary.label || TYPE_LABELS[rawPrimary.type || ''] || rawPrimary.type || 'Button',
        href: rawPrimary.href || rawPrimary.url || '',
      }
    : undefined

  return { links, primary }
}

function normalizeRedirects(raw: unknown): HolocronConfig['redirects'] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.map((r: Record<string, unknown>) => {
    return {
      source: (r.source as string) || '',
      destination: (r.destination as string) || '',
      permanent: r.permanent as boolean | undefined,
    }
  })
}

function normalizeFooter(raw: unknown): HolocronConfig['footer'] {
  if (!raw || typeof raw !== 'object') {
    return { socials: {} }
  }
  const obj = raw as Record<string, unknown>
  const socials = (obj.socials ?? {}) as Record<string, string>
  return { socials }
}


