import { z } from 'zod'

// === Primitive helper schemas ===
const Color = z
    .string()
    .regex(/^(#|rgb|rgba|hsl|hsla)\b/i, {
        message:
            'Must be a valid color: value must start with #, rgb, rgba, hsl, or hsla',
    })
    .describe('Hex, rgb, rgba, hsl, or hsla color string')

const ColorMode = z
    .object({
        light: Color.describe('Color used in light mode'),
        dark: Color.describe('Color used in dark mode'),
    })
    .strict()
    .describe('Pair of colors for light and dark mode')

const IconNameSchema = z.string().describe('Icon name or SVG path')
// .union([
//     z.string().describe('Icon name or SVG path'),
// TODO
// z
//     .object({
//         name: z.string().describe('Icon name'),
//         library: z
//             .enum(['fontawesome', 'lucide'])
//             .describe('Icon library'),
//         style: z
//             .enum([
//                 'brands',
//                 'duotone',
//                 'light',
//                 'regular',
//                 'sharp-duotone-solid',
//                 'sharp-light',
//                 'sharp-regular',
//                 'sharp-solid',
//                 'sharp-thin',
//                 'solid',
//                 'thin',
//             ])
//             .describe('Icon style'),
//     })
//     .strict()
//     .describe('Icon object with library and style'),
// ])
// .describe('Icon name or detailed icon object')

// === Top-level component schemas ===

const LogoSchema = z
    .union([
        z.string().min(3).describe('Path to logo image'),
        z
            .object({
                light: z.string().describe('Logo for light mode'),
                dark: z.string().describe('Logo for dark mode'),
                href: z
                    .string()
                    .url()
                    .optional()
                    .describe('Logo click target URL'),
            })
            .strict()
            .describe('Logo object for both modes'),
    ])
    .describe('Logo configuration')

const FaviconSchema = z
    .union([
        z.string().describe('Single favicon path'),
        z
            .object({
                light: z.string().describe('Favicon for light mode'),
                dark: z.string().describe('Favicon for dark mode'),
            })
            .strict()
            .describe('Favicon object for both modes'),
    ])
    .describe('Favicon configuration')

const RedirectSchema = z
    .object({
        source: z.string().describe('Original path to redirect from'),
        destination: z.string().describe('Destination path or URL'),
        permanent: z
            .boolean()
            .optional()
            .describe('Use HTTP 301 if true, else 302'),
    })
    .strict()
    .describe('Redirect rule')

const BannerSchema = z
    .object({
        content: z.string().min(1).describe('Banner HTML/MDX content'),
        dismissible: z
            .boolean()
            .optional()
            .describe('Whether the banner can be dismissed'),
    })
    .strict()
    .describe('Global banner configuration')

const Error404Schema = z
    .object({
        redirect: z.boolean().optional().describe('Redirect to home on 404'),
    })
    .strict()
    .describe('404 error page settings')

const ErrorsSchema = z
    .object({ '404': Error404Schema.describe('Settings for 404 errors') })
    .strict()
    .describe('Error pages configuration')

const ContextualSchema = z
    .object({ options: z.array(z.enum(['copy', 'view', 'chatgpt', 'claude'])) })
    .strict()
    .describe('Contextual action options (e.g., on code blocks)')

// === Navigation ===
const GlobalLinks = z
    .object({
        anchors: z
            .array(
                z
                    .object({
                        anchor: z.string().describe('Anchor name'),
                        href: z.string().url().describe('Anchor URL'),
                    })
                    .strict(),
            )
            .optional()
            .describe('Links applied globally'),
    })
    .strict()
    .describe('Site-wide external links')

const NavigationLanguageItem = z
    .object({
        language: z
            .string()
            .min(1)
            .describe(
                'The language code (ISO 639-1) for this section, e.g., "en", "fr", "es"',
            ),
        default: z
            .boolean()
            .optional()
            .describe('Whether this language is the default selection'),
        hidden: z
            .boolean()
            .optional()
            .describe('Whether the language is hidden by default'),
        href: z
            .string()
            .url()
            .optional()
            .describe('URL or root path for this language variant'),
    })
    .strict()
    .describe('Language item within navigation')

const NavigationVersionItem = z
    .object({
        version: z
            .string()
            .min(1)
            .describe('Version label (e.g., "v1.0", "latest")'),
        default: z
            .boolean()
            .optional()
            .describe('Whether this is the default version'),
        hidden: z
            .boolean()
            .optional()
            .describe('Whether this version selection is hidden by default'),
        href: z
            .string()
            .url()
            .optional()
            .describe('URL or root path for this version'),
    })
    .strict()
    .describe('Version item within navigation')

const NavigationTabItem = z
    .object({
        tab: z.string().min(1).describe('Tab name or label'),
        icon: IconNameSchema.optional().describe('Optional icon for the tab'),
        hidden: z
            .boolean()
            .optional()
            .describe('Whether the tab is hidden by default'),
        href: z
            .string()
            .url()
            .optional()
            .describe('URL or root path for this tab'),
    })
    .strict()
    .describe('Tab item for organizing navigation')

const NavigationDropdownItem = z
    .object({
        dropdown: z.string().min(1).describe('Dropdown name or label'),
        icon: IconNameSchema.optional().describe('Optional icon for the dropdown'),
        color: ColorMode.optional().describe('Optional custom color'),
        description: z
            .string()
            .optional()
            .describe('Text description shown for dropdown'),
        hidden: z
            .boolean()
            .optional()
            .describe('Whether the dropdown is hidden by default'),
        href: z
            .string()
            .url()
            .optional()
            .describe('Optional URL linked from the dropdown'),
    })
    .strict()
    .describe('Dropdown item for navigation groups')

const NavigationAnchorItem = z
    .object({
        anchor: z
            .string()
            .min(1)
            .describe('Anchor name/section for this navigation entry'),
        icon: IconNameSchema.optional().describe('Optional icon for this section'),
        color: ColorMode.optional().describe('Optional custom color'),
        hidden: z
            .boolean()
            .optional()
            .describe('Whether the anchor/section is hidden by default'),
        href: z
            .string()
            .url()
            .optional()
            .describe('Optional link or path for this anchor'),
    })
    .strict()
    .describe('Anchor item for navigation')

const NavigationPages = z
    .array(z.string().min(1).describe('Path to a documentation page'))
    .describe('List of page paths in navigation')

// --- NavigationGroupItem definition
const NavigationGroupItem: z.ZodType<any> = z.lazy(() =>
    z
        .object({
            group: z.string().min(1).describe('Name of the navigation group'),
            icon: IconNameSchema.optional().describe('Group section icon'),
            hidden: z
                .boolean()
                .optional()
                .describe('Whether this group is hidden by default'),
            root: z
                .string()
                .optional()
                .describe('Path to the root page of this group'),
            tag: z.string().optional().describe('Optional tag for this group'),
            // Groups may nest anchors or pages/groups
            pages: z
                .array(
                    z.union([
                        z.string().min(1),
                        // Use a lazy reference for recursion, but mark with type 'any'
                        z.lazy(() => NavigationGroupItem),
                    ]),
                )
                .optional()
                .describe('Nested list of page paths or group objects'),
        })
        .strict()
        .describe('Navigation group, can contain nested pages or groups'),
)

// --- Patterns for navigation root ---

/**
 * The navigation supports a variety of layouts:
 * - Languages: organize by language (site is multi-lingual)
 * - Versions: organize by product version (versioned docs)
 * - Tabs: organize content by tab headers
 * - Dropdowns: use dropdown sections
 * - Anchors: a flat list of main docs sections
 * - Groups: group sections into labeled subgroups
 * - Pages: a flat list of page paths, with optional nesting
 *
 * Optionally, each can include a 'global' object with links/anchors shown in all navigation contexts.
 */

const NavigationSchema = z
    .union([
        // Organize content by language
        z
            .object({
                global: GlobalLinks.optional().describe(
                    'External/global links shown site-wide',
                ),
                languages: z
                    .array(NavigationLanguageItem)
                    .min(1)
                    .describe(
                        'Organize navigation by language (for multi-language sites)',
                    ),
            })
            .strict(),

        // Organize by docs version
        z
            .object({
                global: GlobalLinks.optional().describe(
                    'External/global links shown site-wide',
                ),
                versions: z
                    .array(NavigationVersionItem)
                    .min(1)
                    .describe('Organize navigation by product or API version'),
            })
            .strict(),

        // Organize by tabs
        z
            .object({
                global: GlobalLinks.optional().describe(
                    'External/global links shown site-wide',
                ),
                tabs: z
                    .array(NavigationTabItem)
                    .min(1)
                    .describe(
                        'Organize navigation by tab (top-level sections as tabs)',
                    ),
            })
            .strict(),

        // Organize by dropdowns
        z
            .object({
                global: GlobalLinks.optional().describe(
                    'External/global links shown site-wide',
                ),
                dropdowns: z
                    .array(NavigationDropdownItem)
                    .min(1)
                    .describe(
                        'Organize navigation using dropdowns for grouped content',
                    ),
            })
            .strict(),

        // Organize by anchors
        z
            .object({
                global: GlobalLinks.optional().describe(
                    'External/global links shown site-wide',
                ),
                anchors: z
                    .array(NavigationAnchorItem)
                    .min(1)
                    .describe(
                        'Flat list: organize navigation sections as anchors',
                    ),
            })
            .strict(),

        // Top-level groups that may contain nested items
        z
            .object({
                global: GlobalLinks.optional().describe(
                    'External/global links shown site-wide',
                ),
                groups: z
                    .array(NavigationGroupItem)
                    .min(1)
                    .describe('Group navigation with nested pages/groups'),
            })
            .strict(),

        // Simple flat list of page paths (optionally with groups)
        z
            .object({
                global: GlobalLinks.optional().describe(
                    'External/global links shown site-wide',
                ),
                pages: NavigationPages.min(1).describe(
                    'Simple linear list of doc page paths',
                ),
            })
            .strict(),
    ])
    .describe(
        `Navigation tree configuration for Mintlify docs.

The navigation can be customized by:
- languages: Language-based navigation, allowing users to select between languages (e.g., 'en', 'fr', etc).
- versions: Grouped by doc/codebase version (e.g., 'v1', 'v2', etc).
- tabs: Segments top-level docs into tabs for distinct content areas.
- dropdowns: Use dropdown lists for grouped navigation.
- anchors: Show a flat list of docs sections/anchors in the sidebar.
- groups: Organize navigation into labeled and optionally nested groups.
- pages: List of doc pages as simple paths.

Use the appropriate field for your site's organization (one pattern per config). A 'global' field is available to add universal links/anchors that appear in all navigation contexts.

Each field inside (languages, versions, etc) supports further customization of entries: 'icon', 'color', 'hidden', descriptions, and nested structures for advanced multi-dimensional docs.
`,
    )

// === Navbar & Footer ===
const NavbarLink = z
    .object({
        label: z.string().describe('Link text'),
        href: z.string().url().describe('Link URL'),
        icon: IconNameSchema.optional().describe('Optional icon'),
    })
    .strict()
    .describe('Navbar link entry')

const NavbarSchema = z
    .object({
        links: z.array(NavbarLink).optional().describe('Array of navbar links'),
        primary: z
            .union([
                z
                    .object({
                        type: z.literal('button').describe('CTA type button'),
                        label: z.string().describe('Button label'),
                        href: z.string().url().describe('Button link URL'),
                    })
                    .strict(),
                z
                    .object({
                        type: z.literal('github').describe('CTA type GitHub'),
                        href: z.string().url().describe('GitHub repo URL'),
                    })
                    .strict(),
            ])
            .optional()
            .describe('Primary call-to-action'),
    })
    .strict()
    .describe('Top navbar configuration')

const FooterLinkColumn = z
    .object({
        header: z.string().optional().describe('Column header'),
        items: z
            .array(
                z
                    .object({
                        label: z.string().describe('Item text'),
                        href: z.string().url().describe('Item link URL'),
                    })
                    .strict(),
            )
            .min(1)
            .describe('Column link items'),
    })
    .strict()
    .describe('Footer link column')

const FooterSchema = z
    .object({
        socials: z
            .record(z.string().url())
            .optional()
            .describe('Social media links'),
        links: z
            .array(FooterLinkColumn)
            .min(1)
            .optional()
            .describe('Footer link sections'),
    })
    .strict()
    .describe('Footer configuration')

// === Search & SEO ===
const SearchSchema = z
    .object({
        prompt: z.string().optional().describe('Search box placeholder'),
    })
    .strict()
    .describe('Search settings')

const SeoSchema = z
    .object({
        metatags: z.record(z.string()).describe('Additional meta tags'),
        indexing: z
            .enum(['navigable', 'all'])
            .optional()
            .describe('SEO indexing mode'),
    })
    .strict()
    .describe('SEO configuration')

// === API ===
const OpenApiRef = z
    .union([
        z.string().describe('URL or path'),
        z.array(z.string().describe('List of URLs or paths')),
    ])
    .describe('Reference to OpenAPI resources')

const ApiSchema = z
    .object({
        openapi: OpenApiRef.optional(),
        asyncapi: z
            .union([z.string(), z.array(z.string())])
            .optional()
            .describe('AsyncAPI references'),
        params: z
            .object({
                expanded: z
                    .enum(['all', 'closed'])
                    .optional()
                    .describe('Params expansion state'),
            })
            .strict()
            .optional(),
        playground: z
            .object({
                display: z
                    .enum(['interactive', 'simple', 'none'])
                    .describe('Playground UI mode'),
                proxy: z
                    .boolean()
                    .optional()
                    .describe('Use proxy for requests'),
            })
            .strict()
            .optional(),
        examples: z
            .object({
                defaults: z
                    .enum(['required', 'all'])
                    .describe('Example defaults'),
                languages: z.array(z.string()).describe('Snippets languages'),
            })
            .strict()
            .optional(),
        mdx: z
            .object({
                auth: z
                    .object({
                        method: z
                            .enum(['bearer', 'basic', 'key', 'cobo'])
                            .describe('Auth method'),
                        name: z.string().describe('Auth header/key name'),
                    })
                    .strict()
                    .optional(),
                server: z
                    .union([z.string(), z.array(z.string())])
                    .optional()
                    .describe('Base server URL(s)'),
            })
            .strict()
            .optional(),
    })
    .strict()
    .describe('API reference and playground settings')

// === Integrations ===
const IntegrationsSchema = z
    .object({
        amplitude: z
            .object({ apiKey: z.string().describe('Amplitude API key') })
            .optional(),
        clearbit: z
            .object({
                publicApiKey: z.string().describe('Clearbit public key'),
            })
            .optional(),
        fathom: z
            .object({ siteId: z.string().describe('Fathom site ID') })
            .optional(),
        frontchat: z
            .object({
                snippetId: z.string().min(6).describe('Frontchat snippet ID'),
            })
            .optional(),
        ga4: z
            .object({
                measurementId: z.string().describe('GA4 Measurement ID'),
            })
            .optional(),
        gtm: z.object({ tagId: z.string().describe('GTM Tag ID') }).optional(),
        heap: z
            .object({ appId: z.string().describe('Heap App ID') })
            .optional(),
        hotjar: z
            .object({ hjid: z.string(), hjsv: z.string() })
            .optional()
            .describe('Hotjar site and snippet version'),
        intercom: z
            .object({ appId: z.string().min(6).describe('Intercom App ID') })
            .optional(),
        koala: z
            .object({
                publicApiKey: z.string().min(2).describe('Koala public key'),
            })
            .optional(),
        logrocket: z
            .object({ appId: z.string().describe('LogRocket App ID') })
            .optional(),
        mixpanel: z
            .object({ projectToken: z.string().describe('Mixpanel token') })
            .optional(),
        osano: z
            .object({
                scriptSource: z
                    .string()
                    .url()
                    .refine(
                        (val) =>
                            val.startsWith('https://cmp.osano.com/') &&
                            val.endsWith('/osano.js'),
                    )
                    .describe('Osano script URL'),
            })
            .optional(),
        pirsch: z
            .object({ id: z.string().describe('Pirsch site ID') })
            .optional(),
        posthog: z
            .object({
                apiKey: z.string().describe('PostHog API key'),
                apiHost: z
                    .string()
                    .url()
                    .optional()
                    .describe('PostHog host URL'),
            })
            .optional(),
        plausible: z
            .object({
                domain: z.string().describe('Plausible domain'),
                server: z.string().optional().describe('Plausible server URL'),
            })
            .optional(),
        segment: z
            .object({ key: z.string().describe('Segment write key') })
            .optional(),
        telemetry: z
            .object({ enabled: z.boolean().describe('Enable telemetry') })
            .optional(),
        cookies: z
            .object({
                key: z.string().describe('Cookie name'),
                value: z.string().describe('Cookie value'),
            })
            .optional(),
    })
    .strict()
    .describe('Third-party integration configs')

const CSSVariablesSchema = z
    .record(z.string())
    .describe(
        'Object of CSS variable names and their values. Variables defined here will be injected into the website as CSS custom properties.',
    )

// === Main docs.json schema ===
export const DocsConfigSchema = z
    .object({
        $schema: z
            .string()
            .url()
            .optional()
            .describe('Schema URL for IDE autocomplete'),
        name: z.string().min(1).describe('Project or product name'),
        description: z.string().optional().describe('SEO description'),
        logo: LogoSchema.optional().describe('Logo config'),
        favicon: FaviconSchema.optional().describe('Favicon config'),
        // api: ApiSchema.optional().describe('API reference settings'),
        navbar: NavbarSchema.optional().describe('Top navbar settings'),
        navigation: NavigationSchema.describe('Site navigation structure'),
        footer: FooterSchema.optional().describe('Footer content'),
        // search: SearchSchema.optional().describe('Search behavior'),
        // seo: SeoSchema.optional().describe('SEO meta & indexing'),
        // redirects: z
        //     .array(RedirectSchema)
        //     .optional()
        //     .describe('Redirect rules'),
        banner: BannerSchema.optional().describe('Site-wide banner'),
        // errors: ErrorsSchema.optional().describe('Error page config'),
        contextual: ContextualSchema.optional().describe('Contextual actions'),
        cssVariables: CSSVariablesSchema.optional().describe('CSS variables'),
        // integrations: IntegrationsSchema.optional().describe('Integrations'),
    })
    .strict()
    .describe('Schema for docs.json configuration')

export type DocsJsonType = z.infer<typeof DocsConfigSchema>
