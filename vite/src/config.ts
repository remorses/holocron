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
  redirectSchema,
  footerSchema,
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
 *  and href are required, url aliased into href, type preserved. */
export type ConfigNavbarPrimary = {
  label: string
  href: string
  type?: string
}

export type HolocronConfig = {
  name: string
  description?: string
  logo: { light: string; dark: string; href?: string }
  favicon: { light: string; dark: string }
  colors: z.output<typeof colorsSchema>
  navigation: {
    tabs: ConfigNavTab[]
    anchors: ConfigAnchor[]
  }
  navbar: {
    links: ConfigNavbarLink[]
    primary?: ConfigNavbarPrimary
  }
  redirects: Array<z.output<typeof redirectSchema>>
  footer: {
    socials: NonNullable<z.output<typeof footerSchema>['socials']>
  }
}

/* ── Type guard (for page entries) ───────────────────────────────────── */

export function isConfigNavGroup(entry: ConfigNavPageEntry): entry is ConfigNavGroup {
  return typeof entry === 'object' && 'group' in entry
}

/* ── Config reader ───────────────────────────────────────────────────── */

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
      return normalize(parseJsonc(raw) as Record<string, unknown>)
    }
    throw new Error(`Config file not found at: ${resolved}`)
  }
  // Auto-discovery
  for (const name of CONFIG_FILE_NAMES) {
    const filePath = path.join(root, name)
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      return normalize(parseJsonc(raw) as Record<string, unknown>)
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
