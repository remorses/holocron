import { z } from 'zod'

// === Primitive helper schemas ===
const Color = z.string().regex(/^(#|rgb|rgba|hsl|hsla)\b/i, {
    message:
        'Must be a valid color: value must start with #, rgb, rgba, hsl, or hsla',
})

const ColorMode = z
    .object({
        light: Color,
        dark: Color,
    })
    .strict()

const IconSchema = z.union([
    z.string(),
    z
        .object({
            name: z.string(),
            library: z.enum(['fontawesome', 'lucide']),
            style: z.enum([
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
            ]),
        })
        .strict(),
])

// === Top-level component schemas ===
const ColorsSchema = z
    .object({
        primary: Color,
        light: Color.optional(),
        dark: Color.optional(),
    })
    .strict()

const LogoSchema = z.union([
    z.string().min(3),
    z
        .object({
            light: z.string(),
            dark: z.string(),
            href: z.string().url().optional(),
        })
        .strict(),
])

const FaviconSchema = z.union([
    z.string(),
    z.object({ light: z.string(), dark: z.string() }).strict(),
])

const RedirectSchema = z
    .object({
        source: z.string(),
        destination: z.string(),
        permanent: z.boolean().optional(),
    })
    .strict()

const BannerSchema = z
    .object({
        content: z.string().min(1),
        dismissible: z.boolean().optional(),
    })
    .strict()

const Error404Schema = z.object({ redirect: z.boolean().optional() }).strict()

const ErrorsSchema = z.object({ '404': Error404Schema }).strict()

const ContextualSchema = z
    .object({ options: z.array(z.enum(['copy', 'view', 'chatgpt', 'claude'])) })
    .strict()

// === Appearance & styling ===
const AppearanceSchema = z
    .object({
        default: z.enum(['system', 'light', 'dark']).optional(),
        strict: z.boolean().optional(),
    })
    .strict()

const BackgroundSchema = z
    .object({
        image: z.union([z.string(), ColorMode]),
        decoration: z.enum(['gradient', 'grid', 'windows']).optional(),
        color: z.object({ color: ColorMode }).optional(),
    })
    .strict()

const FontsSingle = z
    .object({
        family: z.string(),
        weight: z.number().optional(),
        source: z.string().url().optional(),
        format: z.enum(['woff', 'woff2']).optional(),
    })
    .strict()

const FontsSchema = z.union([
    FontsSingle,
    z.object({ heading: FontsSingle, body: FontsSingle }).strict(),
])

const IconsSchema = z
    .object({ library: z.enum(['fontawesome', 'lucide']) })
    .strict()

const StylingSchema = z
    .object({
        eyebrows: z.enum(['section', 'breadcrumbs']).optional(),
        codeblocks: z.enum(['system', 'dark']).optional(),
    })
    .strict()

// === Navigation (simplified general union of patterns) ===
const GlobalLinks = z
    .object({
        anchors: z
            .array(
                z
                    .object({ anchor: z.string(), href: z.string().url() })
                    .strict(),
            )
            .optional(),
    })
    .strict()

// Note: full navigation nav-languages, nav-versions, nav-tabs, etc. would follow similarly.
const NavigationSchema = z.union([
    z
        .object({
            global: GlobalLinks.optional(),
            languages: z
                .array(
                    z.object({
                        language: z.string(),
                        href: z.string().url().optional(),
                    }),
                )
                .min(1),
        })
        .strict(),
    z
        .object({
            global: GlobalLinks.optional(),
            versions: z.array(z.object({ version: z.string() })).min(1),
        })
        .strict(),
    z
        .object({
            global: GlobalLinks.optional(),
            tabs: z.array(z.object({ tab: z.string() })).min(1),
        })
        .strict(),
    z
        .object({
            global: GlobalLinks.optional(),
            dropdowns: z.array(z.object({ dropdown: z.string() })).min(1),
        })
        .strict(),
    z
        .object({
            global: GlobalLinks.optional(),
            anchors: z
                .array(z.object({ anchor: z.string(), href: z.string().url() }))
                .min(1),
        })
        .strict(),
    z
        .object({
            global: GlobalLinks.optional(),
            groups: z.array(z.object({ group: z.string() })).min(1),
        })
        .strict(),
    z
        .object({
            global: GlobalLinks.optional(),
            pages: z.array(z.string()).min(1),
        })
        .strict(),
])

// === Navbar & Footer ===
const NavbarLink = z
    .object({
        label: z.string(),
        href: z.string().url(),
        icon: IconSchema.optional(),
    })
    .strict()

const NavbarSchema = z
    .object({
        links: z.array(NavbarLink).optional(),
        primary: z
            .union([
                z
                    .object({
                        type: z.literal('button'),
                        label: z.string(),
                        href: z.string().url(),
                    })
                    .strict(),
                z
                    .object({
                        type: z.literal('github'),
                        href: z.string().url(),
                    })
                    .strict(),
            ])
            .optional(),
    })
    .strict()

const FooterLinkColumn = z
    .object({
        header: z.string().optional(),
        items: z
            .array(z.object({ label: z.string(), href: z.string().url() }))
            .min(1),
    })
    .strict()

const FooterSchema = z
    .object({
        socials: z.record(z.string().url()).optional(),
        links: z.array(FooterLinkColumn).min(1).optional(),
    })
    .strict()

// === Search & SEO ===
const SearchSchema = z.object({ prompt: z.string().optional() }).strict()

const SeoSchema = z
    .object({
        metatags: z.record(z.string()),
        indexing: z.enum(['navigable', 'all']).optional(),
    })
    .strict()

// === API ===
const OpenApiRef = z.union([z.string(), z.array(z.string())])
const ApiSchema = z
    .object({
        openapi: OpenApiRef.optional(),
        asyncapi: z.union([z.string(), z.array(z.string())]).optional(),
        params: z
            .object({ expanded: z.enum(['all', 'closed']).optional() })
            .strict()
            .optional(),
        playground: z
            .object({
                display: z.enum(['interactive', 'simple', 'none']),
                proxy: z.boolean().optional(),
            })
            .strict()
            .optional(),
        examples: z
            .object({
                defaults: z.enum(['required', 'all']),
                languages: z.array(z.string()),
            })
            .strict()
            .optional(),
        mdx: z
            .object({
                auth: z
                    .object({
                        method: z.enum(['bearer', 'basic', 'key', 'cobo']),
                        name: z.string(),
                    })
                    .strict()
                    .optional(),
                server: z.union([z.string(), z.array(z.string())]).optional(),
            })
            .strict()
            .optional(),
    })
    .strict()

// === Integrations ===
const IntegrationsSchema = z
    .object({
        amplitude: z.object({ apiKey: z.string() }).optional(),
        clearbit: z.object({ publicApiKey: z.string() }).optional(),
        fathom: z.object({ siteId: z.string() }).optional(),
        frontchat: z.object({ snippetId: z.string().min(6) }).optional(),
        ga4: z.object({ measurementId: z.string() }).optional(),
        gtm: z.object({ tagId: z.string() }).optional(),
        heap: z.object({ appId: z.string() }).optional(),
        hotjar: z.object({ hjid: z.string(), hjsv: z.string() }).optional(),
        intercom: z.object({ appId: z.string().min(6) }).optional(),
        koala: z.object({ publicApiKey: z.string().min(2) }).optional(),
        logrocket: z.object({ appId: z.string() }).optional(),
        mixpanel: z.object({ projectToken: z.string() }).optional(),
        osano: z
            .object({
                scriptSource: z
                    .string()
                    .url()
                    .refine(
                        (val) =>
                            val.startsWith('https://cmp.osano.com/') &&
                            val.endsWith('/osano.js'),
                    ),
            })
            .optional(),
        pirsch: z.object({ id: z.string() }).optional(),
        posthog: z
            .object({
                apiKey: z.string(),
                apiHost: z.string().url().optional(),
            })
            .optional(),
        plausible: z
            .object({ domain: z.string(), server: z.string().optional() })
            .optional(),
        segment: z.object({ key: z.string() }).optional(),
        telemetry: z.object({ enabled: z.boolean() }).optional(),
        cookies: z.object({ key: z.string(), value: z.string() }).optional(),
    })
    .strict()

// === Main docs.json schema ===
export const DocsConfigSchema = z
    .object({
        $schema: z.string().url().optional(),
        // theme: z.enum([
        //     'mint',
        //     'maple',
        //     'palm',
        //     'willow',
        //     'linden',
        //     'almond',
        //     'aspen',
        // ]),
        name: z.string().min(1),
        description: z.string().optional(),
        colors: ColorsSchema,
        logo: LogoSchema.optional(),
        favicon: FaviconSchema.optional(),
        api: ApiSchema.optional(),
        appearance: AppearanceSchema.optional(),
        background: BackgroundSchema.optional(),
        navbar: NavbarSchema.optional(),
        navigation: NavigationSchema,
        footer: FooterSchema.optional(),
        search: SearchSchema.optional(),
        seo: SeoSchema.optional(),
        fonts: FontsSchema.optional(),
        icons: IconsSchema.optional(),
        styling: StylingSchema.optional(),
        redirects: z.array(RedirectSchema).optional(),
        banner: BannerSchema.optional(),
        errors: ErrorsSchema.optional(),
        contextual: ContextualSchema.optional(),
        integrations: IntegrationsSchema.optional(),
    })
    .strict()
