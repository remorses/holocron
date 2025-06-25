import type { DocsJsonType } from './docs-json'

export const footerSocialsOnlyExample: DocsJsonType = {
    name: 'Documentation with Social Links',

    footer: {
        socials: {
            twitter: 'https://twitter.com/example',
            github: 'https://github.com/example',
            discord: 'https://discord.gg/example',
        },
    },
}

export const footerLinksOnlyExample: DocsJsonType = {
    name: 'Documentation with Footer Links',

    footer: {
        links: [
            {
                header: 'Documentation',
                items: [
                    {
                        label: 'Getting Started',
                        href: 'https://docs.example.com/getting-started',
                    },
                    {
                        label: 'API Reference',
                        href: 'https://docs.example.com/api',
                    },
                ],
            },
            {
                items: [
                    {
                        label: 'Privacy',
                        href: 'https://example.com/privacy',
                    },
                    {
                        label: 'Terms',
                        href: 'https://example.com/terms',
                    },
                ],
            },
        ],
    },
}

// Complete Example
export const completeDocsConfigExample: DocsJsonType = {
    $schema: 'https://example.com/docs-schema.json',
    name: 'Example Documentation',
    description:
        'Complete example of docs.json configuration showcasing all available options',

    logo: {
        light: '/logo-light.svg',
        dark: '/logo-dark.svg',
        href: 'https://example.com',
    },

    favicon: {
        light: '/favicon-light.ico',
        dark: '/favicon-dark.ico',
    },

    navbar: {
        links: [
            {
                label: 'Documentation',
                href: 'https://docs.example.com',
                icon: 'book',
            },
            {
                label: 'API',
                href: 'https://api.example.com',
                icon: 'code',
            },
            {
                label: 'Community',
                href: 'https://community.example.com',
            },
        ],
        primary: {
            type: 'button',
            label: 'Get Started',
            href: 'https://app.example.com/signup',
        },
    },

    footer: {
        socials: {
            twitter: 'https://twitter.com/example',
            github: 'https://github.com/example',
            linkedin: 'https://linkedin.com/company/example',
            discord: 'https://discord.gg/example',
        },
        links: [
            {
                header: 'Product',
                items: [
                    {
                        label: 'Features',
                        href: 'https://example.com/features',
                    },
                    {
                        label: 'Pricing',
                        href: 'https://example.com/pricing',
                    },
                    {
                        label: 'Changelog',
                        href: 'https://example.com/changelog',
                    },
                ],
            },
            {
                header: 'Resources',
                items: [
                    {
                        label: 'Documentation',
                        href: 'https://docs.example.com',
                    },
                    {
                        label: 'API Reference',
                        href: 'https://api.example.com',
                    },
                    {
                        label: 'Blog',
                        href: 'https://blog.example.com',
                    },
                ],
            },
            {
                header: 'Company',
                items: [
                    {
                        label: 'About',
                        href: 'https://example.com/about',
                    },
                    {
                        label: 'Careers',
                        href: 'https://example.com/careers',
                    },
                    {
                        label: 'Contact',
                        href: 'https://example.com/contact',
                    },
                ],
            },
            {
                header: 'Legal',
                items: [
                    {
                        label: 'Privacy',
                        href: 'https://example.com/privacy',
                    },
                    {
                        label: 'Terms',
                        href: 'https://example.com/terms',
                    },
                ],
            },
        ],
    },

    banner: {
        content:
            "🎉 Version 2.0 is now available! <a href='/changelog'>See what's new</a>",
        dismissible: true,
    },

    contextual: {
        options: ['copy', 'view', 'chatgpt', 'claude'],
    },

    cssVariables: {
        '--primary-color': '#3b82f6',
        '--primary-hover': '#2563eb',
        '--secondary-color': '#10b981',
        '--border-radius': '8px',
        '--font-family-heading': "'Inter', system-ui, sans-serif",
        '--font-family-body': "'Inter', system-ui, sans-serif",
        '--sidebar-width': '280px',
        '--content-max-width': '1200px',
    },
}
