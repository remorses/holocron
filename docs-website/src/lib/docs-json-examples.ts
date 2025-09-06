import type { DocsJsonType } from './docs-json'
import { WEBSITE_DOMAIN, env } from './env'

export const defaultDocsJsonComments = {
  domains: `// to add new domains you can simply add them here, then add a CNAME record pointing to cname.${WEBSITE_DOMAIN}`,
  logo: `// the logo shown in the top left`,
  'navbar.links': `// the links shown in the top right`,
  'navbar.links.0.icon': `// you can use any lucide valid icon names: https://lucide.dev/icons/`,
  'navbar.primary': `// a button shown on the top right`,
}

export const defaultStartingHolocronJson: DocsJsonType = {
  $schema: `https://${WEBSITE_DOMAIN}/holocron.json`,
  siteId: '',
  name: 'Docs',
  disableEditButton: false,
  favicon: {
    light: '/favicon.svg',
    dark: '/favicon.svg',
  },
  logo: {
    light: new URL('/logo/dark.svg', env.PUBLIC_URL).href,
    dark: new URL('/logo/light.svg', env.PUBLIC_URL).href,
  },
  navbar: {
    links: [
      {
        label: 'Home',
        href: `https://${WEBSITE_DOMAIN}`,
        icon: 'document',
      },
    ],
    primary: {
      type: 'button',
      label: 'Get Started',
      href: `https://${WEBSITE_DOMAIN}/login`,
    },
  },

  footer: {
    socials: {
      twitter: 'https://x.com/__morse',
      github: 'https://github.com/remorses',
    },
    links: [
      {
        header: 'Documentation',
        items: [
          {
            label: 'Holocron',
            href: `https://${WEBSITE_DOMAIN}`,
          },
        ],
      },
    ],
  },
}

export const footerSocialsOnlyExample: DocsJsonType = {
  siteId: '',
  name: 'Documentation with Social Links',
  disableEditButton: false,

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
  siteId: '',
  disableEditButton: false,
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
  name: 'Example Documentation',
  description: 'Complete example of docs json configuration showcasing all available options',
  siteId: '',
  disableEditButton: false,
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
    content: "🎉 Version 2.0 is now available! <a href='/changelog'>See what's new</a>",
    dismissible: true,
  },

  contextual: {
    options: ['copy', 'view', 'chatgpt', 'claude'],
  },

  cssVariables: {
    light: {
      '--primary-color': '#3b82f6',
      '--primary-hover': '#2563eb',
      '--secondary-color': '#10b981',
      '--border-radius': '8px',
      '--font-family-heading': "'Inter', system-ui, sans-serif",
      '--font-family-body': "'Inter', system-ui, sans-serif",
      '--sidebar-width': '280px',
      '--content-max-width': '1200px',
    },
    dark: {
      '--primary-color': '#2563eb',
      '--primary-hover': '#1e40af',
      '--secondary-color': '#059669',
      '--border-radius': '8px',
      '--font-family-heading': "'Inter', system-ui, sans-serif",
      '--font-family-body': "'Inter', system-ui, sans-serif",
      '--sidebar-width': '280px',
      '--content-max-width': '1200px',
    },
  },
}
