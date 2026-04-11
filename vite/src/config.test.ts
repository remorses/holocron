import { describe, test, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readConfig, resolveConfigPath } from './config.ts'

/* ── Helpers ─────────────────────────────────────────────────────────── */

let tmpDir: string

function setupConfig(filename: string, content: object): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-config-test-'))
  const filePath = path.join(tmpDir, filename)
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2))
  return tmpDir
}

afterEach(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

/* ── Config file discovery ───────────────────────────────────────────── */

describe('readConfig file discovery', () => {
  test('reads holocron.jsonc', () => {
    const root = setupConfig('holocron.jsonc', { name: 'Test' })
    const config = readConfig({ root })
    expect(config.name).toBe('Test')
  })

  test('reads docs.json as fallback', () => {
    const root = setupConfig('docs.json', { name: 'Docs Fallback' })
    const config = readConfig({ root })
    expect(config.name).toBe('Docs Fallback')
  })

  test('holocron.jsonc takes priority over docs.json', () => {
    const root = setupConfig('holocron.jsonc', { name: 'Primary' })
    fs.writeFileSync(path.join(root, 'docs.json'), JSON.stringify({ name: 'Secondary' }))
    const config = readConfig({ root })
    expect(config.name).toBe('Primary')
  })

  test('throws when no config file found', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-empty-'))
    expect(() => readConfig({ root })).toThrow('No config file found')
    fs.rmSync(root, { recursive: true, force: true })
  })

  test('explicit configPath overrides auto-discovery', () => {
    const root = setupConfig('holocron.jsonc', { name: 'Auto' })
    fs.writeFileSync(path.join(root, 'custom.json'), JSON.stringify({ name: 'Custom' }))
    const config = readConfig({ root, configPath: 'custom.json' })
    expect(config.name).toBe('Custom')
  })
})

/* ── resolveConfigPath ───────────────────────────────────────────────── */

describe('resolveConfigPath', () => {
  test('returns path when holocron.jsonc exists', () => {
    const root = setupConfig('holocron.jsonc', {})
    const resolved = resolveConfigPath({ root })
    expect(resolved).toBe(path.join(root, 'holocron.jsonc'))
  })

  test('returns undefined when no config exists', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-empty2-'))
    expect(resolveConfigPath({ root })).toBeUndefined()
    fs.rmSync(root, { recursive: true, force: true })
  })
})

/* ── Logo normalization ──────────────────────────────────────────────── */

describe('logo normalization', () => {
  test('string logo becomes light + dark with same value', () => {
    const root = setupConfig('holocron.jsonc', { logo: '/logo.svg' })
    const config = readConfig({ root })
    expect(config.logo).toMatchInlineSnapshot(`
      {
        "light": "/logo.svg",
      }
    `)
  })

  test('relative logo path becomes root-absolute', () => {
    const root = setupConfig('docs.json', { logo: './logo/light.png' })
    const config = readConfig({ root })
    expect(config.logo.light).toBe('/logo/light.png')
  })

  test('object logo preserves light/dark/href', () => {
    const root = setupConfig('holocron.jsonc', {
      logo: { light: '/light.svg', dark: '/dark.svg', href: '/' },
    })
    const config = readConfig({ root })
    expect(config.logo).toMatchInlineSnapshot(`
      {
        "dark": "/dark.svg",
        "href": "/",
        "light": "/light.svg",
      }
    `)
  })

  test('missing logo defaults to empty strings', () => {
    const root = setupConfig('holocron.jsonc', {})
    const config = readConfig({ root })
    expect(config.logo).toMatchInlineSnapshot(`
      {
        "light": "",
      }
    `)
  })
})

/* ── Favicon normalization ───────────────────────────────────────────── */

describe('favicon normalization', () => {
  test('string favicon becomes light + dark', () => {
    const root = setupConfig('holocron.jsonc', { favicon: '/favicon.ico' })
    const config = readConfig({ root })
    expect(config.favicon).toMatchInlineSnapshot(`
      {
        "dark": "/favicon.ico",
        "light": "/favicon.ico",
      }
    `)
  })

  test('object favicon preserves both', () => {
    const root = setupConfig('holocron.jsonc', {
      favicon: { light: '/fav-light.ico', dark: '/fav-dark.ico' },
    })
    const config = readConfig({ root })
    expect(config.favicon.light).toBe('/fav-light.ico')
    expect(config.favicon.dark).toBe('/fav-dark.ico')
  })

  test('relative favicon path becomes root-absolute', () => {
    const root = setupConfig('docs.json', { favicon: './logo/favicon.png' })
    const config = readConfig({ root })
    expect(config.favicon.light).toBe('/logo/favicon.png')
    expect(config.favicon.dark).toBe('/logo/favicon.png')
  })
})

/* ── Colors normalization ────────────────────────────────────────────── */

describe('colors normalization', () => {
  test('uses provided primary color', () => {
    const root = setupConfig('holocron.jsonc', { colors: { primary: '#ff0000' } })
    const config = readConfig({ root })
    expect(config.colors.primary).toBe('#ff0000')
  })

  test('defaults primary to black when missing', () => {
    const root = setupConfig('holocron.jsonc', {})
    const config = readConfig({ root })
    expect(config.colors.primary).toBe('#000000')
  })
})

/* ── Navigation normalization ────────────────────────────────────────── */

describe('navigation normalization', () => {
  test('array of groups wraps in single implicit tab', () => {
    const root = setupConfig('holocron.jsonc', {
      navigation: [
        { group: 'Docs', pages: ['intro', 'setup'] },
      ],
    })
    const config = readConfig({ root })
    expect(config.navigation.tabs.length).toBe(1)
    expect(config.navigation.tabs[0]!.tab).toBe('')
    expect(config.navigation.tabs[0]!.groups[0]!.pages).toMatchInlineSnapshot(`
      [
        "intro",
        "setup",
      ]
    `)
  })

  test('array of tabs preserved as-is', () => {
    const root = setupConfig('holocron.jsonc', {
      navigation: [
        { tab: 'Docs', groups: [{ group: 'Start', pages: ['intro'] }] },
        { tab: 'API', groups: [{ group: 'Ref', pages: ['api'] }] },
      ],
    })
    const config = readConfig({ root })
    expect(config.navigation.tabs.length).toBe(2)
    expect(config.navigation.tabs[0]!.tab).toBe('Docs')
    expect(config.navigation.tabs[1]!.tab).toBe('API')
  })

  test('object with tabs key normalizes tabs', () => {
    const root = setupConfig('holocron.jsonc', {
      navigation: {
        tabs: [
          { tab: 'Docs', groups: [{ group: 'Start', pages: ['intro'] }] },
        ],
      },
    })
    const config = readConfig({ root })
    expect(config.navigation.tabs.length).toBe(1)
  })

  test('link-only tab becomes anchor', () => {
    const root = setupConfig('holocron.jsonc', {
      navigation: [
        { tab: 'Docs', groups: [{ group: 'Start', pages: ['intro'] }] },
        { tab: 'GitHub', href: 'https://github.com/example' },
      ],
    })
    const config = readConfig({ root })
    expect(config.navigation.tabs.length).toBe(1)
    expect(config.navigation.anchors.length).toBe(1)
    expect(config.navigation.anchors[0]!.anchor).toBe('GitHub')
    expect(config.navigation.anchors[0]!.href).toBe('https://github.com/example')
  })

  test('tab with pages but no groups wraps in unnamed group', () => {
    const root = setupConfig('holocron.jsonc', {
      navigation: [
        { tab: 'Docs', pages: ['intro', 'setup'] },
      ],
    })
    const config = readConfig({ root })
    expect(config.navigation.tabs[0]!.groups.length).toBe(1)
    expect(config.navigation.tabs[0]!.groups[0]!.group).toBe('')
    expect(config.navigation.tabs[0]!.groups[0]!.pages).toMatchInlineSnapshot(`
      [
        "intro",
        "setup",
      ]
    `)
  })

  test('object with root groups (no tabs wrapper)', () => {
    const root = setupConfig('holocron.jsonc', {
      navigation: {
        groups: [{ group: 'Start', pages: ['intro'] }],
      },
    })
    const config = readConfig({ root })
    expect(config.navigation.tabs.length).toBe(1)
    expect(config.navigation.tabs[0]!.tab).toBe('')
  })

  test('global.anchors extracted', () => {
    const root = setupConfig('holocron.jsonc', {
      navigation: {
        tabs: [{ tab: 'Docs', groups: [{ group: 'Start', pages: ['intro'] }] }],
        global: {
          anchors: [{ anchor: 'Blog', href: '/blog' }],
        },
      },
    })
    const config = readConfig({ root })
    expect(config.navigation.anchors.length).toBe(1)
    expect(config.navigation.anchors[0]!.anchor).toBe('Blog')
  })

  test('missing navigation defaults to empty', () => {
    const root = setupConfig('holocron.jsonc', {})
    const config = readConfig({ root })
    expect(config.navigation.tabs).toMatchInlineSnapshot(`[]`)
    expect(config.navigation.anchors).toMatchInlineSnapshot(`[]`)
  })

  test('strips markdown extensions from page entries and group roots', () => {
    const root = setupConfig('docs.json', {
      navigation: [
        {
          group: 'Docs',
          root: '/guide/index.md',
          pages: [
            '/index.md',
            'guide/getting-started.mdx',
            {
              group: 'Guide',
              root: 'guide/index.mdx',
              pages: ['guide/index.md'],
            },
          ],
        },
      ],
    })
    const config = readConfig({ root })
    expect(config.navigation.tabs[0]!.groups[0]).toMatchInlineSnapshot(`
      {
        "group": "Docs",
        "pages": [
          "index",
          "guide/getting-started",
          {
            "group": "Guide",
            "pages": [
              "guide/index",
            ],
            "root": "guide/index",
          },
        ],
        "root": "guide/index",
      }
    `)
  })
})

/* ── Navbar normalization ────────────────────────────────────────────── */

describe('navbar normalization', () => {
  test('type-based label derivation', () => {
    const root = setupConfig('holocron.jsonc', {
      navbar: {
        links: [{ type: 'github', href: 'https://github.com/example' }],
      },
    })
    const config = readConfig({ root })
    expect(config.navbar.links[0]!.label).toBe('GitHub')
  })

  test('explicit label overrides type', () => {
    const root = setupConfig('holocron.jsonc', {
      navbar: {
        links: [{ type: 'github', label: 'Source', href: 'https://github.com/example' }],
      },
    })
    const config = readConfig({ root })
    expect(config.navbar.links[0]!.label).toBe('Source')
  })

  test('primary button normalized', () => {
    const root = setupConfig('holocron.jsonc', {
      navbar: {
        links: [],
        primary: { label: 'Sign Up', href: '/signup' },
      },
    })
    const config = readConfig({ root })
    expect(config.navbar.primary).toMatchInlineSnapshot(`
      {
        "href": "/signup",
        "label": "Sign Up",
      }
    `)
  })

  test('missing navbar defaults to empty links', () => {
    const root = setupConfig('holocron.jsonc', {})
    const config = readConfig({ root })
    expect(config.navbar.links).toMatchInlineSnapshot(`[]`)
    expect(config.navbar.primary).toBeUndefined()
  })
})

/* ── Redirects + Footer ──────────────────────────────────────────────── */

describe('redirects normalization', () => {
  test('preserves redirect entries', () => {
    const root = setupConfig('holocron.jsonc', {
      redirects: [{ source: '/old', destination: '/new', permanent: true }],
    })
    const config = readConfig({ root })
    expect(config.redirects).toMatchInlineSnapshot(`
      [
        {
          "destination": "/new",
          "permanent": true,
          "source": "/old",
        },
      ]
    `)
  })

  test('missing redirects defaults to empty array', () => {
    const root = setupConfig('holocron.jsonc', {})
    const config = readConfig({ root })
    expect(config.redirects).toMatchInlineSnapshot(`[]`)
  })
})

describe('footer normalization', () => {
  test('preserves socials', () => {
    const root = setupConfig('holocron.jsonc', {
      footer: { socials: { twitter: 'https://twitter.com/test' } },
    })
    const config = readConfig({ root })
    expect(config.footer.socials.twitter).toBe('https://twitter.com/test')
  })

  test('missing footer defaults to empty socials', () => {
    const root = setupConfig('holocron.jsonc', {})
    const config = readConfig({ root })
    expect(config.footer.socials).toMatchInlineSnapshot(`{}`)
  })
})

/* ── Description + extended navbar/tab fields ─────────────────────────── */

describe('description normalization', () => {
  test('preserves description when present', () => {
    const root = setupConfig('holocron.jsonc', {
      name: 'X',
      description: 'Docs site for X',
    })
    const config = readConfig({ root })
    expect(config.description).toBe('Docs site for X')
  })

  test('description is undefined when missing', () => {
    const root = setupConfig('holocron.jsonc', { name: 'X' })
    const config = readConfig({ root })
    expect(config.description).toBeUndefined()
  })
})

describe('icons normalization', () => {
  test('defaults icons.library to fontawesome', () => {
    const root = setupConfig('holocron.jsonc', { name: 'X' })
    const config = readConfig({ root })
    expect(config.icons.library).toBe('fontawesome')
  })

  test('preserves configured icons.library', () => {
    const root = setupConfig('holocron.jsonc', {
      name: 'X',
      icons: { library: 'lucide' },
    })
    const config = readConfig({ root })
    expect(config.icons.library).toBe('lucide')
  })
})

describe('navbar link icon + type preservation', () => {
  test('keeps icon (string path) on links', () => {
    const root = setupConfig('holocron.jsonc', {
      navbar: {
        links: [{ type: 'github', href: 'https://gh.example', icon: '/gh.svg' }],
      },
    })
    const config = readConfig({ root })
    expect(config.navbar.links[0]).toMatchInlineSnapshot(`
      {
        "href": "https://gh.example",
        "icon": "/gh.svg",
        "label": "GitHub",
        "type": "github",
      }
    `)
  })

  test('keeps icon (structured object) on links', () => {
    const root = setupConfig('holocron.jsonc', {
      navbar: {
        links: [
          {
            label: 'Home',
            href: '/',
            icon: { name: 'home', library: 'lucide' },
          },
        ],
      },
    })
    const config = readConfig({ root })
    expect(config.navbar.links[0]!.icon).toMatchInlineSnapshot(`
      {
        "library": "lucide",
        "name": "home",
      }
    `)
  })

  test('omits type/icon keys when unset (keeps snapshots clean)', () => {
    const root = setupConfig('holocron.jsonc', {
      navbar: { links: [{ label: 'Plain', href: '/x' }] },
    })
    const config = readConfig({ root })
    expect(config.navbar.links[0]).toMatchInlineSnapshot(`
      {
        "href": "/x",
        "label": "Plain",
      }
    `)
  })

  test('preserves primary.type', () => {
    const root = setupConfig('holocron.jsonc', {
      navbar: {
        primary: { type: 'github', href: 'https://gh.example' },
      },
    })
    const config = readConfig({ root })
    expect(config.navbar.primary).toMatchInlineSnapshot(`
      {
        "href": "https://gh.example",
        "icon": "github",
        "label": "GitHub",
        "type": "github",
      }
    `)
  })
})

describe('tab icon / hidden / align preservation', () => {
  test('preserves tab.icon, tab.hidden, tab.align on content tabs', () => {
    const root = setupConfig('holocron.jsonc', {
      navigation: [
        {
          tab: 'Docs',
          icon: 'book',
          align: 'start',
          groups: [{ group: 'Start', pages: ['intro'] }],
        },
        {
          tab: 'Hidden',
          hidden: true,
          groups: [{ group: 'Hide', pages: ['secret'] }],
        },
      ],
    })
    const config = readConfig({ root })
    expect(config.navigation.tabs[0]).toMatchInlineSnapshot(`
      {
        "align": "start",
        "groups": [
          {
            "group": "Start",
            "pages": [
              "intro",
            ],
          },
        ],
        "icon": "book",
        "tab": "Docs",
      }
    `)
    expect(config.navigation.tabs[1]!.hidden).toBe(true)
  })

  test('preserves icon + hidden on anchors (from link-only tabs)', () => {
    const root = setupConfig('holocron.jsonc', {
      navigation: [
        {
          tab: 'GitHub',
          href: 'https://github.com/example',
          icon: '/gh.svg',
          hidden: true,
        },
        { tab: 'Docs', groups: [{ group: 'Start', pages: ['intro'] }] },
      ],
    })
    const config = readConfig({ root })
    expect(config.navigation.anchors[0]).toMatchInlineSnapshot(`
      {
        "anchor": "GitHub",
        "hidden": true,
        "href": "https://github.com/example",
        "icon": "/gh.svg",
      }
    `)
  })
})
