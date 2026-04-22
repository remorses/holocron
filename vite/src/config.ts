/**
 * Holocron config — normalized types + reader.
 *
 * Types for anchors, groups, pages, colors, redirects, and footer.socials
 * are DERIVED from the Zod schemas in `src/schema.ts` via `z.output<>`.
 * Only normalized wrapper shapes (logo, favicon, navigation, navbar)
 * are defined here. Normalization logic lives in `lib/normalize-config.ts`.
 *
 * Supports two file names (first found wins):
 *   1. holocron.jsonc — our format (JSONC with comments)
 *   2. docs.json — mintlify format (drop-in compatible)
 */

import fs from 'node:fs'
import path from 'node:path'
import type { z } from 'zod'
import type {
  anchorSchema,
  groupSchema,
  iconSchema,
  tabBaseSchema,
  colorsSchema,
  iconsSchema,
  redirectSchema,
  footerSchema,
  appearanceSchema,
  fontsSchema,
  seoSchema,
  searchSchema,
  bannerSchema,
} from './schema.ts'
import { parseJsonc } from './lib/jsonc.ts'
import { normalize } from './lib/normalize-config.ts'

/* ── Types derived from Zod (schema.ts = source of truth) ────────────── */

/** An icon — either a string (image path or icon name) or a structured
 *  `{ name, library?, style? }` object. */
export type ConfigIcon = z.output<typeof iconSchema>

/** An anchor — persistent link rendered as a tab in the tab bar.
 *  Can point to external URLs (GitHub, blog, etc). */
export type ConfigAnchor = z.output<typeof anchorSchema>

/** A sidebar group containing pages and/or nested groups. Recursive. */
export type ConfigNavGroup = z.output<typeof groupSchema>

/** A page entry is either a slug string or a nested group. */
export type ConfigNavPageEntry = string | ConfigNavGroup

/** Base fields shared by every tab variant (tab, icon, hidden, align). */
export type NavTabBase = z.output<typeof tabBaseSchema>

/* ── Normalized wrapper types (union-collapsed by normalize()) ───────── */

/** A top-level tab in the navigation (contains sidebar groups).
 *  Link-only tabs are converted to anchors during normalization. */
export type ConfigNavTab = NavTabBase & {
  groups: ConfigNavGroup[]
}

/** A navbar icon link (top-right of header). The normalized form has
 *  `label` and `href` required (derived from raw type/url aliases). */
export type ConfigNavbarLink = {
  label: string
  href: string
  type?: string
  icon?: ConfigIcon
}

/** The navbar primary CTA button (right of navbar). Normalized: label
 *  and href are required, url aliased into href, type preserved. An
 *  `icon` is auto-filled from `type` when omitted (see TYPE_ICONS in
 *  normalize-config.ts) so a `{ type: 'github' }` primary always
 *  renders the github glyph. */
export type ConfigNavbarPrimary = {
  label: string
  href: string
  type?: string
  icon?: ConfigIcon
}

export type FooterLinkItem = { label: string; href: string }
export type FooterLinkColumn = { header?: string; items: FooterLinkItem[] }

export type ConfigVersionItem = {
  version: string
  default?: boolean
  tag?: string
  hidden?: boolean
  navigation: { tabs: ConfigNavTab[]; anchors: ConfigAnchor[] }
}

export type ConfigDropdownItem = {
  dropdown: string
  icon?: ConfigIcon
  hidden?: boolean
  href?: string
  navigation?: { tabs: ConfigNavTab[]; anchors: ConfigAnchor[] }
}

export type HolocronConfig = {
  name: string
  description?: string
  logo: { light: string; dark?: string; href?: string }
  favicon: { light: string; dark: string }
  colors: z.output<typeof colorsSchema> & { _hasUserColors: boolean }
  icons: z.output<typeof iconsSchema> & { library: 'fontawesome' | 'lucide' | 'tabler' }
  appearance: { default: 'system' | 'light' | 'dark'; strict: boolean }
  fonts?: {
    family?: string
    weight?: number
    source?: string
    format?: 'woff' | 'woff2'
    heading?: { family: string; weight?: number; source?: string; format?: 'woff' | 'woff2' }
    body?: { family: string; weight?: number; source?: string; format?: 'woff' | 'woff2' }
  }
  navigation: {
    tabs: ConfigNavTab[]
    anchors: ConfigAnchor[]
    versions: ConfigVersionItem[]
    dropdowns: ConfigDropdownItem[]
  }
  navbar: {
    links: ConfigNavbarLink[]
    primary?: ConfigNavbarPrimary
  }
  banner?: { content: string; dismissible: boolean }
  redirects: Array<z.output<typeof redirectSchema>>
  footer: {
    socials: NonNullable<z.output<typeof footerSchema>['socials']>
    links: FooterLinkColumn[]
  }
  search: { prompt?: string }
  seo: { indexing?: 'navigable' | 'all'; metatags?: Record<string, string> }
  assistant: { enabled: boolean }
}

/* ── Type guard (for page entries) ───────────────────────────────────── */

export function isConfigNavGroup(entry: ConfigNavPageEntry): entry is ConfigNavGroup {
  return typeof entry === 'object' && entry !== null
}

/* ── Config reader ───────────────────────────────────────────────────── */

const CONFIG_FILE_NAMES = ['holocron.jsonc', 'docs.json'] as const

function parseConfigObject(raw: string): Record<string, unknown> {
  const parsed = parseJsonc(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Config file must contain a top-level JSON object')
  }
  return Object.fromEntries(Object.entries(parsed))
}

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
      return normalize(parseConfigObject(raw))
    }
    throw new Error(`Config file not found at: ${resolved}`)
  }
  // Auto-discovery
  for (const name of CONFIG_FILE_NAMES) {
    const filePath = path.join(root, name)
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      return normalize(parseConfigObject(raw))
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
