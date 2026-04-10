import { describe, test, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createServer, type Server } from 'node:http'
import { syncNavigation } from './sync.ts'
import { PACKAGE_VERSION } from './package-version.ts'
import { readConfig } from '../config.ts'
import { collectAllPages, findPage, buildPageIndex } from '../navigation.ts'

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
    expect(result.mdxContent['page']).toContain('<Heading level={2} id="section">')

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

    expect(result.mdxContent.page).toContain(`<PixelatedImage src="${imageUrl}" alt="" intrinsicWidth="1" intrinsicHeight="1" placeholder="data:image/webp;base64,`)
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

    expect(result.mdxContent.page).toContain('<PixelatedImage')
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

    expect(result.mdxContent.page).toContain('<PixelatedImage')
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
})
