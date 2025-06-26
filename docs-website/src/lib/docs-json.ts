import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { extractNamePathsFromSchema } from './schema-path-utils'

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

const LogoSchema = z
    .object({
        light: z.string().describe('Logo for light mode'),
        dark: z.string().describe('Logo for dark mode'),
        href: z.string().url().optional().describe('Logo click target URL'),
    })
    .strict()
    .describe('Logo object for both modes')

const FaviconSchema = z
    .object({
        light: z.string().describe('Favicon for light mode'),
        dark: z.string().describe('Favicon for dark mode'),
    })
    .strict()
    .describe('Favicon object for both modes')

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

const NavigationAnchorItem = z
    .object({
        anchor: z
            .string()
            .min(1)
            .describe('Anchor name/section for this navigation entry'),
        icon: IconNameSchema.optional().describe(
            'Optional icon for this section',
        ),
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
        // TODO
        navTopLinks: z.array(NavigationAnchorItem).optional(),
        description: z.string().optional().describe('SEO description'),
        logo: LogoSchema.optional().describe('Logo config'),
        favicon: FaviconSchema.optional().describe('Favicon config'),
        // api: ApiSchema.optional().describe('API reference settings'),
        navbar: NavbarSchema.optional().describe('Top navbar settings'),

        footer: FooterSchema.optional().describe('Footer content'),
        // search: SearchSchema.optional().describe('Search behavior'),
        // // TODO
        seo: SeoSchema.optional().describe('SEO meta & indexing'),
        redirects: z
            .array(RedirectSchema)
            .optional()
            .describe('Redirect rules'),
        banner: BannerSchema.optional().describe('Site-wide banner'),
        // errors: ErrorsSchema.optional().describe('Error page config'),
        contextual: ContextualSchema.optional().describe('Contextual actions'),
        cssVariables: CSSVariablesSchema.optional().describe('CSS variables'),
        // integrations: IntegrationsSchema.optional().describe('Integrations'),
        domains: z
            .array(z.string())
            .optional()
            .describe(
                'Custom domains to connect to this documentation site. Each domain should point to cname.fumabase.com via CNAME record. Domains will be connected when docs.json is pushed to the main branch.',
            ),
    })
    .strict()
    .describe('Schema for docs.json configuration')

export type DocsJsonType = z.infer<typeof DocsConfigSchema>

export const docsJsonSchema = zodToJsonSchema(DocsConfigSchema, {
    $refStrategy: 'none',
})

export const exampleNamePathsForDocsJson = extractNamePathsFromSchema(
    docsJsonSchema as any,
)
