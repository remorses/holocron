/**
 * Holocron config Zod schema — single source of truth.
 *
 * This file defines the raw INPUT shape users write in `holocron.jsonc`
 * (or `docs.json`). It mirrors the Mintlify docs.json shape for the subset
 * of fields that Holocron actually consumes.
 *
 * The generated `schema.json` (written by `scripts/generate-schema.ts`)
 * is derived from this file via `z.toJSONSchema()`. Any time you edit
 * the schemas here, regenerate schema.json by running:
 *
 *     pnpm -F @holocron.so/vite generate-schema
 *
 * Fields OUTSIDE the MVP subset (theme, api, appearance, fonts, seo, etc.)
 * are accepted via .passthrough() so Mintlify-only fields do not break
 * validation — they are simply ignored at runtime by `normalize()` in
 * `config.ts`.
 */

import { z } from 'zod'
import dedent from 'dedent'

/* ── Icon ─────────────────────────────────────────────────────────────── */

const iconObjectSchema = z.object({
  name: z.string().describe('The name of the icon'),
  style: z
    .enum([
      'brands',
      'duotone',
      'light',
      'regular',
      'sharp-duotone-solid',
      'sharp-light',
      'sharp-regular',
      'sharp-solid',
      'sharp-thin',
      'solid',
      'thin',
    ])
    .optional()
    .describe('The Font Awesome icon style variant'),
  library: z
    .enum(['fontawesome', 'lucide', 'tabler'])
    .optional()
    .describe('The icon library to resolve the icon name from'),
})

export const iconSchema = z
  .union([z.string(), iconObjectSchema])
  .describe('The icon to be displayed in the section')
  .meta({ id: 'iconSchema' })

/* ── Colors ───────────────────────────────────────────────────────────── */

const hexColor = z
  .string()
  .regex(/^#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/)

export const colorsSchema = z
  .object({
    primary: hexColor.describe('The primary color of the theme'),
    light: hexColor
      .optional()
      .describe('The light color of the theme. Used for dark mode'),
    dark: hexColor
      .optional()
      .describe('The dark color of the theme. Used for light mode'),
  })
  .describe(
    dedent`
      The colors to use in your documentation. At the very least, you must
      define the primary color. For example:
      { "colors": { "primary": "#ff0000" } }
    `,
  )
  .meta({ id: 'colorsSchema' })

/* ── Logo ─────────────────────────────────────────────────────────────── */

export const logoSchema = z
  .union([
    z
      .string()
      .min(3)
      .describe('The logo (for both light and dark mode)'),
    z.object({
      light: z.string().describe(
        dedent`
          Path pointing to the light logo file to use in dark mode,
          including the file extension. Example: \`/logo.png\`
        `,
      ),
      dark: z.string().describe(
        dedent`
          Path pointing to the dark logo file to use in light mode,
          including the file extension. Example: \`/logo-dark.png\`
        `,
      ),
      href: z
        .string()
        .optional()
        .describe(
          dedent`
            The URL to redirect to when clicking the logo. If not provided,
            the logo will link to the homepage. Example: \`https://example.com\`
          `,
        ),
    }),
  ])
  .describe(
    dedent`
      The logo configuration. Can be a single image path for both light and
      dark mode, or separate paths for each mode with an optional click
      target URL
    `,
  )
  .meta({ id: 'logoSchema' })

/* ── Favicon ──────────────────────────────────────────────────────────── */

export const faviconSchema = z
  .union([
    z.string().describe(
      dedent`
        Path pointing to the favicon file in your docs folder, including
        the file extension. The favicon will automatically be resized to
        the appropriate sizes
      `,
    ),
    z
      .object({
        light: z.string().describe(
          dedent`
            Path pointing to the light favicon file to use in dark mode,
            including the file extension. Example: \`/favicon.png\`
          `,
        ),
        dark: z.string().describe(
          dedent`
            Path pointing to the dark favicon file to use in light mode,
            including the file extension. Example: \`/favicon-dark.png\`
          `,
        ),
      })
      .describe(
        dedent`
          The path to the favicon. Can be a single file or a pair for
          light and dark mode. Example: \`/favicon.png\`
        `,
      ),
  ])
  .meta({ id: 'faviconSchema' })

/* ── Anchor ───────────────────────────────────────────────────────────── */

export const anchorSchema = z
  .object({
    anchor: z.string().min(1).describe('The name of the anchor'),
    href: z.string().describe('A valid path or external link'),
    icon: iconSchema.optional(),
    hidden: z
      .boolean()
      .optional()
      .describe('Whether the anchor is hidden by default'),
  })
  .describe('A persistent link rendered as a tab in the tab bar')
  .meta({ id: 'anchorSchema' })

/* ── Pages / Groups (recursive) ───────────────────────────────────────── */

/**
 * A page entry is either a string slug pointing at an MDX file, or a
 * nested group. Defined here with a forward reference for recursion.
 *
 * Holocron follows Mintlify's convention: individual pages carry their
 * `icon` in MDX frontmatter (not in the navigation config), so there is
 * no page-object form in the navigation schema.
 */
export type PageEntryInput = string | GroupInput

export type GroupInput = {
  group: string
  icon?: z.input<typeof iconSchema>
  pages: PageEntryInput[]
  hidden?: boolean
  root?: string
  tag?: string
  expanded?: boolean
}

export const groupSchema: z.ZodType<GroupInput> = z
  .object({
    group: z.string().min(1).describe('The name of the group'),
    icon: iconSchema.optional(),
    hidden: z
      .boolean()
      .optional()
      .describe('Whether the group is hidden by default'),
    root: z
      .string()
      .min(1)
      .optional()
      .describe(
        dedent`
          A page in the navigation referenced by its path. Example:
          \`path/to/page\`
        `,
      ),
    tag: z.string().optional().describe('Tag for the group'),
    expanded: z
      .boolean()
      .optional()
      .describe('Whether the group is expanded by default'),
    get pages() {
      return z
        .array(z.union([z.string(), groupSchema]))
        .describe(
          dedent`
            The pages in the group. Each entry is either a string slug
            pointing at an MDX file, or a nested group object
          `,
        )
    },
  })
  .describe('A sidebar group containing pages and/or nested groups')
  .meta({ id: 'groupSchema' })

/* ── Tab variants ─────────────────────────────────────────────────────── */

/** Fields common to every tab variant: name, icon, hidden, align.
 *  Exported so the enriched-tree `NavTab` type can re-use its output shape. */
export const tabBaseSchema = z
  .object({
    tab: z.string().min(1).describe('The name of the tab'),
    icon: iconSchema.optional(),
    hidden: z
      .boolean()
      .optional()
      .describe('Whether the tab is hidden by default'),
    align: z
      .enum(['start', 'end'])
      .optional()
      .describe('Tab alignment in the navigation'),
  })
  .meta({ id: 'tabBaseSchema' })

const tabWithGroupsSchema = tabBaseSchema.extend({
  groups: z.array(groupSchema).describe('The sidebar groups inside the tab'),
})

const tabWithPagesSchema = tabBaseSchema.extend({
  get pages() {
    return z
      .array(z.union([z.string(), groupSchema]))
      .describe(
        dedent`
          The pages of the tab, flat (no groups wrapper). Each entry is a
          string slug or a nested group
        `,
      )
  },
})

const tabWithHrefSchema = tabBaseSchema.extend({
  href: z
    .string()
    .describe(
      dedent`
        A URL for a link-only tab. When set, this tab behaves as an anchor
        pointing at an external URL
      `,
    ),
})

export const tabSchema = z
  .union([tabWithGroupsSchema, tabWithPagesSchema, tabWithHrefSchema])
  .describe(
    dedent`
      A top-level tab in the navigation. Either contains sidebar groups, a
      flat list of pages, or is a link-only tab pointing at an external URL
    `,
  )
  .meta({ id: 'tabSchema' })

/* ── Navigation ───────────────────────────────────────────────────────── */

const navigationGlobalSchema = z
  .object({
    anchors: z
      .array(anchorSchema)
      .optional()
      .describe(
        dedent`
          Anchors displayed across all tabs. Useful for external links like
          a GitHub repo or a changelog that should always be visible
        `,
      ),
  })
  .describe(
    dedent`
      Navigation items rendered globally across all tabs and pages
    `,
  )

const navigationTabsObjectSchema = z.object({
  tabs: z.array(tabSchema).describe('The tabs rendered in the tab bar'),
  global: navigationGlobalSchema.optional(),
  anchors: z.array(anchorSchema).optional().describe(
    dedent`
      Anchors displayed across all tabs. Alternative to \`global.anchors\`
    `,
  ),
})

const navigationGroupsObjectSchema = z.object({
  groups: z
    .array(groupSchema)
    .describe('Root sidebar groups (rendered without a tab wrapper)'),
  global: navigationGlobalSchema.optional(),
  anchors: z.array(anchorSchema).optional(),
})

const navigationPagesObjectSchema = z.object({
  get pages() {
    return z
      .array(z.union([z.string(), groupSchema]))
      .describe(
        dedent`
          Root pages (rendered without a tab or group wrapper). Each entry
          is a string slug or a nested group
        `,
      )
  },
  global: navigationGlobalSchema.optional(),
  anchors: z.array(anchorSchema).optional(),
})

export const navigationSchema = z
  .union([
    navigationTabsObjectSchema,
    navigationGroupsObjectSchema,
    navigationPagesObjectSchema,
    z.array(tabSchema).describe('A shorthand array of tabs'),
    z.array(groupSchema).describe('A shorthand array of root groups'),
  ])
  .describe(
    dedent`
      The site navigation. Can be an object with \`tabs\`, \`groups\`, or
      \`pages\`, or a shorthand array of tabs or groups
    `,
  )
  .meta({ id: 'navigationSchema' })

/* ── Navbar ───────────────────────────────────────────────────────────── */

const navbarLinkSchema = z
  .object({
    label: z
      .string()
      .optional()
      .describe(
        dedent`
          The text label of the link. If omitted, it is derived from
          \`type\` (e.g. \`github\` → "GitHub")
        `,
      ),
    type: z
      .string()
      .optional()
      .describe(
        dedent`
          The kind of link. Known values: \`github\`, \`discord\`,
          \`slack\`, \`button\`, \`link\`. Controls the default icon and
          label
        `,
      ),
    href: z
      .string()
      .optional()
      .describe('The URL of the link'),
    url: z
      .string()
      .optional()
      .describe(
        'Alias for `href` for Mintlify compatibility',
      ),
    icon: iconSchema.optional(),
  })
  .describe('A link rendered in the top navbar')
  .meta({ id: 'navbarLinkSchema' })

const navbarPrimarySchema = z
  .object({
    label: z.string().optional().describe('The button label'),
    type: z
      .string()
      .optional()
      .describe(
        dedent`
          The kind of primary button. Known values: \`button\`, \`github\`.
          Controls the default styling
        `,
      ),
    href: z
      .string()
      .optional()
      .describe('The URL the primary button navigates to'),
    url: z
      .string()
      .optional()
      .describe('Alias for `href` for Mintlify compatibility'),
    icon: iconSchema.optional(),
  })
  .describe('The primary CTA button rendered at the right of the navbar')
  .meta({ id: 'navbarPrimarySchema' })

export const navbarSchema = z
  .object({
    links: z
      .array(navbarLinkSchema)
      .optional()
      .describe('Links in the navbar'),
    primary: navbarPrimarySchema.optional(),
  })
  .describe('Navbar content and settings')
  .meta({ id: 'navbarSchema' })

/* ── Redirects ────────────────────────────────────────────────────────── */

export const redirectSchema = z
  .object({
    source: z.string().describe('The source path pattern to match'),
    destination: z.string().describe('The destination path to redirect to'),
    permanent: z
      .boolean()
      .optional()
      .describe(
        dedent`
          Whether the redirect is permanent (301) or temporary (302).
          Defaults to \`false\`
        `,
      ),
  })
  .describe('A single URL redirect rule')
  .meta({ id: 'redirectSchema' })

/* ── Footer ───────────────────────────────────────────────────────────── */

/**
 * Known social platform keys. Users can add any string key — we
 * document the known ones but accept arbitrary strings via the
 * `.passthrough()` on the outer schema.
 */
const socialPlatformKeys = [
  'x',
  'website',
  'facebook',
  'youtube',
  'discord',
  'slack',
  'github',
  'linkedin',
  'instagram',
  'hacker-news',
  'medium',
  'telegram',
  'twitter',
  'x-twitter',
  'earth-americas',
  'bluesky',
  'threads',
  'reddit',
  'podcast',
] as const

export const footerSchema = z
  .object({
    socials: z
      .partialRecord(z.enum(socialPlatformKeys), z.string())
      .optional()
      .describe(
        dedent`
          An object in which each key is the name of a social media
          platform and each value is the URL to your profile.
          For example: { "x": "https://x.com/mintlify" }
        `,
      ),
  })
  .describe('Footer configurations')
  .meta({ id: 'footerSchema' })

/* ── Root config ──────────────────────────────────────────────────────── */

export const holocronConfigSchema = z
  .object({
    $schema: z
      .string()
      .optional()
      .describe('The URL of the schema file'),
    name: z
      .string()
      .min(1)
      .describe('The name of the project, organization, or product'),
    description: z
      .string()
      .optional()
      .describe('Optional description used for SEO and LLM indexing'),
    logo: logoSchema.optional(),
    favicon: faviconSchema.optional(),
    colors: colorsSchema.optional(),
    navigation: navigationSchema.optional(),
    navbar: navbarSchema.optional(),
    footer: footerSchema.optional(),
    redirects: z
      .array(redirectSchema)
      .optional()
      .describe('URL redirect rules applied before routing'),
  })
  .passthrough()
  .describe(
    dedent`
      Holocron site configuration. Compatible with Mintlify docs.json —
      any additional Mintlify fields outside this schema are accepted and
      ignored at runtime
    `,
  )
  .meta({ id: 'holocronConfigSchema' })

/** Inferred input type for the raw config (before normalize()) */
export type HolocronConfigRaw = z.input<typeof holocronConfigSchema>
