import { afterEach, describe, expect, test, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createServer, type Server } from 'node:http'
import { syncNavigation } from './sync.ts'
import { PACKAGE_VERSION } from './package-version.ts'
import { readConfig } from '../config.ts'
import { collectAllPages, findPage, buildPageIndex } from '../navigation.ts'
import { logger } from './logger.ts'

/* ── Helpers ─────────────────────────────────────────────────────────── */

type TmpProject = {
  root: string
  pagesDir: string
  publicDir: string
  distDir: string
}

function createProject(config: object, pages: Record<string, string>): TmpProject {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-sync-test-'))
  const pagesDir = path.join(root, 'pages')
  const publicDir = path.join(root, 'public')
  const distDir = path.join(root, 'dist')

  fs.mkdirSync(pagesDir, { recursive: true })
  fs.mkdirSync(publicDir, { recursive: true })
  fs.mkdirSync(distDir, { recursive: true })

  // Write config
  fs.writeFileSync(path.join(root, 'holocron.jsonc'), JSON.stringify(config, null, 2))

  // Write pages (support nested paths like "guide/setup")
  for (const [slug, content] of Object.entries(pages)) {
    const filePath = path.join(pagesDir, slug + '.mdx')
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
  }

  return { root, pagesDir, publicDir, distDir }
}

const projects: TmpProject[] = []
const servers: Server[] = []

function tracked(project: TmpProject): TmpProject {
  projects.push(project)
  return project
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const server of servers) {
    server.close()
  }
  servers.length = 0
  for (const p of projects) {
    if (fs.existsSync(p.root)) {
      fs.rmSync(p.root, { recursive: true, force: true })
    }
  }
  projects.length = 0
})

/* ── Basic sync ──────────────────────────────────────────────────────── */

describe('syncNavigation', () => {
  test('enriches pages with title and headings from MDX', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          { group: 'Guide', pages: ['introduction'] },
        ],
      },
      {
        introduction: `---
title: Introduction
description: Welcome to the docs
---

## Getting Started

Some text.

### Prerequisites

More text.

## Advanced Usage`,
      },
    ))
    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    expect(result.parsedCount).toBe(1)
    expect(result.cachedCount).toBe(0)

    const pages = collectAllPages(result.navigation)
    expect(pages.length).toBe(1)

    const page = pages[0]!
    expect(page.title).toBe('Introduction')
    expect(page.description).toBe('Welcome to the docs')
    expect(page.slug).toBe('introduction')
    expect(page.href).toBe('/introduction')
    expect(page.headings).toMatchInlineSnapshot(`
      [
        {
          "depth": 2,
          "slug": "getting-started",
          "text": "Getting Started",
        },
        {
          "depth": 3,
          "slug": "prerequisites",
          "text": "Prerequisites",
        },
        {
          "depth": 2,
          "slug": "advanced-usage",
          "text": "Advanced Usage",
        },
      ]
    `)
  })

  test('multiple pages across groups', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          {
            group: 'Start',
            pages: ['intro', 'setup'],
          },
        ],
      },
      {
        intro: `---
title: Intro
---

## Welcome`,
        setup: `---
title: Setup
---

## Installation

### npm

### yarn`,
      },
    ))
    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    expect(result.parsedCount).toBe(2)
    const pages = collectAllPages(result.navigation)
    expect(pages.map((p) => p.slug)).toMatchInlineSnapshot(`
      [
        "intro",
        "setup",
      ]
    `)

    const setup = findPage(result.navigation, 'setup')!
    expect(setup.headings.length).toBe(3)
    expect(setup.headings.map((h) => h.text)).toMatchInlineSnapshot(`
      [
        "Installation",
        "npm",
        "yarn",
      ]
    `)
  })

  test('collects pageImportPaths from MDX import declarations', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          { group: 'Guide', pages: ['index', 'guide/nested'] },
        ],
      },
      {
        index: `---
title: Home
---

import { Greeting } from '/snippets/greeting'
import { Badge } from '../components/badge'

# Home

<Greeting />
<Badge />
`,
        'guide/nested': `---
title: Nested
---

import Alert from '../snippets/alert'

# Nested

<Alert />
`,
      },
    ))

    // Create the component files that the imports reference
    const snippetsDir = path.join(project.pagesDir, 'snippets')
    const componentsDir = path.join(project.root, 'components')
    fs.mkdirSync(snippetsDir, { recursive: true })
    fs.mkdirSync(componentsDir, { recursive: true })
    fs.writeFileSync(path.join(snippetsDir, 'greeting.tsx'), 'export const Greeting = () => <div>hi</div>')
    fs.writeFileSync(path.join(snippetsDir, 'alert.tsx'), 'export default () => <div>alert</div>')
    fs.writeFileSync(path.join(componentsDir, 'badge.tsx'), 'export const Badge = () => <span>badge</span>')

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    // index.mdx imports /snippets/greeting (absolute → moduleKey ./snippets/greeting.tsx)
    // and ../components/badge (relative → moduleKey ./components/badge.tsx)
    const indexImports = result.pageImports['index']?.map((i) => i.moduleKey).sort()
    expect(indexImports).toMatchInlineSnapshot(`
      [
        "./components/badge.tsx",
        "./snippets/greeting.tsx",
      ]
    `)

    // guide/nested.mdx imports ../snippets/alert (relative from pages/guide/ → pages/snippets/)
    const nestedImports = result.pageImports['guide/nested']?.map((i) => i.moduleKey)
    expect(nestedImports).toMatchInlineSnapshot(`
      [
        "./pages/snippets/alert.tsx",
      ]
    `)
  })

  test('caches importSources and re-resolves fresh on each sync', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          { group: 'Guide', pages: ['index'] },
        ],
      },
      {
        index: `---
title: Home
---

import { Greeting } from '/snippets/greeting'

# Home
`,
      },
    ))

    const snippetsDir = path.join(project.pagesDir, 'snippets')
    fs.mkdirSync(snippetsDir, { recursive: true })
    fs.writeFileSync(path.join(snippetsDir, 'greeting.tsx'), 'export const Greeting = () => <div>hi</div>')

    const config = readConfig({ root: project.root })
    const first = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })
    expect(first.parsedCount).toBe(1)
    expect(first.pageImports['index']?.map((i) => i.moduleKey)).toEqual(['./snippets/greeting.tsx'])

    // Second sync — cached MDX, but imports still re-resolved
    const second = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })
    expect(second.parsedCount).toBe(0)
    expect(second.cachedCount).toBe(1)
    expect(second.pageImports['index']?.map((i) => i.moduleKey)).toEqual(['./snippets/greeting.tsx'])
  })

  test('picks up newly-created import targets without MDX change', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          { group: 'Guide', pages: ['index'] },
        ],
      },
      {
        index: `---
title: Home
---

import { Widget } from '/components/widget'

# Home
`,
      },
    ))

    const config = readConfig({ root: project.root })

    // First sync — widget.tsx does not exist yet
    const first = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })
    expect(first.parsedCount).toBe(1)
    expect(first.pageImports['index']).toEqual([])

    // Create the file — MDX stays the same. The first run had a safe-mdx
    // unresolved-import error, so that MDX was intentionally not cached.
    const componentsDir = path.join(project.pagesDir, 'components')
    fs.mkdirSync(componentsDir, { recursive: true })
    fs.writeFileSync(path.join(componentsDir, 'widget.tsx'), 'export const Widget = () => <div>w</div>')

    // Second sync — reprocesses MDX and picks up the newly-created import.
    const second = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })
    expect(second.parsedCount).toBe(1)
    expect(second.cachedCount).toBe(0)
    expect(second.pageImports['index']?.map((i) => i.moduleKey)).toEqual(['./components/widget.tsx'])
  })

  test('does not cache MDX pages with safe-mdx render errors', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          { group: 'Guide', pages: ['index'] },
        ],
      },
      {
        index: `---
title: Home
---

# Home

<Caption>Missing component</Caption>
`,
      },
    ))
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const config = readConfig({ root: project.root })

    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    expect(result.mdxContent.index).toContain('<Caption>Missing component</Caption>')
    const mdxCache = JSON.parse(fs.readFileSync(path.join(project.distDir, 'holocron-mdx.json'), 'utf-8'))
    expect(mdxCache.content).toEqual({})
    expect(mdxCache.pageIconRefs).toMatchObject({ index: [] })
    expect(mdxCache.pageImportSources).toMatchObject({ index: [] })
    expect(warn.mock.calls.map(([message]) => String(message).replace(/\x1b\[[0-9;]*m/g, ''))).toMatchInlineSnapshot(`
      [
        "▲ holocron MDX /:7 Unsupported jsx component Caption",
        "",
        "▲ holocron 1 page with MDX errors. Fix the syntax issues in the pages listed above.",
      ]
    `)
  })

  test('logs missing component once for pages reused by switchers', async () => {
    const project = tracked(createProject(
      {
        navigation: {
          versions: [
            { version: 'v1', default: true, pages: ['index'] },
          ],
        },
      },
      {
        index: `---
title: Home
---

# Home

<Tipx>Missing component</Tipx>
`,
      },
    ))
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const config = readConfig({ root: project.root })

    await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const missingComponentWarnings = warn.mock.calls
      .map(([message]) => String(message).replace(/\x1b\[[0-9;]*m/g, ''))
      .filter((message) => message.includes('Unsupported jsx component Tipx'))

    expect(missingComponentWarnings).toMatchInlineSnapshot(`
      [
        "▲ holocron MDX /:7 Unsupported jsx component Tipx",
      ]
    `)
  })

  test('preserves typed page frontmatter metadata on NavPage', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['api'] }],
      },
      {
        api: `---
title: API Overview
description: Typed metadata should survive sync.
sidebarTitle: API
tag: BETA
deprecated: true
hidden: true
noindex: true
keywords: ["configuration", "setup"]
robots: noarchive
"og:title": Social API Overview
"twitter:card": summary
---

## Endpoint`,
      },
    ))
    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const page = findPage(result.navigation, 'api')!
    expect(page.frontmatter).toMatchInlineSnapshot(`
      {
        "deprecated": true,
        "description": "Typed metadata should survive sync.",
        "hidden": true,
        "keywords": [
          "configuration",
          "setup",
        ],
        "noindex": true,
        "og:title": "Social API Overview",
        "robots": "noarchive",
        "sidebarTitle": "API",
        "tag": "BETA",
        "title": "API Overview",
        "twitter:card": "summary",
      }
    `)
  })

  test('MDX content is stored separately from navigation tree', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['page'] }],
      },
      {
        page: `---
title: My Page
---

## Section

Content here.`,
      },
    ))
    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    // mdxContent has the slug as key
    expect(result.mdxContent['page']).toBeDefined()
    expect(result.mdxContent['page']).toContain('## Section')

    // Navigation page object has NO mdx field
    const page = findPage(result.navigation, 'page')!
    expect(Object.hasOwn(page, 'mdx')).toBe(false)
  })

  test('cache reuse on second sync with unchanged files', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['page'] }],
      },
      {
        page: `---
title: Cached Page
---

## Heading`,
      },
    ))
    const config = readConfig({ root: project.root })

    // First sync
    const first = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })
    expect(first.parsedCount).toBe(1)
    expect(first.cachedCount).toBe(0)

    // Second sync (same files, cache should hit)
    const second = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })
    expect(second.parsedCount).toBe(0)
    expect(second.cachedCount).toBe(1)

    // Results should be identical
    const page1 = findPage(first.navigation, 'page')!
    const page2 = findPage(second.navigation, 'page')!
    expect(page2.title).toBe(page1.title)
    expect(page2.gitSha).toBe(page1.gitSha)
    expect(page2.headings).toEqual(page1.headings)
  })

  test('generates placeholders for remote root-level JSX img urls', async () => {
    const sharp = (await import('sharp')).default
    const png = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 255, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer()
    const server = createServer((request, response) => {
      if (request.url !== '/demo.png') {
        response.writeHead(404)
        response.end('not found')
        return
      }
      response.writeHead(200, { 'content-type': 'image/png' })
      response.end(png)
    })
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve)
    })
    servers.push(server)
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Expected test server to listen on a TCP port')
    }
    const imageUrl = `http://127.0.0.1:${address.port}/demo.png`

    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['page'] }],
      },
      {
        page: `---
title: Remote image
---

<img src="${imageUrl}" />`,
      },
    ))
    const config = readConfig({ root: project.root })

    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    expect(result.mdxContent.page).toContain(`<Image src="${imageUrl}" alt="" width="1" height="1" placeholder="data:image/webp;base64,`)
  })

  test('cache invalidation when MDX file changes', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['page'] }],
      },
      {
        page: `---
title: Original Title
---

## Original Heading`,
      },
    ))
    const config = readConfig({ root: project.root })

    // First sync
    const first = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })
    expect(first.parsedCount).toBe(1)

    // Modify the MDX file
    const mdxPath = path.join(project.pagesDir, 'page.mdx')
    fs.writeFileSync(mdxPath, `---
title: Updated Title
---

## New Heading

## Another Heading`)

    // Second sync — should detect change and re-parse
    const second = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })
    expect(second.parsedCount).toBe(1)
    expect(second.cachedCount).toBe(0)

    const page = findPage(second.navigation, 'page')!
    expect(page.title).toBe('Updated Title')
    expect(page.headings.length).toBe(2)
    expect(page.headings.map((h) => h.text)).toMatchInlineSnapshot(`
      [
        "New Heading",
        "Another Heading",
      ]
    `)
  })

  test('cache invalidation when image cache version is stale', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['page'] }],
      },
      {
        page: `---
title: Image Page
---

<img src="./dot.svg" />`,
      },
    ))
    const config = readConfig({ root: project.root })
    fs.writeFileSync(
      path.join(project.pagesDir, 'dot.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4" viewBox="0 0 8 4"><rect width="8" height="4" fill="#38bdf8" /></svg>`,
    )

    fs.writeFileSync(
      path.join(project.distDir, 'holocron-images.json'),
      JSON.stringify({
        version: '0.0.0-stale',
        images: {
          stale: {
            width: 1,
            height: 1,
            placeholder: 'data:image/webp;base64,stale',
          },
        },
      }),
    )

    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    expect(result.mdxContent.page).toContain('<Image')
    expect(result.mdxContent.page).not.toContain('data:image/webp;base64,stale')

    const imageCache = JSON.parse(fs.readFileSync(path.join(project.distDir, 'holocron-images.json'), 'utf-8'))
    expect(imageCache.version).toBe(PACKAGE_VERSION)
    expect(Object.keys(imageCache.images)).toHaveLength(1)
  })

  test('throws when MDX file is missing', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['nonexistent'] }],
      },
      {},
    ))
    const config = readConfig({ root: project.root })

    await expect(syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })).rejects.toThrow('MDX file not found for page "nonexistent"')
  })

  test('allows redirect-backed navigation pages without an mdx file', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['merchant-of-record/acceptable-use'] }],
        redirects: [
          {
            source: '/merchant-of-record/acceptable-use',
            destination: 'https://polar.sh/legal/acceptable-use-policy',
          },
        ],
      },
      {},
    ))
    const config = readConfig({ root: project.root })

    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const page = findPage(result.navigation, 'merchant-of-record/acceptable-use')!
    expect(page).toMatchInlineSnapshot(`
      {
        "frontmatter": {
          "title": "Acceptable Use",
        },
        "gitSha": "redirect:merchant-of-record/acceptable-use",
        "headings": [],
        "href": "/merchant-of-record/acceptable-use",
        "slug": "merchant-of-record/acceptable-use",
        "title": "Acceptable Use",
      }
    `)
    expect(result.mdxContent['merchant-of-record/acceptable-use']).toBeUndefined()
  })

  test('slug to href mapping', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          {
            group: 'Docs',
            pages: ['index', 'guide/setup', 'guide/index'],
          },
        ],
      },
      {
        index: '# Home',
        'guide/setup': '# Setup Guide',
        'guide/index': '# Guide Index',
      },
    ))
    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const pages = collectAllPages(result.navigation)
    const hrefs = pages.map((p) => ({ slug: p.slug, href: p.href }))
    expect(hrefs).toMatchInlineSnapshot(`
      [
        {
          "href": "/",
          "slug": "index",
        },
        {
          "href": "/guide/setup",
          "slug": "guide/setup",
        },
        {
          "href": "/guide",
          "slug": "guide/index",
        },
      ]
    `)
  })

  test('navigation structure with tabs preserved', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          {
            tab: 'Docs',
            groups: [{ group: 'Start', pages: ['intro'] }],
          },
          {
            tab: 'API',
            groups: [{ group: 'Reference', pages: ['api-ref'] }],
          },
        ],
      },
      {
        intro: `---
title: Introduction
---

## Overview`,
        'api-ref': `---
title: API Reference
---

## Endpoints

### GET /users

### POST /users`,
      },
    ))
    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    expect(result.navigation.length).toBe(2)
    expect(result.navigation[0]!.tab).toBe('Docs')
    expect(result.navigation[1]!.tab).toBe('API')
    expect(result.parsedCount).toBe(2)

    const apiPage = findPage(result.navigation, 'api-ref')!
    expect(apiPage.headings.length).toBe(3)
  })

  test('preserves group fields (icon, hidden, root, tag, expanded) through sync', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          {
            group: 'Guide',
            icon: { name: 'book', library: 'lucide' },
            hidden: false,
            root: 'guide/index',
            tag: 'New',
            expanded: true,
            pages: ['guide/index', 'guide/setup'],
          },
        ],
      },
      {
        'guide/index': `---\ntitle: Guide\n---\n\n## Intro`,
        'guide/setup': `---\ntitle: Setup\n---\n\n## Steps`,
      },
    ))
    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const group = result.navigation[0]!.groups[0]!
    expect(group.icon).toMatchInlineSnapshot(`
      {
        "library": "lucide",
        "name": "book",
      }
    `)
    expect(group.hidden).toBe(false)
    expect(group.root).toBe('/guide') // 'guide/index' collapses to '/guide'
    expect(group.tag).toBe('New')
    expect(group.expanded).toBe(true)
  })

  test('preserves tab fields (icon, hidden, align) through sync', async () => {
    const project = tracked(createProject(
      {
        navigation: {
          tabs: [
            {
              tab: 'Docs',
              icon: 'book',
              align: 'start',
              groups: [{ group: 'G', pages: ['p'] }],
            },
            {
              tab: 'Hidden',
              hidden: true,
              align: 'end',
              groups: [{ group: 'H', pages: ['p2'] }],
            },
          ],
        },
      },
      {
        p: `---\ntitle: P\n---\n\n## x`,
        p2: `---\ntitle: P2\n---\n\n## y`,
      },
    ))
    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    expect(result.navigation[0]!.icon).toBe('book')
    expect(result.navigation[0]!.align).toBe('start')
    expect(result.navigation[1]!.hidden).toBe(true)
    expect(result.navigation[1]!.align).toBe('end')
  })

  test('inlines imported .md content into page MDX with image processing', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['index'] }],
      },
      {
        index: `---
title: Home
---

import Snippet from '/snippets/guide.md'

# Home

<Snippet />
`,
      },
    ))

    // Create the imported .md file with an image reference
    const snippetsDir = path.join(project.pagesDir, 'snippets')
    fs.mkdirSync(snippetsDir, { recursive: true })
    fs.writeFileSync(
      path.join(snippetsDir, 'guide.md'),
      `# Guide\n\n![diagram](./diagram.svg)\n\nSome guide content.`,
    )
    fs.writeFileSync(
      path.join(snippetsDir, 'diagram.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="12" viewBox="0 0 24 12"><rect width="24" height="12" fill="#000" /></svg>`,
    )

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    // With inline imports, the imported content is part of the page's MDX.
    // Image should have been processed: converted to <Image> with dimensions.
    const pageMdx = result.mdxContent['index']
    expect(pageMdx).toBeDefined()
    expect(pageMdx).toContain('Some guide content.')
    expect(pageMdx).toContain('<Image')
    expect(pageMdx).toContain('width="24"')
    expect(pageMdx).toContain('height="12"')
  })

  test('inlines imported .md headings into page TOC', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['index'] }],
      },
      {
        index: `---
title: Home
---

import Snippet from '/snippets/guide.md'

# Home

<Snippet />
`,
      },
    ))

    const snippetsDir = path.join(project.pagesDir, 'snippets')
    fs.mkdirSync(snippetsDir, { recursive: true })
    fs.writeFileSync(
      path.join(snippetsDir, 'guide.md'),
      `## Setup\n\nSetup instructions.\n\n## Usage\n\nUsage instructions.`,
    )

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    // Headings from the imported .md file should appear in the page's headings
    // because remarkInlineImports splices them into the page's mdast before
    // heading extraction runs.
    const page = result.navigation[0]?.groups[0]?.pages[0]
    expect(page).toBeDefined()
    if (page && 'headings' in page) {
      const headingTexts = page.headings.map((h) => h.text)
      expect(headingTexts).toContain('Setup')
      expect(headingTexts).toContain('Usage')
    }
  })

  test('discovers nested imports from inlined .mdx content', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['index'] }],
      },
      {
        index: `---
title: Home
---

import Guide from '/snippets/guide.mdx'

# Home

<Guide />
`,
      },
    ))

    const snippetsDir = path.join(project.pagesDir, 'snippets')
    fs.mkdirSync(snippetsDir, { recursive: true })
    // guide.mdx imports badge.tsx — when inlined, the import declaration
    // becomes part of the page's AST and should be discovered by processMdx
    fs.writeFileSync(
      path.join(snippetsDir, 'guide.mdx'),
      `import { Badge } from './badge'\n\n# Guide\n\n<Badge />`,
    )
    fs.writeFileSync(
      path.join(snippetsDir, 'badge.tsx'),
      `export const Badge = () => <span>badge</span>`,
    )

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    // The guide.mdx import is discovered from the page
    const allModuleKeys = Object.values(result.pageImports)
      .flat()
      .map((i) => i.moduleKey)
    expect(allModuleKeys).toContain('./snippets/guide.mdx')
    // The nested badge.tsx import is discovered because remarkInlineImports
    // rewrites its source (./badge → ./snippets/badge) when inlining guide.mdx.
    // The rewritten import becomes part of the page's AST and processMdx
    // extracts it. The moduleKey includes the pagesDir prefix since badge.tsx
    // lives inside pagesDir.
    expect(allModuleKeys).toContain('./pages/snippets/badge.tsx')
  })

  test('absolute import /x falls back to projectRoot when not in pagesDir', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['index'] }],
      },
      {
        index: `---
title: Home
---

import { Badge } from '/components/badge'

# Home

<Badge />
`,
      },
    ))

    // Place badge.tsx at projectRoot/components/, NOT pagesDir/components/
    const componentsDir = path.join(project.root, 'components')
    fs.mkdirSync(componentsDir, { recursive: true })
    fs.writeFileSync(path.join(componentsDir, 'badge.tsx'), 'export const Badge = () => <span>b</span>')

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const imports = result.pageImports['index']?.map((i) => i.moduleKey)
    expect(imports).toMatchInlineSnapshot(`
      [
        "./components/badge.tsx",
      ]
    `)
  })

  test('absolute import /x prefers pagesDir over projectRoot', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['index'] }],
      },
      {
        index: `---
title: Home
---

import { Widget } from '/shared/widget'

# Home

<Widget />
`,
      },
    ))

    // Put widget in BOTH pagesDir and projectRoot — pagesDir should win
    const pageShared = path.join(project.pagesDir, 'shared')
    const rootShared = path.join(project.root, 'shared')
    fs.mkdirSync(pageShared, { recursive: true })
    fs.mkdirSync(rootShared, { recursive: true })
    fs.writeFileSync(path.join(pageShared, 'widget.tsx'), 'export const Widget = () => <div>pages</div>')
    fs.writeFileSync(path.join(rootShared, 'widget.tsx'), 'export const Widget = () => <div>root</div>')

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const imports = result.pageImports['index']
    expect(imports).toHaveLength(1)
    // absPath should point to pagesDir version, not projectRoot version
    expect(imports![0]!.absPath).toBe(path.join(pageShared, 'widget.tsx'))
  })

  test('resolves index file for directory imports (/components → /components/index.tsx)', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['index'] }],
      },
      {
        index: `---
title: Home
---

import { Utils } from '/lib'

# Home

<Utils />
`,
      },
    ))

    // Create lib/index.tsx in pagesDir
    const libDir = path.join(project.pagesDir, 'lib')
    fs.mkdirSync(libDir, { recursive: true })
    fs.writeFileSync(path.join(libDir, 'index.tsx'), 'export const Utils = () => <div>u</div>')

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const imports = result.pageImports['index']?.map((i) => i.moduleKey)
    // moduleKey is ./lib.tsx (not ./lib/index.tsx) because safe-mdx normalizes
    // /lib → ./lib then probes ./lib.tsx — the index resolution is transparent
    expect(imports).toMatchInlineSnapshot(`
      [
        "./lib.tsx",
      ]
    `)
    // But absPath should point to the actual index file on disk
    expect(result.pageImports['index']![0]!.absPath).toBe(path.join(project.pagesDir, 'lib', 'index.tsx'))
  })

  test('resolves index file in projectRoot fallback (/utils → root/utils/index.ts)', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['index'] }],
      },
      {
        index: `---
title: Home
---

import { helper } from '/utils'

# Home
`,
      },
    ))

    // Create utils/index.ts at projectRoot (not in pagesDir)
    const utilsDir = path.join(project.root, 'utils')
    fs.mkdirSync(utilsDir, { recursive: true })
    fs.writeFileSync(path.join(utilsDir, 'index.ts'), 'export const helper = () => "hi"')

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const imports = result.pageImports['index']?.map((i) => i.moduleKey)
    // Same as above: ./utils.ts moduleKey, but absPath is utils/index.ts
    expect(imports).toMatchInlineSnapshot(`
      [
        "./utils.ts",
      ]
    `)
  })

  test('deeply nested relative import resolves to file outside pagesDir', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['guides/deep/page'] }],
      },
      {
        'guides/deep/page': `---
title: Deep Page
---

import { helper } from '../../../lib/helper'

# Deep Page
`,
      },
    ))

    // ../../../lib/helper from pages/guides/deep/ → root/lib/helper
    const libDir = path.join(project.root, 'lib')
    fs.mkdirSync(libDir, { recursive: true })
    fs.writeFileSync(path.join(libDir, 'helper.ts'), 'export const helper = () => "hi"')

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const imports = result.pageImports['guides/deep/page']?.map((i) => i.moduleKey)
    expect(imports).toMatchInlineSnapshot(`
      [
        "./lib/helper.ts",
      ]
    `)
  })

  test('relative import from root-level page to sibling outside pagesDir', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['index'] }],
      },
      {
        index: `---
title: Home
---

import { Config } from '../config/settings'

# Home
`,
      },
    ))

    // ../config/settings from pages/index → root/config/settings
    const configDir = path.join(project.root, 'config')
    fs.mkdirSync(configDir, { recursive: true })
    fs.writeFileSync(path.join(configDir, 'settings.ts'), 'export const Config = { debug: true }')

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const imports = result.pageImports['index']?.map((i) => i.moduleKey)
    expect(imports).toMatchInlineSnapshot(`
      [
        "./config/settings.ts",
      ]
    `)
  })

  test('import with explicit extension skips probing', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['index'] }],
      },
      {
        index: `---
title: Home
---

import { Greeting } from '/snippets/greeting.tsx'

# Home

<Greeting />
`,
      },
    ))

    const snippetsDir = path.join(project.pagesDir, 'snippets')
    fs.mkdirSync(snippetsDir, { recursive: true })
    fs.writeFileSync(path.join(snippetsDir, 'greeting.tsx'), 'export const Greeting = () => <div>hi</div>')

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const imports = result.pageImports['index']?.map((i) => i.moduleKey)
    expect(imports).toMatchInlineSnapshot(`
      [
        "./snippets/greeting.tsx",
      ]
    `)
  })

  test('duplicate imports across pages produce deduplicated module keys', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['page-a', 'page-b'] }],
      },
      {
        'page-a': `---
title: Page A
---

import { Shared } from '/shared/component'

# Page A

<Shared />
`,
        'page-b': `---
title: Page B
---

import { Shared } from '/shared/component'

# Page B

<Shared />
`,
      },
    ))

    const sharedDir = path.join(project.pagesDir, 'shared')
    fs.mkdirSync(sharedDir, { recursive: true })
    fs.writeFileSync(path.join(sharedDir, 'component.tsx'), 'export const Shared = () => <div>s</div>')

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    // Both pages should resolve the same module key
    const aImports = result.pageImports['page-a']?.map((i) => i.moduleKey)
    const bImports = result.pageImports['page-b']?.map((i) => i.moduleKey)
    expect(aImports).toEqual(['./shared/component.tsx'])
    expect(bImports).toEqual(['./shared/component.tsx'])

    // absPath should be the same for both
    const aPath = result.pageImports['page-a']![0]!.absPath
    const bPath = result.pageImports['page-b']![0]!.absPath
    expect(aPath).toBe(bPath)
  })

  test('unresolvable import is silently skipped', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['index'] }],
      },
      {
        index: `---
title: Home
---

import { Ghost } from '/does-not-exist'
import { Real } from '/snippets/real'

# Home

<Real />
`,
      },
    ))

    const snippetsDir = path.join(project.pagesDir, 'snippets')
    fs.mkdirSync(snippetsDir, { recursive: true })
    fs.writeFileSync(path.join(snippetsDir, 'real.tsx'), 'export const Real = () => <div>r</div>')

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    // Only the resolvable import should appear
    const imports = result.pageImports['index']?.map((i) => i.moduleKey)
    expect(imports).toEqual(['./snippets/real.tsx'])
  })

  test('collects image dependency paths from imported .md files', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['index'] }],
      },
      {
        index: `---
title: Home
---

import Snippet from '/snippets/with-image.md'

# Home

<Snippet />
`,
      },
    ))

    const snippetsDir = path.join(project.pagesDir, 'snippets')
    fs.mkdirSync(snippetsDir, { recursive: true })
    fs.writeFileSync(path.join(snippetsDir, 'with-image.md'), '![icon](./icon.svg)')
    fs.writeFileSync(
      path.join(snippetsDir, 'icon.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4" viewBox="0 0 8 4"><rect width="8" height="4" fill="#000" /></svg>`,
    )

    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    // Image dep paths should include the SVG file
    expect(result.importedImageDepPaths).toContain(path.join(snippetsDir, 'icon.svg'))
  })

  test('collects per-page icon refs using the configured project library', async () => {
    const project = tracked(createProject(
      {
        icons: { library: 'lucide' },
        navigation: [{ group: 'Docs', pages: ['page'] }],
      },
      {
        page: `---
title: Page
icon: rocket
---

<Card icon="github" />`,
      },
    ))
    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    expect(result.pageIconRefs.page).toEqual(['lucide:rocket', 'lucide:github'])
  })

  test('preserves page icon refs when image rewriting mutates the mdast', async () => {
    const project = tracked(createProject(
      {
        icons: { library: 'lucide' },
        navigation: [{ group: 'Docs', pages: ['page'] }],
      },
      {
        page: `---
title: Page
icon: rocket
---

<Card icon="github" />

<img src="./dot.svg" />`,
      },
    ))
    const config = readConfig({ root: project.root })
    fs.writeFileSync(
      path.join(project.pagesDir, 'dot.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4" viewBox="0 0 8 4"><rect width="8" height="4" fill="#38bdf8" /></svg>`,
    )

    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    expect(result.mdxContent.page).toContain('<Image')
    expect(result.pageIconRefs.page).toEqual(['lucide:rocket', 'lucide:github'])
  })

  test('title falls back to first heading when no frontmatter', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['page'] }],
      },
      {
        page: `## My Page Title

Some content here.`,
      },
    ))
    const config = readConfig({ root: project.root })
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const page = findPage(result.navigation, 'page')!
    expect(page.title).toBe('My Page Title')
  })

  test('catches MDX parse errors and stores them in mdxParseErrors', async () => {
    const project = tracked(createProject(
      {
        navigation: [{ group: 'Docs', pages: ['good-page', 'bad-page'] }],
      },
      {
        'good-page': '# Good page\n\nThis is fine.',
        'bad-page': '# Bad page\n\nHello {world',
      },
    ))
    const config = readConfig({ root: project.root })

    // Should NOT throw — parse errors are caught and stored
    const result = await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    // Good page should still work
    expect(result.mdxContent['good-page']).toBeTruthy()
    expect(findPage(result.navigation, 'good-page')?.title).toBe('Good page')

    // Bad page should have a parse error
    expect(result.mdxParseErrors['bad-page']).toBeTruthy()
    expect(result.mdxParseErrors['bad-page']!.reason).toContain('closing brace')
    expect(result.mdxParseErrors['bad-page']!.line).toBe(3)
    expect(result.mdxParseErrors['bad-page']!.source).toBe('/bad-page')

    // Bad page should still be in the navigation tree (so sidebar shows it)
    const badPage = findPage(result.navigation, 'bad-page')
    expect(badPage).toBeTruthy()
    expect(badPage!.gitSha).toBe('error')

    // But its MDX content should not be in mdxContent
    expect(result.mdxContent['bad-page']).toBeUndefined()
  })
})

/* ── Broken internal link warnings ──────────────────────────────────── */

describe('broken internal link warnings', () => {
  test('warns about links pointing to non-existent pages', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          { group: 'Guide', pages: ['index', 'getting-started'] },
        ],
      },
      {
        index: `---
title: Home
---

Check the [quickstart](/quickstart) and [getting started](/getting-started).
`,
        'getting-started': `---
title: Getting Started
---

See [home](/) and [nonexistent](./does-not-exist).
`,
      },
    ))
    const config = readConfig({ root: project.root })
    const warnSpy = vi.spyOn(logger, 'warn')
    await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const warnings = warnSpy.mock.calls.map((c) => c[0]).filter((msg) => typeof msg === 'string' && msg.includes('broken link'))
    // /quickstart does not exist → should warn
    expect(warnings.some((w) => w.includes('/quickstart'))).toBe(true)
    // ./does-not-exist from getting-started → resolved to /does-not-exist → should warn
    expect(warnings.some((w) => w.includes('/does-not-exist'))).toBe(true)
    // Only 2 broken links total (the two non-existent ones)
    expect(warnings).toHaveLength(2)
  })

  test('does not warn for links matching redirect sources', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          { group: 'Guide', pages: ['index'] },
        ],
        redirects: [
          { source: '/old-page', destination: '/index' },
        ],
      },
      {
        index: `---
title: Home
---

Link to [old page](/old-page) and [missing](/truly-missing).
`,
      },
    ))
    const config = readConfig({ root: project.root })
    const warnSpy = vi.spyOn(logger, 'warn')
    await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const warnings = warnSpy.mock.calls.map((c) => c[0]).filter((msg) => typeof msg === 'string' && msg.includes('broken link'))
    // /old-page has a redirect → should NOT warn
    expect(warnings.some((w) => w.includes('/old-page'))).toBe(false)
    // /truly-missing has no page and no redirect → should warn
    expect(warnings.some((w) => w.includes('/truly-missing'))).toBe(true)
  })

  test('does not warn for links using the /index form of a page', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          { group: 'Guide', pages: ['index', 'guide/index', 'guide/setup'] },
        ],
      },
      {
        index: `---
title: Home
---

Links to [home index](/index), [guide index](/guide/index),
and [setup](/guide/setup/index), plus [missing](/nope/index).
`,
        'guide/index': `---
title: Guide
---

Guide home.
`,
        'guide/setup': `---
title: Setup
---

Setup page.
`,
      },
    ))
    const config = readConfig({ root: project.root })
    const warnSpy = vi.spyOn(logger, 'warn')
    await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    // Strip ANSI color codes so we can match the link target with boundaries.
    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')
    const warnings = warnSpy.mock.calls.map((c) => c[0]).filter((msg) => typeof msg === 'string' && msg.includes('broken link')).map(stripAnsi)
    const brokenTarget = (target: string) => warnings.some((w) => w.includes(`→ ${target} `))
    // /index (→ /), /guide/index (→ /guide), /guide/setup/index (→ /guide/setup)
    // are all valid index forms → should NOT warn
    expect(brokenTarget('/index')).toBe(false)
    expect(brokenTarget('/guide/index')).toBe(false)
    expect(brokenTarget('/guide/setup/index')).toBe(false)
    // /nope/index has no matching page → should warn
    expect(brokenTarget('/nope/index')).toBe(true)
  })

  test('warns about broken links even when parse errors are not logged', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          { group: 'Guide', pages: ['index'] },
        ],
      },
      {
        index: `---
title: Home
---

Link to [missing](/missing-page).
`,
      },
    ))
    const config = readConfig({ root: project.root })
    const warnSpy = vi.spyOn(logger, 'warn')
    await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
      logParseErrors: false,
    })

    const warnings = warnSpy.mock.calls.map((c) => c[0]).filter((msg) => typeof msg === 'string' && msg.includes('broken link'))
    expect(warnings.some((w) => w.includes('/missing-page'))).toBe(true)
  })

  test('does not warn for links matching knownPaths (exact and wildcard)', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          { group: 'Guide', pages: ['index'] },
        ],
        knownPaths: ['/dashboard', '/api/*', '/blog/*'],
      },
      {
        index: `---
title: Home
---

Go to [dashboard](/dashboard), [API](/api/users), [blog post](/blog/hello),
and [missing](/unknown-page).
`,
      },
    ))
    const config = readConfig({ root: project.root })
    const warnSpy = vi.spyOn(logger, 'warn')
    await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const warnings = warnSpy.mock.calls.map((c) => c[0]).filter((msg) => typeof msg === 'string' && msg.includes('broken link'))
    // /dashboard, /api/users, /blog/hello are all covered by knownPaths
    expect(warnings.some((w) => w.includes('/dashboard'))).toBe(false)
    expect(warnings.some((w) => w.includes('/api/users'))).toBe(false)
    expect(warnings.some((w) => w.includes('/blog/hello'))).toBe(false)
    // /unknown-page is not covered → should warn
    expect(warnings.some((w) => w.includes('/unknown-page'))).toBe(true)
    expect(warnings).toHaveLength(1)
  })

  test('strips hash fragments before validating links', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          { group: 'Guide', pages: ['index', 'setup'] },
        ],
      },
      {
        index: `---
title: Home
---

Go to [setup section](/setup#installation).
`,
        setup: `---
title: Setup
---

Content here.
`,
      },
    ))
    const config = readConfig({ root: project.root })
    const warnSpy = vi.spyOn(logger, 'warn')
    await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const warnings = warnSpy.mock.calls.map((c) => c[0]).filter((msg) => typeof msg === 'string' && msg.includes('broken link'))
    // /setup exists, hash should be stripped → no warning
    expect(warnings).toHaveLength(0)
  })

  test('validates .md/.mdx extension links against page slugs', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          { group: 'Guide', pages: ['index', 'getting-started'] },
        ],
      },
      {
        index: `---
title: Home
---

See [guide](/getting-started.md) and [setup](/getting-started.mdx).
Also [broken](/nonexistent.md) and [relative](./getting-started.mdx).
`,
        'getting-started': `---
title: Getting Started
---

Content here.
`,
      },
    ))
    const config = readConfig({ root: project.root })
    const warnSpy = vi.spyOn(logger, 'warn')
    await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const warnings = warnSpy.mock.calls.map((c) => c[0]).filter((msg) => typeof msg === 'string' && msg.includes('broken link'))
    // /getting-started.md and /getting-started.mdx should resolve to /getting-started → no warning
    // ./getting-started.mdx from index → /getting-started → no warning
    // /nonexistent.md should strip to /nonexistent → warn
    expect(warnings.some((w) => w.includes('/getting-started'))).toBe(false)
    expect(warnings.some((w) => w.includes('/nonexistent'))).toBe(true)
    expect(warnings).toHaveLength(1)
  })

  test('validates .md/.mdx links with hash fragments', async () => {
    const project = tracked(createProject(
      {
        navigation: [
          { group: 'Guide', pages: ['index', 'setup'] },
        ],
      },
      {
        index: `---
title: Home
---

Go to [install](/setup.md#installation).
`,
        setup: `---
title: Setup
---

Content here.
`,
      },
    ))
    const config = readConfig({ root: project.root })
    const warnSpy = vi.spyOn(logger, 'warn')
    await syncNavigation({
      config,
      pagesDir: project.pagesDir,
      publicDir: project.publicDir,
      projectRoot: project.root,
      distDir: project.distDir,
    })

    const warnings = warnSpy.mock.calls.map((c) => c[0]).filter((msg) => typeof msg === 'string' && msg.includes('broken link'))
    // /setup.md#installation → strips to /setup → exists → no warning
    expect(warnings).toHaveLength(0)
  })

  test('no false broken link when imported file outside pagesDir links back into pagesDir', async () => {
    // Setup: pagesDir is a subdirectory of project root.
    // A README.md at the project root is imported by index.mdx inside pagesDir.
    // README.md has a relative link to a file inside pagesDir (./website/src/openapi.md).
    // After URL rewriting, the link should resolve to /openapi, not /website/src/openapi.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-sync-test-'))
    const pagesDir = path.join(root, 'website', 'src')
    const publicDir = path.join(root, 'public')
    const distDir = path.join(root, 'dist')
    fs.mkdirSync(pagesDir, { recursive: true })
    fs.mkdirSync(publicDir, { recursive: true })
    fs.mkdirSync(distDir, { recursive: true })

    // Config file at project root
    fs.writeFileSync(path.join(root, 'holocron.jsonc'), JSON.stringify({
      navigation: [{ group: 'Docs', pages: ['index', 'openapi'] }],
    }))

    // README.md at project root with a relative link back into pagesDir
    fs.writeFileSync(path.join(root, 'README.md'), `# Project README

See [OpenAPI docs](./website/src/openapi.md) for the API reference.
`)

    // index.mdx imports README.md
    fs.writeFileSync(path.join(pagesDir, 'index.mdx'), `---
title: Home
---

import Readme from "../../README.md"

<Readme />
`)

    // openapi.mdx is a real page
    fs.writeFileSync(path.join(pagesDir, 'openapi.mdx'), `---
title: OpenAPI Reference
---

API docs here.
`)

    const project: TmpProject = { root, pagesDir, publicDir, distDir }
    projects.push(project)

    const config = readConfig({ root })
    const warnSpy = vi.spyOn(logger, 'warn')
    const result = await syncNavigation({
      config,
      pagesDir,
      publicDir,
      projectRoot: root,
      distDir,
    })

    const warnings = warnSpy.mock.calls.map((c) => c[0]).filter((msg) => typeof msg === 'string' && msg.includes('broken link'))
    // The link ./website/src/openapi.md from README.md should resolve to /openapi → no warning
    expect(warnings).toHaveLength(0)
    // Verify the rewritten MDX content has the correct absolute slug path
    expect(result.mdxContent.index).toContain('[OpenAPI docs](/openapi)')
  })
})
