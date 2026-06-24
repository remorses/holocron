/**
 * Holocron config — normalized types + reader.
 *
 * Types for anchors, groups, pages, colors, redirects, and footer.socials
 * are DERIVED from the Zod schemas in `src/schema.ts` via `z.output<>`.
 * Only normalized wrapper shapes (logo, favicon, navigation, navbar)
 * are defined here. Normalization logic lives in `lib/normalize-config.ts`.
 *
 * Supports three file names (first found wins):
 *   1. docs.json — Mintlify format, parsed as JSONC for comments/trailing commas
 *   2. docs.jsonc — Mintlify format with comments/trailing commas
 *   3. holocron.jsonc — legacy Holocron format with comments/trailing commas
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
  integrationsSchema,
  layoutSchema,
} from './schema.ts'
import { holocronConfigSchema } from './schema.ts'
import { parseJsonc } from './lib/jsonc.ts'
import { normalize } from './lib/normalize-config.ts'
import { formatConfigIssue, logger } from './lib/logger.ts'

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
 *  Link-only tabs are converted to anchors during normalization.
 *  Tabs with `openapi` have auto-generated groups from the spec. */
export type ConfigNavTab = NavTabBase & {
  groups: ConfigNavGroup[]
  /** OpenAPI spec path(s) — when present, groups are auto-generated from
   *  the spec at build time. Set by normalize when the raw tab has `openapi`. */
  openapi?: string | string[]
  /** Changelog source URL (e.g. `https://github.com/owner/repo`) — when
   *  present, a single changelog page is generated from the repository's
   *  releases. Set by normalize when the raw tab has `changelog`. */
  changelog?: string
  /** MCP definition file path or Streamable HTTP server URL — when present,
   *  tool/resource pages are auto-generated from the MCP definition. Set by
   *  normalize when the raw tab has `mcp`. */
  mcp?: string
  /** Path to a custom provider file (resolved relative to project root).
   *  The file default-exports a CustomTabProvider. */
  provider?: string
  /** When true, the custom provider runs at build time (full enrichment).
   *  When false/omitted, the provider runs at request time (cached). */
  static?: boolean
  /** Path to an MDX file whose content is prepended above the auto-generated
   *  changelog entries. Resolved relative to pagesDir or project root. */
  initialContent?: string
  /** Slug prefix for generated virtual pages. For OpenAPI tabs this is the
   *  endpoint-page prefix (defaults to `"api"`, `""` for no prefix). For
   *  changelog tabs this is the single page slug (defaults to `"changelog"`). */
  base?: string
  /** Internal snapshot of the author-written groups before a virtual-tab
   *  provider expands them (e.g. resolves `METHOD /path` refs and the `"..."`
   *  sentinel). The config object persists across dev-server re-syncs and
   *  `processVirtualTabs` mutates `groups` in place, so the original authored
   *  groups must be preserved to keep expansion idempotent. Set by
   *  `processVirtualTabs`; not part of the user-facing config. */
  authoredGroups?: ConfigNavGroup[]
}

/** A navbar icon link (top-right of header). The normalized form has
 *  `label` and `href` required (derived from raw type/url aliases). */
export type ConfigNavbarLink = {
  label: string
  href: string
  type?: string
  icon?: ConfigIcon
  iconColor?: string
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
  iconColor?: string
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
  iconColor?: string
  hidden?: boolean
  href?: string
  navigation?: { tabs: ConfigNavTab[]; anchors: ConfigAnchor[] }
}

export type HolocronConfig = {
  name: string
  description?: string
  logo: { light: string; dark?: string; href?: string; text?: string }
  favicon: { light: string; dark: string }
  colors: z.output<typeof colorsSchema> & { _hasUserColors: boolean }
  icons: z.output<typeof iconsSchema> & { library: 'fontawesome' | 'lucide' | 'tabler' }
  appearance: { default: 'system' | 'light' | 'dark'; strict: boolean }
  fonts?: {
    family?: string
    weight?: number
    source?: string
    format?: 'woff' | 'woff2'
    fontSize?: number
    heading?: { family: string; weight?: number; source?: string; format?: 'woff' | 'woff2'; fontSize?: number }
    body?: { family: string; weight?: number; source?: string; format?: 'woff' | 'woff2'; fontSize?: number }
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
  knownPaths: string[]
  footer: {
    socials: NonNullable<z.output<typeof footerSchema>['socials']>
    links: FooterLinkColumn[]
  }
  search: { prompt?: string }
  seo: { indexing?: 'navigable' | 'all'; metatags?: Record<string, string> }
  assistant: { enabled: boolean }
  decorativeLines: 'none' | 'lines' | 'dashed' | 'lines-with-dots'
  layout: { maxWidth: number; sidebarWidth: number; columnGap: number; radius: number }
  integrations: z.output<typeof integrationsSchema>
}

/* ── Type guard (for page entries) ───────────────────────────────────── */

export function isConfigNavGroup(entry: ConfigNavPageEntry): entry is ConfigNavGroup {
  return typeof entry === 'object' && entry !== null
}

/* ── Config reader ───────────────────────────────────────────────────── */

const CONFIG_FILE_NAMES = ['docs.json', 'docs.jsonc', 'holocron.jsonc'] as const

function parseConfigObject(raw: string): Record<string, unknown> {
  const parsed = parseJsonc(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Config file must contain a top-level JSON object')
  }
  return Object.fromEntries(Object.entries(parsed))
}

/**
 * Validate the raw config object against the Zod schema and log any issues
 * as warnings. Never throws — validation is informational only so existing
 * sites keep working even if their config has minor schema mismatches.
 */
export function validateConfig(raw: Record<string, unknown>): void {
  const result = holocronConfigSchema.safeParse(raw)
  if (result.success) return
  for (const issue of result.error.issues) {
    logger.warn(formatConfigIssue(issue))
  }
}

export function parseConfigSource(raw: string): HolocronConfig {
  return normalize(parseConfigObject(raw))
}

/**
 * Read and normalize the config file. All docs.json union variants are
 * collapsed into a single canonical shape so consumers never deal with
 * type discrimination.
 */
export function readConfig({
  root,
  configPath,
}: {
  root: string
  configPath?: string
}): HolocronConfig {
  // Explicit config path takes priority
  if (configPath) {
    const resolved = path.resolve(root, configPath)
    if (fs.existsSync(resolved)) {
      const raw = fs.readFileSync(resolved, 'utf-8')
      const parsed = parseConfigObject(raw)
      validateConfig(parsed)
      return normalize(parsed)
    }
    throw new Error(`Config file not found at: ${resolved}`)
  }
  // Auto-discovery
  for (const name of CONFIG_FILE_NAMES) {
    const filePath = path.join(root, name)
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const parsed = parseConfigObject(raw)
      validateConfig(parsed)
      return normalize(parsed)
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
