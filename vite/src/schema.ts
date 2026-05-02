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

const tabWithOpenAPISchema = tabBaseSchema.extend({
  openapi: z
    .union([z.string(), z.array(z.string())])
    .describe(
      dedent`
        Path to an OpenAPI specification file (JSON or YAML), or an array
        of paths. Endpoints from the spec are auto-generated as pages
        grouped by tag. Example: \`"openapi.json"\` or
        \`["openapi/v1.json", "openapi/v2.json"]\`
      `,
    ),
  openapiBase: z
    .string()
    .optional()
    .describe(
      dedent`
        Slug prefix for generated OpenAPI pages. Defaults to \`"api"\`.
        Set to \`""\` for no prefix. Example: with \`"reference"\`,
        endpoints are generated at \`/reference/get-users\` instead of
        \`/api/get-users\`
      `,
    ),
})

export const tabSchema = z
  .union([tabWithGroupsSchema, tabWithPagesSchema, tabWithHrefSchema, tabWithOpenAPISchema])
  .describe(
    dedent`
      A top-level tab in the navigation. Either contains sidebar groups, a
      flat list of pages, a link-only tab, or an OpenAPI spec for
      auto-generated API reference pages
    `,
  )
  .meta({ id: 'tabSchema' })

/* ── Version ──────────────────────────────────────────────────────────── */

/** Inner content fields reused by version, dropdown, and product schemas. */
const innerNavigationFields = {
  tabs: z.array(tabSchema).optional().describe('Tabs within this item'),
  groups: z.array(groupSchema).optional().describe('Sidebar groups within this item'),
  get pages() {
    return z
      .array(z.union([z.string(), groupSchema]))
      .optional()
      .describe('Pages within this item (flat, no groups wrapper)')
  },
  anchors: z.array(anchorSchema).optional().describe('Anchors within this item'),
}

export const versionSchema = z
  .object({
    version: z.string().min(1).describe('Display name of the version'),
    default: z
      .boolean()
      .optional()
      .describe('Whether this is the default version'),
    tag: z
      .string()
      .optional()
      .describe(
        dedent`
          Badge label displayed next to the version in the selector.
          Use to highlight versions such as "Latest", "Beta", "Deprecated"
        `,
      ),
    hidden: z
      .boolean()
      .optional()
      .describe('Whether this version is hidden from the selector'),
    ...innerNavigationFields,
  })
  .describe('A version entry for the version switcher dropdown')
  .meta({ id: 'versionSchema' })

/* ── Dropdown ─────────────────────────────────────────────────────────── */

export const dropdownSchema = z
  .object({
    dropdown: z.string().min(1).describe('Display name of the dropdown item'),
    icon: iconSchema.optional(),
    hidden: z
      .boolean()
      .optional()
      .describe('Whether this dropdown item is hidden'),
    href: z
      .string()
      .optional()
      .describe(
        dedent`
          A URL for a link-only dropdown item. When set, selecting this
          item navigates to the URL instead of switching sidebar content
        `,
      ),
    ...innerNavigationFields,
  })
  .describe('A dropdown navigation item, either with content or a link')
  .meta({ id: 'dropdownSchema' })

/* ── Product ──────────────────────────────────────────────────────────── */

export const productSchema = z
  .object({
    product: z.string().min(1).describe('Display name of the product'),
    description: z
      .string()
      .optional()
      .describe('Description of the product'),
    icon: iconSchema.optional(),
    href: z
      .string()
      .optional()
      .describe('A URL for a link-only product entry'),
    ...innerNavigationFields,
  })
  .describe(
    dedent`
      A product entry for the product switcher. Normalized into a
      dropdown item at runtime
    `,
  )
  .meta({ id: 'productSchema' })

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

const navigationVersionsObjectSchema = z.object({
  versions: z
    .array(versionSchema)
    .describe('Version entries for the version switcher'),
  global: navigationGlobalSchema.optional(),
  anchors: z.array(anchorSchema).optional(),
})

const navigationDropdownsObjectSchema = z.object({
  dropdowns: z
    .array(dropdownSchema)
    .describe('Dropdown entries for the dropdown switcher'),
  global: navigationGlobalSchema.optional(),
  anchors: z.array(anchorSchema).optional(),
})

const navigationProductsObjectSchema = z.object({
  products: z
    .array(productSchema)
    .describe('Product entries for the product switcher'),
  global: navigationGlobalSchema.optional(),
  anchors: z.array(anchorSchema).optional(),
})

export const navigationSchema = z
  .union([
    navigationTabsObjectSchema,
    navigationGroupsObjectSchema,
    navigationPagesObjectSchema,
    navigationVersionsObjectSchema,
    navigationDropdownsObjectSchema,
    navigationProductsObjectSchema,
    z.array(tabSchema).describe('A shorthand array of tabs'),
    z.array(groupSchema).describe('A shorthand array of root groups'),
  ])
  .describe(
    dedent`
      The site navigation. Can be an object with \`tabs\`, \`groups\`,
      \`pages\`, \`versions\`, \`dropdowns\`, or \`products\`, or a
      shorthand array of tabs or groups
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

/* ── Appearance ───────────────────────────────────────────────────────── */

export const appearanceSchema = z
  .object({
    default: z
      .enum(['system', 'light', 'dark'])
      .optional()
      .describe(
        dedent`
          Default color mode. Choose \`system\` to match the user's OS
          setting, or \`light\` or \`dark\` to force a specific mode.
          Defaults to \`system\`
        `,
      ),
    strict: z
      .boolean()
      .optional()
      .describe(
        dedent`
          When \`true\`, hides the light/dark mode toggle so users
          cannot switch modes. Defaults to \`false\`
        `,
      ),
  })
  .describe('Light/dark mode settings')
  .meta({ id: 'appearanceSchema' })

/* ── Search ───────────────────────────────────────────────────────────── */

export const searchSchema = z
  .object({
    prompt: z
      .string()
      .optional()
      .describe('Placeholder text displayed in the search bar when empty'),
  })
  .describe('Search bar display settings')
  .meta({ id: 'searchSchema' })

/* ── Assistant ────────────────────────────────────────────────────────── */

export const assistantSchema = z
  .object({
    enabled: z
      .boolean()
      .optional()
      .describe(
        dedent`
          Whether to show the AI chat assistant. When \`false\`, the sidebar
          widget, chat drawer, mobile "Ask AI" button, and the chat API
          endpoint are all disabled. Defaults to \`true\`
        `,
      ),
  })
  .describe('AI chat assistant settings')
  .meta({ id: 'assistantSchema' })

/* ── SEO ──────────────────────────────────────────────────────────────── */

export const seoSchema = z
  .object({
    indexing: z
      .enum(['navigable', 'all'])
      .optional()
      .describe(
        dedent`
          Which pages search engines should index. \`navigable\` indexes
          only pages in navigation, \`all\` indexes every page
        `,
      ),
    metatags: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        dedent`
          Custom meta tags added to every page. Each key is a meta tag
          name and the value is its content
        `,
      ),
  })
  .describe('Search engine optimization settings')
  .meta({ id: 'seoSchema' })

/* ── Banner ───────────────────────────────────────────────────────────── */

export const bannerSchema = z
  .object({
    content: z
      .string()
      .min(1)
      .describe(
        dedent`
          The text content displayed in the banner. Supports basic
          markdown links like \`[text](url)\`
        `,
      ),
    dismissible: z
      .boolean()
      .optional()
      .describe(
        'Whether to show a dismiss button. Defaults to `false`',
      ),
  })
  .describe('A site-wide banner displayed at the top of every page')
  .meta({ id: 'bannerSchema' })

/* ── Fonts ────────────────────────────────────────────────────────────── */

const fontBaseSchema = z.object({
  family: z.string().describe('Font family name (e.g. "Inter", "Open Sans")'),
  weight: z
    .number()
    .optional()
    .describe('Font weight (e.g. 400, 700)'),
  source: z
    .string()
    .optional()
    .describe(
      dedent`
        URL to a hosted font or path to a local font file. Local files
        must be placed in the \`public/\` directory and referenced with
        an absolute path (e.g. \`/fonts/my-font.woff2\`)
      `,
    ),
  format: z
    .enum(['woff', 'woff2'])
    .optional()
    .describe('Font file format. Required when using a local source file'),
})

export const fontsSchema = z
  .object({
    family: z
      .string()
      .optional()
      .describe('Font family name. Google Fonts family names load automatically'),
    weight: z
      .number()
      .optional()
      .describe('Font weight'),
    source: z
      .string()
      .optional()
      .describe(
        dedent`
          URL to a hosted font or path to a local font file. Local files
          must be placed in the \`public/\` directory (e.g. \`public/fonts/my-font.woff2\`)
          and referenced as \`/fonts/my-font.woff2\`
        `,
      ),
    format: z
      .enum(['woff', 'woff2'])
      .optional()
      .describe('Font file format. Required when using a local source file'),
    heading: fontBaseSchema.optional().describe('Override font settings for headings'),
    body: fontBaseSchema.optional().describe('Override font settings for body text'),
  })
  .describe('Custom fonts for your documentation')
  .meta({ id: 'fontsSchema' })

export const iconsSchema = z
  .object({
    library: z
      .enum(['fontawesome', 'lucide', 'tabler'])
      .optional()
      .describe('Project-wide icon library used for plain icon strings'),
  })
  .describe('Icon library settings')
  .meta({ id: 'iconsSchema' })

/* ── Footer links ─────────────────────────────────────────────────────── */

const footerLinkItemSchema = z.object({
  label: z.string().min(1).describe('Link text'),
  href: z.string().describe('Link destination URL'),
})

const footerLinkColumnSchema = z.object({
  header: z.string().optional().describe('Column header title'),
  items: z.array(footerLinkItemSchema).describe('Links in the column'),
})

/* ── Decorative lines ─────────────────────────────────────────────────── */

export const decorativeLinesSchema = z
  .enum(['none', 'lines', 'dashed', 'lines-with-dots'])
  .describe(
    dedent`
      Decorative border lines framing the page layout at grid boundaries.
      \`none\` disables all decorative lines.
      \`lines\` renders solid 1px lines at the page edges and content column boundaries.
      \`dashed\` renders segmented (dashed) lines.
      \`lines-with-dots\` renders solid lines with dot ornaments at vertices.
      Defaults to \`lines-with-dots\`
    `,
  )
  .meta({ id: 'decorativeLinesSchema' })

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
    appearance: appearanceSchema.optional(),
    fonts: fontsSchema.optional(),
    icons: iconsSchema.optional(),
    navigation: navigationSchema.optional(),
    navbar: navbarSchema.optional(),
    banner: bannerSchema.optional(),
    footer: footerSchema
      .extend({
        links: z
          .array(footerLinkColumnSchema)
          .max(4)
          .optional()
          .describe('Link columns displayed in the footer. Maximum 4 columns'),
      })
      .optional(),
    redirects: z
      .array(redirectSchema)
      .optional()
      .describe('URL redirect rules applied before routing'),
    search: searchSchema.optional(),
    seo: seoSchema.optional(),
    assistant: assistantSchema.optional(),
    decorativeLines: decorativeLinesSchema.optional(),
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
