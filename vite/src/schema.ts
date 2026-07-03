/**
 * Holocron config Zod schema — single source of truth.
 *
 * This file defines the raw INPUT shape users write in `docs.json`,
 * `docs.jsonc`, or `holocron.jsonc`. It mirrors the Mintlify docs.json shape for the subset
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

/* ── Icon name schemas (external $ref for IDE autocomplete) ───────────── */

const lucideIconNameSchema = z
  .string()
  .meta({ $ref: 'https://holocron.so/schemas/lucide-icons.json' })

const fontawesomeIconNameSchema = z
  .string()
  .meta({ $ref: 'https://holocron.so/schemas/fontawesome-icons.json' })

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
    .enum(['fontawesome', 'lucide'])
    .optional()
    .describe('The icon library to resolve the icon name from'),
})

export const iconSchema = z
  .union([lucideIconNameSchema, fontawesomeIconNameSchema, z.string(), iconObjectSchema])
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
      .describe(
        'A lighter shade of the primary color, displayed in dark mode. The name describes the color tone, not the mode it appears in. Mintlify convention.',
      ),
    dark: hexColor
      .optional()
      .describe(
        'A darker shade of the primary color, displayed in light mode. The name describes the color tone, not the mode it appears in. Mintlify convention.',
      ),
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
      text: z
        .string()
        .optional()
        .describe(
          dedent`
            Text to display next to the logo image, typically the site or
            product name. Example: \`"Libretto"\`
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

export const iconColorSchema = z
  .string()
  .optional()
  .describe('Color for the icon. Accepts named colors (green, blue, red, purple, orange, yellow, pink) or any CSS color string (hex, rgb, etc.). Sidebar page icons with a color are desaturated by default and become fully saturated on hover or when the page is active.')
  .meta({ id: 'iconColorSchema' })

export const anchorSchema = z
  .object({
    anchor: z.string().min(1).describe('The name of the anchor'),
    href: z.string().describe('A valid path or external link'),
    icon: iconSchema.optional(),
    iconColor: iconColorSchema,
    hidden: z
      .boolean()
      .optional()
      .describe('Whether the anchor is hidden by default'),
    placement: z
      .enum(['tabs', 'sidebar'])
      .optional()
      .describe('Where to render this anchor. "sidebar" (default) shows it in the left navigation sidebar, "tabs" shows it in the header tab bar'),
  })
  .describe('A persistent link rendered in the tab bar or sidebar')
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
  iconColor?: string
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
    iconColor: iconColorSchema,
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
            pointing at an MDX file, or a nested group object. Order pages
            following progressive disclosure: start with introductory
            content, then core concepts, then advanced topics
          `,
        )
    },
  })
  .describe(
    dedent`
      A sidebar group containing pages and/or nested groups. Order groups
      following progressive disclosure: introductory groups first (getting
      started, quickstart), then core concept groups, then advanced or
      reference groups last. Readers should be able to read top-to-bottom
      without needing to jump ahead
    `,
  )
  .meta({ id: 'groupSchema' })

/* ── Tab variants ─────────────────────────────────────────────────────── */

/** Fields common to every tab variant: name, icon, hidden, align.
 *  Exported so the enriched-tree `NavTab` type can re-use its output shape. */
export const tabBaseSchema = z
  .object({
    tab: z.string().min(1).describe('The name of the tab'),
    icon: iconSchema.optional(),
    iconColor: iconColorSchema,
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
  base: z
    .string()
    .optional()
    .describe(
      dedent`
        Slug prefix for generated OpenAPI pages. Defaults to \`"api"\`.
        Set to \`""\` for no prefix. A leading slash is allowed and ignored,
        so \`"/docs/api"\` behaves the same as \`"docs/api"\`. Example: with
        \`"reference"\`, endpoints are generated at \`/reference/get-users\`
        instead of \`/api/get-users\`
      `,
    ),
  groups: z
    .array(groupSchema)
    .optional()
    .describe(
      dedent`
        Optional sidebar groups for "selective endpoints" mode. When set,
        endpoints are NOT auto-grouped by tag. Instead, list page entries
        explicitly: normal slugs render MDX pages, while entries matching
        \`METHOD /path\` (e.g. \`"GET /users"\`) render the auto-generated
        endpoint page from the spec. This lets you interleave guides (auth,
        API keys, overview) with endpoint pages. Use the special \`"..."\`
        entry to expand all remaining (unlisted) endpoints, auto-grouped by
        tag, at that position
      `,
    ),
  get pages() {
    return z
      .array(z.union([z.string(), groupSchema]))
      .optional()
      .describe(
        dedent`
          Optional flat page list for "selective endpoints" mode. Same rules
          as \`groups\` but without a group wrapper. Mix MDX slugs with
          \`METHOD /path\` endpoint references to control ordering. Add a
          \`"..."\` entry to auto-include all remaining endpoints (grouped by
          tag) after your intro pages
        `,
      )
  },
})

const tabWithChangelogSchema = tabBaseSchema.extend({
  changelog: z
    .string()
    .describe(
      dedent`
        URL of a releases page to generate a changelog tab from. Currently
        only GitHub is supported, e.g.
        \`"https://github.com/owner/repo"\`. Holocron fetches the
        repository's published releases and renders one changelog page with
        an entry per release. The left navigation sidebar is hidden on this
        page
      `,
    ),
  base: z
    .string()
    .optional()
    .describe(
      dedent`
        Slug for the generated changelog page. Defaults to \`"changelog"\`,
        so the page is served at \`/changelog\`. A leading slash is allowed
        and ignored, so \`"/docs/changelog"\` behaves the same as
        \`"docs/changelog"\`
      `,
    ),
  initialContent: z
    .string()
    .optional()
    .describe(
      dedent`
        Path to an MDX file whose content is prepended above the
        auto-generated changelog entries. Use this to add a custom hero
        section, introduction, or \`<Above>\` block at the top of the
        changelog page. The path is resolved relative to pagesDir (or
        project root), e.g. \`"changelog/intro"\`
      `,
    ),
})

const tabWithMCPSchema = tabBaseSchema.extend({
  mcp: z
    .string()
    .describe(
      dedent`
        Path to a local MCP definition JSON file, or URL of a Streamable
        HTTP MCP server endpoint. When a local file, the JSON must contain
        \`tools\`, \`resources\`, and/or \`prompts\` arrays matching the
        MCP specification shapes. Each tool becomes a generated page with
        its input schema rendered as a parameter list. Example:
        \`"mcp-tools.json"\` or \`"https://api.example.com/mcp"\`
      `,
    ),
  base: z
    .string()
    .optional()
    .describe(
      dedent`
        Slug prefix for generated MCP pages. Defaults to \`"mcp"\`. Set to
        \`""\` for no prefix. A leading slash is allowed and ignored, so
        \`"/tools"\` behaves the same as \`"tools"\`
      `,
    ),
  groups: z
    .array(groupSchema)
    .optional()
    .describe(
      dedent`
        Optional sidebar groups for selective mode. When set, tools are
        NOT auto-grouped. List page entries explicitly: normal slugs
        render MDX pages, while tool names render the auto-generated tool
        page. Use the special \`"..."\` entry to expand all remaining
        tools/resources at that position
      `,
    ),
  get pages() {
    return z
      .array(z.union([z.string(), groupSchema]))
      .optional()
      .describe(
        dedent`
          Optional flat page list for selective mode. Same rules as
          \`groups\` but without a group wrapper. Mix MDX slugs with
          tool names. Add a \`"..."\` entry to auto-include all remaining
          tools and resources after your intro pages
        `,
      )
  },
})

const tabWithImageboardSchema = tabBaseSchema.extend({
  imageboard: z
    .string()
    .describe(
      dedent`
        Path to a folder of images and videos, relative to the project
        root. The folder is walked recursively and every image and video
        found is rendered in a masonry grid, sorted by last edit time
        (newest first). Edit times come from git commit history so the
        order is stable across clones and CI deployments. Examples:
        \`"./public/moodboard"\` or \`"./inspiration"\`. Files outside
        \`public/\` are copied into the build automatically
      `,
    ),
  base: z
    .string()
    .optional()
    .describe(
      dedent`
        Slug for the generated imageboard page. Defaults to the folder
        name, e.g. \`"./public/moodboard"\` is served at \`/moodboard\`.
        A leading slash is allowed and ignored
      `,
    ),
  columns: z
    .number()
    .int()
    .min(1)
    .max(8)
    .optional()
    .describe(
      dedent`
        Maximum number of masonry columns on wide viewports. Defaults to
        \`3\`. Fewer columns are used automatically on narrow viewports
      `,
    ),
})

const tabWithProviderSchema = tabBaseSchema.extend({
  provider: z
    .string()
    .describe(
      dedent`
        Path to a file that default-exports a CustomTabProvider object.
        The provider's generate() function produces navigation groups and
        MDX page content from an external source. Example:
        \`"./providers/blog.ts"\`
      `,
    ),
  base: z
    .string()
    .optional()
    .describe(
      dedent`
        Slug prefix for generated pages. Defaults to the provider's name.
        A leading slash is allowed and ignored
      `,
    ),
  static: z
    .boolean()
    .optional()
    .describe(
      dedent`
        When true, the provider runs at build time (like OpenAPI/changelog).
        Content goes through the full enrichment pipeline. When false
        (default), the provider runs at request time and the result is
        cached. Runtime mode skips build-time image optimization but
        serves fresh content without rebuilds
      `,
    ),
})

export const tabSchema = z
  .union([
    tabWithGroupsSchema,
    tabWithPagesSchema,
    tabWithHrefSchema,
    tabWithOpenAPISchema,
    tabWithChangelogSchema,
    tabWithMCPSchema,
    tabWithImageboardSchema,
    tabWithProviderSchema,
  ])
  .describe(
    dedent`
      A top-level tab in the navigation. Either contains sidebar groups, a
      flat list of pages, a link-only tab, an OpenAPI spec for
      auto-generated API reference pages, a changelog generated from a
      GitHub releases page, an MCP server definition for auto-generated
      tool and resource documentation pages, an imageboard folder rendered
      as a masonry image grid, or a custom provider file that generates
      pages from an external source
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
    iconColor: iconColorSchema,
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
    iconColor: iconColorSchema,
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
  tabs: z.array(tabSchema).describe(
    dedent`
      The tabs rendered in the tab bar. Order tabs following progressive
      disclosure: documentation and guides first, then API reference, then
      changelog. Tabs that link out to external URLs (\`href\`) go last.
      This keeps the navigation looking clean and guides the reader from
      concepts to reference
    `,
  ),
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
    iconColor: iconColorSchema,
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
    iconColor: iconColorSchema,
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
  fontSize: z
    .number()
    .optional()
    .describe(
      dedent`
        Font size in pixels for this font role. For heading fonts,
        this sets the size of all heading levels (h1, h2, h3).
        Defaults to \`16\` for headings
      `,
    ),
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
    fontSize: z
      .number()
      .optional()
      .describe(
        dedent`
          Body text font size in pixels. Defaults to \`14\`
        `,
      ),
    heading: fontBaseSchema.optional().describe('Override font settings for headings'),
    body: fontBaseSchema.optional().describe('Override font settings for body text'),
  })
  .describe('Custom fonts for your documentation')
  .meta({ id: 'fontsSchema' })

export const iconsSchema = z
  .object({
    library: z
      .enum(['fontawesome', 'lucide'])
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

/* ── Layout ───────────────────────────────────────────────────────────── */

export const layoutSchema = z
  .object({
    maxWidth: z
      .number()
      .optional()
      .describe(
        dedent`
          Maximum page width in pixels. The page grid is capped at this
          value. Content, sidebars, and gaps all live inside this
          constraint. Defaults to \`1200\`
        `,
      ),
    sidebarWidth: z
      .number()
      .optional()
      .describe(
        dedent`
          Width of the left sidebar (table of contents) in pixels.
          Defaults to \`230\`
        `,
      ),
    columnGap: z
      .number()
      .optional()
      .describe(
        dedent`
          Gap between the three grid columns (left sidebar, content,
          right sidebar) in pixels. Defaults to \`60\`
        `,
      ),
    radius: z
      .number()
      .optional()
      .describe(
        dedent`
          Base border radius in pixels. All rounded corners in the UI
          derive from this value. Defaults to \`10\`
        `,
      ),
  })
  .describe(
    dedent`
      Page grid layout and geometry. The content column width is derived
      automatically: content = maxWidth - sidebarWidth - rightSidebar - 2 × columnGap.
      Increasing maxWidth grows the content column up to its 720px cap,
      then extra space becomes gap
    `,
  )
  .meta({ id: 'layoutSchema' })

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

/* ── Integrations (analytics) ─────────────────────────────────────────── */

export const integrationsSchema = z
  .object({
    fathom: z
      .object({
        siteId: z.string().describe('Your Fathom site ID'),
      })
      .optional()
      .describe('Fathom Analytics — privacy-first website analytics'),
    ga4: z
      .object({
        measurementId: z
          .string()
          .describe('Google Analytics 4 measurement ID (starts with G-)'),
      })
      .optional()
      .describe('Google Analytics 4'),
    gtm: z
      .object({
        tagId: z
          .string()
          .describe('Google Tag Manager container ID (starts with GTM-)'),
      })
      .optional()
      .describe('Google Tag Manager'),
    posthog: z
      .object({
        apiKey: z.string().describe('PostHog project API key (starts with phc_)'),
        apiHost: z
          .string()
          .optional()
          .describe(
            'PostHog API host. Defaults to https://us.i.posthog.com',
          ),
      })
      .optional()
      .describe('PostHog product analytics'),
    plausible: z
      .object({
        domain: z.string().describe('Your domain as registered in Plausible'),
        server: z
          .string()
          .optional()
          .describe(
            'Custom Plausible server hostname for self-hosted instances (e.g. "plausible.example.com")',
          ),
      })
      .optional()
      .describe('Plausible Analytics — lightweight, privacy-friendly analytics'),
    mixpanel: z
      .object({
        projectToken: z.string().describe('Mixpanel project token'),
      })
      .optional()
      .describe('Mixpanel product analytics'),
    amplitude: z
      .object({
        apiKey: z.string().describe('Amplitude project API key'),
      })
      .optional()
      .describe('Amplitude analytics'),
    hotjar: z
      .object({
        hjid: z.string().describe('Hotjar Site ID'),
        hjsv: z.string().describe('Hotjar Snippet Version'),
      })
      .optional()
      .describe('Hotjar behavior analytics (heatmaps, recordings)'),
    pirsch: z
      .object({
        id: z.string().describe('Pirsch identification code'),
      })
      .optional()
      .describe('Pirsch Analytics — cookie-free web analytics'),
    heap: z
      .object({
        appId: z.string().describe('Heap application ID'),
      })
      .optional()
      .describe('Heap product analytics (auto-capture)'),
    segment: z
      .object({
        key: z.string().describe('Segment write key'),
      })
      .optional()
      .describe('Segment analytics data platform'),
    clarity: z
      .object({
        projectId: z.string().describe('Microsoft Clarity project ID'),
      })
      .optional()
      .describe('Microsoft Clarity — free heatmaps and session recordings'),
    logrocket: z
      .object({
        appId: z.string().describe('LogRocket application ID'),
      })
      .optional()
      .describe('LogRocket session replay and error tracking'),
    clearbit: z
      .object({
        publicApiKey: z.string().describe('Clearbit public API key'),
      })
      .optional()
      .describe('Clearbit visitor identification'),
  })
  .passthrough()
  .describe(
    dedent`
      Third-party analytics integrations. Add your provider credentials
      here and the corresponding tracking scripts are injected automatically.
      Only public API keys are needed — never include private/secret keys
    `,
  )
  .meta({ id: 'integrationsSchema' })

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
    knownPaths: z
      .array(z.string())
      .optional()
      .describe(
        dedent`
          Paths that should not trigger broken-link warnings even if they
          don't correspond to an MDX page. Useful when mounting the docs
          app alongside other routes (API endpoints, custom pages, external
          apps). Supports exact paths and prefix patterns with trailing
          wildcards. Example: \`["/api/*", "/dashboard", "/blog/*"]\`
        `,
      ),
    search: searchSchema.optional(),
    seo: seoSchema.optional(),
    assistant: assistantSchema.optional(),
    decorativeLines: decorativeLinesSchema.optional(),
    layout: layoutSchema.optional(),
    integrations: integrationsSchema.optional(),
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
