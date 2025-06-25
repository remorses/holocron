import type { DocsJsonType } from './docs-json'

// Navigation Examples
export const navigationLanguagesExample: DocsJsonType = {
    name: 'Multi-Language Documentation',
    navigation: {
        global: {
            anchors: [
                {
                    anchor: 'GitHub',
                    href: 'https://github.com/yourorg/yourrepo',
                },
                {
                    anchor: 'API Reference',
                    href: 'https://api.example.com',
                },
            ],
        },
        languages: [
            {
                language: 'en',
                default: true,
                href: 'https://docs.example.com/en',
            },
            {
                language: 'fr',
                href: 'https://docs.example.com/fr',
            },
            {
                language: 'es',
                hidden: true,
                href: 'https://docs.example.com/es',
            },
        ],
    },
}

export const navigationVersionsExample: DocsJsonType = {
    name: 'Versioned API Documentation',
    navigation: {
        global: {
            anchors: [
                {
                    anchor: 'Changelog',
                    href: 'https://example.com/changelog',
                },
            ],
        },
        versions: [
            {
                version: 'v3.0',
                default: true,
                href: 'https://docs.example.com/v3',
            },
            {
                version: 'v2.0',
                href: 'https://docs.example.com/v2',
            },
            {
                version: 'v1.0',
                hidden: true,
                href: 'https://docs.example.com/v1',
            },
        ],
    },
}

export const navigationTabsExample: DocsJsonType = {
    name: 'Tab-Based Documentation',
    navigation: {
        global: {
            anchors: [
                {
                    anchor: 'Support',
                    href: 'https://support.example.com',
                },
            ],
        },
        tabs: [
            {
                tab: 'Getting Started',
                icon: 'rocket',
                href: 'https://docs.example.com/getting-started',
            },
            {
                tab: 'API Reference',
                icon: 'code',
                href: 'https://docs.example.com/api',
            },
            {
                tab: 'Guides',
                icon: 'book',
                hidden: false,
                href: 'https://docs.example.com/guides',
            },
        ],
    },
}

export const navigationDropdownsExample: DocsJsonType = {
    name: 'Dropdown Navigation Documentation',
    navigation: {
        global: {
            anchors: [
                {
                    anchor: 'Blog',
                    href: 'https://blog.example.com',
                },
            ],
        },
        dropdowns: [
            {
                dropdown: 'Products',
                icon: 'package',
                color: {
                    light: '#3b82f6',
                    dark: '#60a5fa',
                },
                description: 'Explore our product suite',
                href: 'https://products.example.com',
            },
            {
                dropdown: 'Resources',
                icon: 'library',
                description: 'Documentation and learning materials',
                hidden: false,
            },
            {
                dropdown: 'Community',
                icon: 'users',
                color: {
                    light: '#10b981',
                    dark: '#34d399',
                },
                description: 'Connect with other users',
            },
        ],
    },
}

export const navigationAnchorsExample: DocsJsonType = {
    name: 'Anchor-Based Documentation',
    navigation: {
        global: {
            anchors: [
                {
                    anchor: 'Status',
                    href: 'https://status.example.com',
                },
            ],
        },
        anchors: [
            {
                anchor: 'Introduction',
                icon: 'home',
                href: '/introduction',
            },
            {
                anchor: 'Installation',
                icon: 'download',
                color: {
                    light: '#8b5cf6',
                    dark: '#a78bfa',
                },
                href: '/installation',
            },
            {
                anchor: 'Configuration',
                icon: 'settings',
                hidden: false,
                href: '/configuration',
            },
            {
                anchor: 'Advanced Topics',
                icon: 'graduation-cap',
                href: '/advanced',
            },
        ],
    },
}

export const navigationGroupsExample: DocsJsonType = {
    name: 'Grouped Documentation',
    navigation: {
        global: {
            anchors: [
                {
                    anchor: 'Discord',
                    href: 'https://discord.gg/example',
                },
            ],
        },
        groups: [
            {
                group: 'Getting Started',
                icon: 'rocket',
                root: '/getting-started',
                tag: 'New',
                pages: ['introduction', 'quickstart', 'installation'],
            },
            {
                group: 'Core Concepts',
                icon: 'lightbulb',
                pages: [
                    'concepts/overview',
                    {
                        group: 'Architecture',
                        icon: 'building',
                        hidden: false,
                        pages: [
                            'concepts/architecture/overview',
                            'concepts/architecture/components',
                            'concepts/architecture/patterns',
                        ],
                    },
                    'concepts/best-practices',
                ],
            },
            {
                group: 'API Reference',
                icon: 'code',
                tag: 'Beta',
                root: '/api',
                pages: [
                    'api/authentication',
                    {
                        group: 'Endpoints',
                        pages: [
                            'api/endpoints/users',
                            'api/endpoints/projects',
                            'api/endpoints/webhooks',
                        ],
                    },
                ],
            },
        ],
    },
}

export const navigationPagesExample: DocsJsonType = {
    name: 'Simple Page List Documentation',
    navigation: {
        global: {
            anchors: [
                {
                    anchor: 'Roadmap',
                    href: 'https://roadmap.example.com',
                },
            ],
        },
        pages: [
            'introduction',
            'getting-started/quickstart',
            'getting-started/installation',
            'guides/basic-usage',
            'guides/advanced-features',
            'api/overview',
            'api/authentication',
            'api/endpoints',
            'troubleshooting',
            'faq',
        ],
    },
}

// Navbar Examples
export const navbarWithButtonExample: DocsJsonType = {
    name: 'Documentation with Button CTA',
    navigation: {
        pages: ['introduction', 'getting-started', 'api-reference'],
    },
    navbar: {
        links: [
            {
                label: 'Documentation',
                href: 'https://docs.example.com',
                icon: 'book',
            },
            {
                label: 'API Reference',
                href: 'https://api.example.com',
                icon: 'code',
            },
            {
                label: 'Blog',
                href: 'https://blog.example.com',
            },
            {
                label: 'Community',
                href: 'https://community.example.com',
                icon: 'users',
            },
        ],
        primary: {
            type: 'button',
            label: 'Get Started',
            href: 'https://app.example.com/signup',
        },
    },
}

export const navbarWithGithubExample: DocsJsonType = {
    name: 'Documentation with GitHub Link',
    navigation: {
        pages: ['introduction', 'installation', 'usage'],
    },
    navbar: {
        links: [
            {
                label: 'Docs',
                href: 'https://docs.example.com',
            },
            {
                label: 'Tutorials',
                href: 'https://tutorials.example.com',
                icon: 'graduation-cap',
            },
            {
                label: 'Pricing',
                href: 'https://example.com/pricing',
                icon: 'credit-card',
            },
        ],
        primary: {
            type: 'github',
            href: 'https://github.com/yourorg/yourrepo',
        },
    },
}

export const navbarMinimalExample: DocsJsonType = {
    name: 'Minimal Documentation',
    navigation: {
        pages: ['introduction', 'quickstart'],
    },
    navbar: {
        links: [
            {
                label: 'Home',
                href: 'https://example.com',
            },
            {
                label: 'Documentation',
                href: 'https://docs.example.com',
            },
        ],
    },
}

// Footer Examples
export const footerCompleteExample: DocsJsonType = {
    name: 'Documentation with Complete Footer',
    navigation: {
        pages: ['introduction', 'getting-started', 'api', 'guides'],
    },
    footer: {
        socials: {
            twitter: 'https://twitter.com/example',
            github: 'https://github.com/example',
            linkedin: 'https://linkedin.com/company/example',
            discord: 'https://discord.gg/example',
            youtube: 'https://youtube.com/@example',
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
                    {
                        label: 'Roadmap',
                        href: 'https://example.com/roadmap',
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
                        label: 'Guides',
                        href: 'https://example.com/guides',
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
                        label: 'Press',
                        href: 'https://example.com/press',
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
                        label: 'Privacy Policy',
                        href: 'https://example.com/privacy',
                    },
                    {
                        label: 'Terms of Service',
                        href: 'https://example.com/terms',
                    },
                    {
                        label: 'Cookie Policy',
                        href: 'https://example.com/cookies',
                    },
                ],
            },
        ],
    },
}

export const footerSocialsOnlyExample: DocsJsonType = {
    name: 'Documentation with Social Links',
    navigation: {
        pages: ['introduction', 'guides'],
    },
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
    navigation: {
        pages: ['introduction', 'api-reference'],
    },
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

    navigation: {
        global: {
            anchors: [
                {
                    anchor: 'GitHub',
                    href: 'https://github.com/example/repo',
                },
                {
                    anchor: 'Discord',
                    href: 'https://discord.gg/example',
                },
            ],
        },
        groups: [
            {
                group: 'Getting Started',
                icon: 'rocket',
                root: '/getting-started',
                tag: 'New',
                pages: [
                    'introduction',
                    'quickstart',
                    'installation',
                    {
                        group: 'Examples',
                        icon: 'code',
                        pages: [
                            'examples/basic',
                            'examples/advanced',
                            'examples/enterprise',
                        ],
                    },
                ],
            },
            {
                group: 'Core Concepts',
                icon: 'lightbulb',
                pages: [
                    'concepts/overview',
                    'concepts/architecture',
                    'concepts/best-practices',
                ],
            },
            {
                group: 'API Reference',
                icon: 'terminal',
                tag: 'v2.0',
                pages: [
                    'api/authentication',
                    'api/endpoints/users',
                    'api/endpoints/projects',
                    'api/errors',
                    'api/rate-limits',
                ],
            },
            {
                group: 'Advanced',
                icon: 'settings',
                hidden: false,
                pages: [
                    'advanced/performance',
                    'advanced/security',
                    'advanced/scaling',
                ],
            },
        ],
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

// All navigation examples collection
export const navigationExamples = {
    languages: navigationLanguagesExample,
    versions: navigationVersionsExample,
    tabs: navigationTabsExample,
    dropdowns: navigationDropdownsExample,
    anchors: navigationAnchorsExample,
    groups: navigationGroupsExample,
    pages: navigationPagesExample,
}

// All navbar examples collection
export const navbarExamples = {
    withButton: navbarWithButtonExample,
    withGithub: navbarWithGithubExample,
    minimal: navbarMinimalExample,
}

// All footer examples collection
export const footerExamples = {
    complete: footerCompleteExample,
    socialsOnly: footerSocialsOnlyExample,
    linksOnly: footerLinksOnlyExample,
}