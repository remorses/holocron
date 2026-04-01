/**
 * Holocron config types + reader.
 *
 * Schema is ported from mintlify's schema.json — see holocron/schema.json
 * for the full JSON Schema reference.
 *
 * Supports two file names:
 *   1. holocron.jsonc  — our format (JSONC with comments)
 *   2. docs.json       — mintlify new format (drop-in compatible)
 *
 * Navigation schema: tabs contain groups, groups contain pages (strings
 * or nested groups). When no tabs are defined, the navigation is a flat
 * array of groups rendered under a single implicit tab.
 *
 * Types are kept close to docs.json so we minimize transformations.
 */

import fs from 'node:fs'
import path from 'node:path'

/* ── Config types (close to docs.json / mintlify schema) ─────────────── */

export type HolocronConfig = {
  $schema?: string
  name: string
  logo?: string | { light: string; dark: string; href?: string }
  favicon?: string
  colors?: {
    primary: string
    light?: string
    dark?: string
  }
  /** Navigation tree. Can be:
   *  - Object with tabs, global anchors (docs.json format)
   *  - Array of tabs (simplified)
   *  - Array of groups (single implicit tab) */
  navigation: ConfigNavigation | ConfigNavTab[] | ConfigNavGroup[]
  /** Navbar — top header bar links and primary CTA button.
   *  Replaces old topbarLinks / topbarCtaButton from mint.json. */
  navbar?: {
    links?: Array<{ label: string; href: string }>
    primary?: { type?: 'button' | 'link'; label: string; href: string }
  }
  /** Redirects from old paths to new destinations */
  redirects?: Array<{ source: string; destination: string }>
  /** Footer config */
  footer?: {
    socials?: Record<string, string>
  }
}

/** Navigation object (docs.json format) — contains tabs + global anchors */
export type ConfigNavigation = {
  tabs?: ConfigNavTab[]
  global?: {
    /** Anchors — persistent links rendered as tabs in the tab bar.
     *  Can point to external URLs (GitHub, blog, etc). */
    anchors?: ConfigAnchor[]
  }
}

/** An anchor — a persistent link shown in the tab bar.
 *  Uses { anchor, href, icon? } matching docs.json schema. */
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

/* ── Type guards ─────────────────────────────────────────────────────── */

export function isConfigNavTab(entry: ConfigNavTab | ConfigNavGroup): entry is ConfigNavTab {
  return 'tab' in entry && 'groups' in entry
}

export function isConfigNavGroup(entry: ConfigNavPageEntry): entry is ConfigNavGroup {
  return typeof entry === 'object' && 'group' in entry
}

function isConfigNavigation(nav: unknown): nav is ConfigNavigation {
  return typeof nav === 'object' && nav !== null && !Array.isArray(nav)
}

/* ── Normalize navigation to tabs + anchors ──────────────────────────── */

export type NormalizedNavigation = {
  tabs: ConfigNavTab[]
  anchors: ConfigAnchor[]
}

/**
 * Normalize the various navigation formats into a flat list of tabs + anchors.
 *
 * Supports:
 *   - Object with tabs + global.anchors (docs.json format)
 *   - Array of ConfigNavTab[]
 *   - Array of ConfigNavGroup[] (single implicit tab)
 */
export function normalizeNavigation(nav: HolocronConfig['navigation']): NormalizedNavigation {
  // docs.json object format: { tabs: [...], global: { anchors: [...] } }
  if (isConfigNavigation(nav)) {
    return {
      tabs: nav.tabs ?? [],
      anchors: nav.global?.anchors ?? [],
    }
  }

  // Array format — check if it's tabs or groups
  if (!Array.isArray(nav) || nav.length === 0) {
    return { tabs: [], anchors: [] }
  }

  const first = nav[0]
  if (first && 'tab' in first && 'groups' in first) {
    return { tabs: nav as ConfigNavTab[], anchors: [] }
  }

  // Flat groups — wrap in a single implicit tab
  return {
    tabs: [{ tab: '', groups: nav as ConfigNavGroup[] }],
    anchors: [],
  }
}

/* ── JSONC parser (strips comments + trailing commas) ───────────────── */

function stripJsonc(text: string): string {
  // Remove single-line comments (// ...)
  let result = text.replace(/\/\/.*$/gm, '')
  // Remove multi-line comments (/* ... */)
  result = result.replace(/\/\*[\s\S]*?\*\//g, '')
  // Remove trailing commas before } or ]
  result = result.replace(/,\s*([\]}])/g, '$1')
  return result
}

/* ── Config file reader ──────────────────────────────────────────────── */

const CONFIG_FILE_NAMES = ['holocron.jsonc', 'docs.json'] as const

/**
 * Find and read the config file from the given root directory.
 * Tries holocron.jsonc first, then docs.json.
 */
export function readConfig({ root }: { root: string }): HolocronConfig {
  for (const name of CONFIG_FILE_NAMES) {
    const filePath = path.join(root, name)
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const parsed = JSON.parse(stripJsonc(raw)) as HolocronConfig
      return parsed
    }
  }
  throw new Error(
    `No config file found. Create one of: ${CONFIG_FILE_NAMES.join(', ')} in ${root}`,
  )
}

/** Resolve the config file path (for watching in dev mode) */
export function resolveConfigPath({ root }: { root: string }): string | undefined {
  for (const name of CONFIG_FILE_NAMES) {
    const filePath = path.join(root, name)
    if (fs.existsSync(filePath)) {
      return filePath
    }
  }
  return undefined
}
