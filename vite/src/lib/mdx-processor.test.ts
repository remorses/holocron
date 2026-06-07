import { describe, test, expect } from 'vitest'
import { processMdx as _processMdx, rewriteMdxImages, type ResolvedImage, type ProcessedMdx } from './mdx-processor.ts'
import { getPageRendering, parsePageFrontmatter } from './page-frontmatter.ts'

/** Wrapper that asserts processMdx succeeded (not a parse error). */
function processMdx(...args: Parameters<typeof _processMdx>): ProcessedMdx {
  const result = _processMdx(...args)
  expect(result).not.toBeInstanceOf(Error)
  if (result instanceof Error) throw result
  return result
}

describe('processMdx', () => {
  test('collects icon refs from the initial parse using the configured library', () => {
    const result = processMdx(`---
title: Icons
icon: rocket
---

<Card icon="github" />
<Card icon="fontawesome:brands:discord" />
`, 'lucide')

    expect(result.iconRefs).toEqual([
      'lucide:rocket',
      'lucide:github',
      'fontawesome:brands:discord',
    ])
  })

  test('extracts frontmatter', () => {
    const result = processMdx(`---
title: Hello World
description: A test page
---

# Content`)
    expect(result.title).toBe('Hello World')
    expect(result.description).toBe('A test page')
    expect(result.frontmatter).toMatchInlineSnapshot(`
      {
        "description": "A test page",
        "title": "Hello World",
      }
    `)
  })

  test('parses page SEO metadata, keywords, and sidebar fields from YAML frontmatter', () => {
    const result = processMdx(`---
title: API Overview
sidebarTitle: API
tag: BETA
deprecated: true
hidden: false
noindex: true
keywords: ["configuration", "setup"]
robots: noarchive
"og:title": Social API Overview
"og:image": https://example.com/og.png
"twitter:card": summary
---

# Content`)

    expect(result.frontmatter).toMatchInlineSnapshot(`
      {
        "deprecated": true,
        "hidden": false,
        "keywords": [
          "configuration",
          "setup",
        ],
        "noindex": true,
        "og:image": "https://example.com/og.png",
        "og:title": "Social API Overview",
        "robots": "noarchive",
        "sidebarTitle": "API",
        "tag": "BETA",
        "title": "API Overview",
        "twitter:card": "summary",
      }
    `)
  })

  test('parses the rendering strategy field from frontmatter', () => {
    const result = processMdx(`---
title: Static Page
rendering: static
---

# Static`)

    expect(result.frontmatter.rendering).toBe('static')
  })

  test('coerces numeric SEO dimension fields without dropping the rest of frontmatter', () => {
    const result = processMdx(`---
title: Numeric Widths
sidebarTitle: Numeric
"og:image:width": 1400
"twitter:image:height": 700
---

# Content`)

    expect(result.frontmatter).toMatchInlineSnapshot(`
      {
        "og:image:width": "1400",
        "sidebarTitle": "Numeric",
        "title": "Numeric Widths",
        "twitter:image:height": "700",
      }
    `)
  })

  test('preserves additional frontmatter fields without failing parsing', () => {
    const result = processMdx(`---
title: Extra Fields
customString: hello
customNumber: 42
customList:
  - one
  - two
customObject:
  enabled: true
  ratio: 1.5
---

# Content`)

    expect(result.frontmatter).toMatchInlineSnapshot(`
      {
        "customList": [
          "one",
          "two",
        ],
        "customNumber": 42,
        "customObject": {
          "enabled": true,
          "ratio": 1.5,
        },
        "customString": "hello",
        "title": "Extra Fields",
      }
    `)
  })

  test('extracts headings with depth, text, slug', () => {
    const result = processMdx(`## Getting Started

Some text.

### Installation

More text.

## API Reference`)
    expect(result.headings).toMatchInlineSnapshot(`
      [
        {
          "depth": 2,
          "slug": "getting-started",
          "text": "Getting Started",
        },
        {
          "depth": 3,
          "slug": "installation",
          "text": "Installation",
        },
        {
          "depth": 2,
          "slug": "api-reference",
          "text": "API Reference",
        },
      ]
    `)
  })

  test('deduplicates heading slugs with postfix', () => {
    const result = processMdx(`## Usage

First usage section.

## Configuration

Config section.

## Usage

Second usage section.`)
    expect(result.headings).toMatchInlineSnapshot(`
      [
        {
          "depth": 2,
          "slug": "usage",
          "text": "Usage",
        },
        {
          "depth": 2,
          "slug": "configuration",
          "text": "Configuration",
        },
        {
          "depth": 2,
          "slug": "usage-1",
          "text": "Usage",
        },
      ]
    `)
  })

  test('falls back to first heading for title when no frontmatter', () => {
    const result = processMdx(`## My Page Title

Some content.`)
    expect(result.title).toBe('My Page Title')
  })

  test('title defaults to Untitled when no frontmatter or headings', () => {
    const result = processMdx(`Just some plain text.`)
    expect(result.title).toBe('Untitled')
  })

  test('preserves JSX native headings while extracting page headings', () => {
    const result = processMdx('<h2 id="custom-id" className="hero">My heading</h2>')

    expect(result.headings).toMatchInlineSnapshot(`
      [
        {
          "depth": 2,
          "slug": "custom-id",
          "text": "My heading",
        },
      ]
    `)
    expect(result.normalizedContent).toMatchInlineSnapshot(`
      "<h2 id="custom-id" className="hero">My heading</h2>
      "
    `)
    expect(result.title).toBe('My heading')
  })

  test('extracts Heading components as page headings', () => {
    const result = processMdx('<Heading level={3} id="custom-id">My heading</Heading>')

    expect(result.headings).toMatchInlineSnapshot(`
      [
        {
          "depth": 3,
          "slug": "custom-id",
          "text": "My heading",
        },
      ]
    `)
  })

  test('extracts headings with inline code', () => {
    const result = processMdx(`## Overview

Some text.

### \`config\`

Config section.

### \`mdx\`

MDX section.

### \`navigation\`

Navigation section.

## Full example`)
    expect(result.headings).toMatchInlineSnapshot(`
      [
        {
          "depth": 2,
          "slug": "overview",
          "text": "Overview",
        },
        {
          "depth": 3,
          "slug": "config",
          "text": "config",
        },
        {
          "depth": 3,
          "slug": "mdx",
          "text": "mdx",
        },
        {
          "depth": 3,
          "slug": "navigation",
          "text": "navigation",
        },
        {
          "depth": 2,
          "slug": "full-example",
          "text": "Full example",
        },
      ]
    `)
  })

  test('collects relative image srcs', () => {
    const result = processMdx(`
![screenshot](./images/screenshot.png)

Some text.

![logo](../assets/logo.jpg)
`)
    expect(result.imageSrcs).toMatchInlineSnapshot(`
      [
        "./images/screenshot.png",
        "../assets/logo.jpg",
      ]
    `)
  })

  test('collects absolute image srcs', () => {
    const result = processMdx(`
![hero](/images/hero.png)

![icon](/icon.svg)
`)
    expect(result.imageSrcs).toMatchInlineSnapshot(`
      [
        "/images/hero.png",
        "/icon.svg",
      ]
    `)
  })

  test('skips external images', () => {
    const result = processMdx(`
![external](https://example.com/image.png)

![also external](http://cdn.example.com/photo.jpg)

![local](./local.png)
`)
    expect(result.imageSrcs).toMatchInlineSnapshot(`
      [
        "./local.png",
      ]
    `)
  })

  test('collects JSX Image srcs', () => {
    const result = processMdx(`
<Image src="./screenshot.png" alt="screenshot" />

<Image src="/hero.png" alt="hero" />
`)
    expect(result.imageSrcs).toMatchInlineSnapshot(`
      [
        "./screenshot.png",
        "/hero.png",
      ]
    `)
  })

  test('collects JSX img srcs including remote urls', () => {
    const result = processMdx(`
<img src="./screenshot.png" alt="local" />

<img src="https://example.com/demo.png" alt="remote" />
`)
    expect(result.imageSrcs).toMatchInlineSnapshot(`
      [
        "./screenshot.png",
        "https://example.com/demo.png",
      ]
    `)
  })

  test('deduplicates image srcs', () => {
    const result = processMdx(`
![first](./img.png)

![second](./img.png)
`)
    expect(result.imageSrcs).toMatchInlineSnapshot(`
      [
        "./img.png",
      ]
    `)
  })

  test('handles MDX with no images, no frontmatter, no headings', () => {
    const result = processMdx(`Just plain text with no special elements.`)
    expect(result.imageSrcs).toMatchInlineSnapshot(`[]`)
    expect(result.headings).toMatchInlineSnapshot(`[]`)
    expect(result.title).toBe('Untitled')
  })
})

describe('rewriteMdxImages', () => {
  const testMeta: ResolvedImage = {
    publicSrc: '/_holocron/images/a1b2c3-screenshot.png',
    meta: {
      width: 1200,
      height: 800,
      placeholder: 'data:image/png;base64,abc123',
    },
  }

  test('converts standalone markdown image to Image JSX', () => {
    const { mdast } = processMdx(`![screenshot](./images/screenshot.png)`)
    const images = new Map([['./images/screenshot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    expect(result).toMatchInlineSnapshot(`
      "<Image src="/_holocron/images/a1b2c3-screenshot.png" alt="screenshot" width="1200" height="800" placeholder="data:image/png;base64,abc123" />
      "
    `)
  })

  test('updates src for markdown image inside mixed paragraph', () => {
    const { mdast } = processMdx(`Some text before ![screenshot](./images/screenshot.png) and after.`)
    const images = new Map([['./images/screenshot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    expect(result).toMatchInlineSnapshot(`
      "Some text before ![screenshot](/_holocron/images/a1b2c3-screenshot.png) and after.
      "
    `)
  })

  test('adds width/height/placeholder to existing JSX Image without user dims', () => {
    const { mdast } = processMdx(`<Image src="./screenshot.png" alt="test" />`)
    const images = new Map([['./screenshot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    expect(result).toMatchInlineSnapshot(`
      "<Image src="/_holocron/images/a1b2c3-screenshot.png" alt="test" width="1200" height="800" placeholder="data:image/png;base64,abc123" />
      "
    `)
  })

  test('preserves user-specified width/height on JSX Image', () => {
    const { mdast } = processMdx(`<Image src="./screenshot.png" alt="logo" width="92" height="31" />`)
    const images = new Map([['./screenshot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    // User specified 92x31 — should NOT be overridden with natural 1200x800
    expect(result).toMatchInlineSnapshot(`
      "<Image src="/_holocron/images/a1b2c3-screenshot.png" alt="logo" width="92" height="31" placeholder="data:image/png;base64,abc123" />
      "
    `)
  })

  test('falls back to natural dims when user width is non-numeric', () => {
    const { mdast } = processMdx(`<img src="./screenshot.png" width="100%" />`)
    const images = new Map([['./screenshot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    // "100%" is not a finite number — fall back to natural 1200x800, never emit NaN
    expect(result).toMatchInlineSnapshot(`
      "<Image src="/_holocron/images/a1b2c3-screenshot.png" alt="" width="1200" height="800" placeholder="data:image/png;base64,abc123" />
      "
    `)
  })

  test('converts root-level JSX img to responsive Image while preserving user height', () => {
    const { mdast } = processMdx(`<img className="hero" height="200" src="./screenshot.png" />`)
    const images = new Map([['./screenshot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    // User specified height="200" — preserved. Width computed proportionally: 200 * 1200/800 = 300.
    expect(result).toMatchInlineSnapshot(`
      "<Image className="hero" src="/_holocron/images/a1b2c3-screenshot.png" alt="" width="300" height="200" placeholder="data:image/png;base64,abc123" />
      "
    `)
  })

  test('converts nested flow JSX img to responsive Image while preserving user height', () => {
    const { mdast } = processMdx(`
<Step title="Create account">
  <img className="hero" height="200" src="./screenshot.png" />
</Step>`)
    const images = new Map([['./screenshot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    expect(result).toMatchInlineSnapshot(`
      "<Step title="Create account">
        <Image className="hero" src="/_holocron/images/a1b2c3-screenshot.png" alt="" width="300" height="200" placeholder="data:image/png;base64,abc123" />
      </Step>
      "
    `)
  })

  test('leaves unmatched images untouched', () => {
    const { mdast } = processMdx(`![unknown](./unknown.png)`)
    const images = new Map<string, ResolvedImage>()
    const result = rewriteMdxImages(mdast, images)
    expect(result).toMatchInlineSnapshot(`
      "![unknown](./unknown.png)
      "
    `)
  })

  test('preserves frontmatter through serialization', () => {
    const { mdast } = processMdx(`---
title: My Page
description: A description
---

![shot](./shot.png)`)
    const images = new Map([['./shot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    expect(result).toMatchInlineSnapshot(`
      "---
      title: My Page
      description: A description
      ---

      <Image src="/_holocron/images/a1b2c3-screenshot.png" alt="shot" width="1200" height="800" placeholder="data:image/png;base64,abc123" />
      "
    `)
  })

  test('does not touch code blocks containing image-like text', () => {
    const { mdast } = processMdx(`
\`\`\`markdown
![not an image](./screenshot.png)
\`\`\`
`)
    const images = new Map([['./screenshot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    // Code block content should be preserved verbatim
    expect(result).toMatchInlineSnapshot(`
      "\`\`\`markdown
      ![not an image](./screenshot.png)
      \`\`\`
      "
    `)
  })
})

describe('processMdx importSources', () => {
  test('extracts local import sources from MDX import declarations', () => {
    const result = processMdx(`---
title: Test
---

import { Greeting } from '/snippets/greeting'
import { Badge } from '../components/badge'
import Alert from './alert'

# Hello
`)
    expect(result.importSources).toMatchInlineSnapshot(`
      [
        "/snippets/greeting",
        "../components/badge",
        "./alert",
      ]
    `)
  })

  test('excludes bare specifiers (npm packages)', () => {
    const result = processMdx(`---
title: Test
---

import React from 'react'
import { useState } from 'react'
import { Card } from '/components/card'

# Hello
`)
    expect(result.importSources).toMatchInlineSnapshot(`
      [
        "/components/card",
      ]
    `)
  })

  test('returns empty array when no local imports exist', () => {
    const result = processMdx(`---
title: Test
---

# No imports here
`)
    expect(result.importSources).toEqual([])
  })

  test('preserves ?raw query string in import sources', () => {
    const result = processMdx(`---
title: Test
---

import code from './example.ts?raw'
import schema from '/snippets/schema.json?raw'
import readme from '../docs/readme.md?raw'

# Hello
`)
    // ?raw is preserved as-is — resolveImportSources in sync.ts handles
    // stripping the query for filesystem probing and re-attaching it to
    // the moduleKey so safe-mdx can match exactly.
    expect(result.importSources).toMatchInlineSnapshot(`
      [
        "./example.ts?raw",
        "/snippets/schema.json?raw",
        "../docs/readme.md?raw",
      ]
    `)
  })
})

describe('processMdx icon refs', () => {
  test('uses the configured project library for frontmatter and JSX icon strings', () => {
    expect(processMdx(`---
icon: rocket
---

<Card icon="github" />
`, 'lucide').iconRefs).toEqual(['lucide:rocket', 'lucide:github'])
  })

  test('supports explicit library prefixes and fontawesome iconType', () => {
    expect(processMdx(`
<Card icon="fontawesome:brands:discord" />
<Card icon="user" iconType="regular" />
`, 'fontawesome').iconRefs).toEqual(['fontawesome:brands:discord', 'fontawesome:regular:user'])
  })
})

describe('internal link collection', () => {
  test('collects markdown links with absolute paths', () => {
    const result = processMdx(`
Check the [quickstart](/quickstart) and [API reference](/api/overview).
`)
    expect(result.internalLinks.map((l) => l.href)).toMatchInlineSnapshot(`
      [
        "/quickstart",
        "/api/overview",
      ]
    `)
  })

  test('collects relative markdown links', () => {
    const result = processMdx(`
See [next page](./next) and [parent](../intro).
`)
    expect(result.internalLinks.map((l) => l.href)).toMatchInlineSnapshot(`
      [
        "./next",
        "../intro",
      ]
    `)
  })

  test('collects JSX Card and a element hrefs', () => {
    const result = processMdx(`
<Card href="/getting-started">Get Started</Card>
<a href="/api/overview">API</a>
`)
    expect(result.internalLinks.map((l) => l.href)).toMatchInlineSnapshot(`
      [
        "/getting-started",
        "/api/overview",
      ]
    `)
  })

  test('excludes external URLs, anchors, and special protocols', () => {
    const result = processMdx(`
[External](https://example.com)
[Mail](mailto:user@example.com)
[Anchor](#section)
[HTTP](http://example.com)
[Internal](/real-page)
`)
    expect(result.internalLinks.map((l) => l.href)).toMatchInlineSnapshot(`
      [
        "/real-page",
      ]
    `)
  })

  test('preserves hash fragments and query strings in href', () => {
    const result = processMdx(`
See [setup](/getting-started#setup) and [filtered](/api?version=2).
`)
    expect(result.internalLinks.map((l) => l.href)).toMatchInlineSnapshot(`
      [
        "/getting-started#setup",
        "/api?version=2",
      ]
    `)
  })

  test('deduplicates links by href', () => {
    const result = processMdx(`
[First](/same-page) and [Second](/same-page).
`)
    expect(result.internalLinks).toHaveLength(1)
    expect(result.internalLinks[0]!.href).toBe('/same-page')
  })

  test('excludes links to static files with extensions', () => {
    const result = processMdx(`
Download the [schema](/openapi.json) and [guide](/docs/guide.pdf).
Also [image](/logo.png) and [real page](/getting-started).
`)
    expect(result.internalLinks.map((l) => l.href)).toMatchInlineSnapshot(`
      [
        "/getting-started",
      ]
    `)
  })

  test('collects Tile, Tooltip, and Badge hrefs', () => {
    const result = processMdx(`
<Tile href="/tile-page">Tile</Tile>
<Tooltip href="/tooltip-page">Tip</Tooltip>
<Badge href="/badge-page">New</Badge>
`)
    expect(result.internalLinks.map((l) => l.href)).toMatchInlineSnapshot(`
      [
        "/tile-page",
        "/tooltip-page",
        "/badge-page",
      ]
    `)
  })

  test('skips dynamic JSX expression href attributes', () => {
    const result = processMdx(`
<Card href="/static-page">Static</Card>
<Card href={dynamicUrl}>Dynamic</Card>
`)
    expect(result.internalLinks.map((l) => l.href)).toMatchInlineSnapshot(`
      [
        "/static-page",
      ]
    `)
  })

  test('collects .md/.mdx links as page links with extensions stripped', () => {
    const result = processMdx(`
See [guide](/getting-started.md) and [setup](./setup.mdx).
Also [nested](/docs/intro.md) and [relative](../api/overview.mdx).
`)
    // .md/.mdx are page links, not static files — they should be collected
    // with extensions stripped so they match page hrefs
    expect(result.internalLinks.map((l) => l.href)).toMatchInlineSnapshot(`
      [
        "/getting-started",
        "./setup",
        "/docs/intro",
        "../api/overview",
      ]
    `)
  })

  test('collects .md/.mdx JSX href links with extensions stripped', () => {
    const result = processMdx(`
<Card href="/getting-started.mdx">Get Started</Card>
<a href="./setup.md">Setup</a>
`)
    expect(result.internalLinks.map((l) => l.href)).toMatchInlineSnapshot(`
      [
        "/getting-started",
        "./setup",
      ]
    `)
  })

  test('.md/.mdx links with hash fragments strip extension but keep hash', () => {
    const result = processMdx(`
See [install](/getting-started.md#installation) and [config](./setup.mdx#config).
`)
    expect(result.internalLinks.map((l) => l.href)).toMatchInlineSnapshot(`
      [
        "/getting-started#installation",
        "./setup#config",
      ]
    `)
  })

  test('does not strip .md inside query strings or hash values', () => {
    const result = processMdx(`
See [search](/search?file=guide.md) and [section](/page#readme.md).
`)
    // .md inside query/hash should NOT be stripped — only path extensions
    expect(result.internalLinks.map((l) => l.href)).toMatchInlineSnapshot(`
      [
        "/search?file=guide.md",
        "/page#readme.md",
      ]
    `)
  })

  test('collects reference-style markdown links with extension stripped', () => {
    const result = processMdx(`
See [guide][g] and [setup][s].

[g]: /getting-started.md
[s]: ./setup.mdx#config
`)
    expect(result.internalLinks.map((l) => l.href)).toMatchInlineSnapshot(`
      [
        "/getting-started",
        "./setup#config",
      ]
    `)
  })
})

describe('asset refs collection', () => {
  test('collects markdown image refs with line numbers', () => {
    const result = processMdx(`---
title: Test
---

![screenshot](./screenshot.png)

Some text here.

![hero](/images/hero.jpg)
`)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result.assetRefs).toMatchInlineSnapshot(`
      [
        {
          "line": 5,
          "src": "./screenshot.png",
        },
        {
          "line": 9,
          "src": "/images/hero.jpg",
        },
      ]
    `)
  })

  test('collects JSX Image and video refs', () => {
    const result = processMdx(`---
title: Test
---

<Image src="./photo.webp" alt="photo" />

<video src="./demo.mp4" />

<audio src="/sounds/alert.mp3" />
`)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result.assetRefs.map((r) => r.src)).toMatchInlineSnapshot(`
      [
        "./photo.webp",
        "./demo.mp4",
        "/sounds/alert.mp3",
      ]
    `)
  })

  test('excludes remote URLs from asset refs', () => {
    const result = processMdx(`---
title: Test
---

![remote](https://example.com/image.png)

<video src="https://cdn.example.com/video.mp4" />
`)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result.assetRefs).toMatchInlineSnapshot(`[]`)
  })

  test('deduplicates asset refs by src', () => {
    const result = processMdx(`---
title: Test
---

![first](./image.png)

![second](./image.png)
`)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result.assetRefs).toHaveLength(1)
    expect(result.assetRefs[0]!.src).toBe('./image.png')
  })

  test('collects LazyVideo and source element refs', () => {
    const result = processMdx(`---
title: Test
---

<LazyVideo src="./lazy.mp4" />
`)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result.assetRefs.map((r) => r.src)).toMatchInlineSnapshot(`
      [
        "./lazy.mp4",
      ]
    `)
  })

  test('skips JSX expression src values (not static strings)', () => {
    const result = processMdx(`---
title: Test
---

<Image src={logo} alt="dynamic" />

<Image src="./static.png" alt="static" />
`)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    // Only the static string should be collected, not the JSX expression
    expect(result.assetRefs.map((r) => r.src)).toMatchInlineSnapshot(`
      [
        "./static.png",
      ]
    `)
  })

  test('excludes data URIs and blob URLs', () => {
    const result = processMdx(`---
title: Test
---

![inline](data:image/png;base64,iVBORw0KGgo=)

<img src="blob:https://example.com/12345" />

<img src="#sprite-id" />
`)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result.assetRefs).toMatchInlineSnapshot(`[]`)
  })

  test('collects video poster attribute', () => {
    const result = processMdx(`---
title: Test
---

<video poster="./poster.jpg" src="https://cdn.example.com/video.mp4" />
`)
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result.assetRefs.map((r) => r.src)).toMatchInlineSnapshot(`
      [
        "./poster.jpg",
      ]
    `)
  })
})

describe('auto-generated description', () => {
  test('extracts description from first paragraphs when no frontmatter description', () => {
    const result = processMdx(`# Getting Started

Welcome to the docs. This is the first paragraph with useful information.

This is the second paragraph with more details.
`)
    expect(result.description).toMatchInlineSnapshot(`"Welcome to the docs. This is the first paragraph with useful information. This is the second paragraph with more details."`)
  })

  test('frontmatter description takes precedence over auto-generated', () => {
    const result = processMdx(`---
title: My Page
description: Explicit description from frontmatter
---

This paragraph text should be ignored because frontmatter description exists.
`)
    expect(result.description).toBe('Explicit description from frontmatter')
  })

  test('skips headings and only uses paragraph text', () => {
    const result = processMdx(`# Main Title

## Subtitle

The actual content starts here.
`)
    expect(result.description).toMatchInlineSnapshot(`"The actual content starts here."`)
  })

  test('skips code blocks', () => {
    const result = processMdx(`\`\`\`bash
npm install holocron
\`\`\`

After installing, configure your project.
`)
    expect(result.description).toMatchInlineSnapshot(`"After installing, configure your project."`)
  })

  test('includes inline code in description', () => {
    const result = processMdx(`Use the \`holocron\` CLI to scaffold your project quickly.
`)
    expect(result.description).toMatchInlineSnapshot(`"Use the holocron CLI to scaffold your project quickly."`)
  })

  test('includes bold and italic as plain text', () => {
    const result = processMdx(`This is **bold text** and *italic text* in a paragraph.
`)
    expect(result.description).toMatchInlineSnapshot(`"This is bold text and italic text in a paragraph."`)
  })

  test('truncates long text at word boundary with ellipsis', () => {
    const result = processMdx(`This is a very long paragraph that contains a lot of words and should be truncated at approximately one hundred and sixty characters so that the meta description tag does not exceed the recommended length for search engine optimization purposes and displays nicely in search results.
`)
    expect(result.description!.length).toBeLessThanOrEqual(163) // 160 + '...'
    expect(result.description!.endsWith('...')).toBe(true)
    expect(result.description).toMatchInlineSnapshot(`"This is a very long paragraph that contains a lot of words and should be truncated at approximately one hundred and sixty characters so that the meta..."`)
  })

  test('short text has no ellipsis', () => {
    const result = processMdx(`A short paragraph.
`)
    expect(result.description).toMatchInlineSnapshot(`"A short paragraph."`)
    expect(result.description!.endsWith('...')).toBe(false)
  })

  test('returns undefined when no paragraphs exist', () => {
    const result = processMdx(`# Only Headings

## Another Heading

### Third Heading
`)
    expect(result.description).toBeUndefined()
  })

  test('returns undefined for JSX-only content', () => {
    const result = processMdx(`<Card title="Hello">
  Content inside card
</Card>
`)
    expect(result.description).toBeUndefined()
  })

  test('extracts link text without URL', () => {
    const result = processMdx(`Check the [getting started guide](/quickstart) for more information.
`)
    expect(result.description).toMatchInlineSnapshot(`"Check the getting started guide for more information."`)
  })

  test('handles hard line breaks without concatenating words', () => {
    const result = processMdx(`First line  
Second line in the same paragraph.
`)
    expect(result.description).toMatchInlineSnapshot(`"First line Second line in the same paragraph."`)
  })

  test('joins multiple paragraphs into one description', () => {
    const result = processMdx(`First paragraph here.

Second paragraph here.

Third paragraph here.
`)
    expect(result.description).toMatchInlineSnapshot(`"First paragraph here. Second paragraph here. Third paragraph here."`)
  })
})

describe('getPageRendering', () => {
  test('defaults to ssr when the field is absent', () => {
    expect(getPageRendering(parsePageFrontmatter('---\ntitle: X\n---\n'))).toBe('ssr')
    expect(getPageRendering(undefined)).toBe('ssr')
  })

  test('returns ssr for an explicit ssr value', () => {
    expect(getPageRendering(parsePageFrontmatter('---\nrendering: ssr\n---\n'))).toBe('ssr')
  })

  test('returns static for an explicit static value', () => {
    expect(getPageRendering(parsePageFrontmatter('---\nrendering: static\n---\n'))).toBe('static')
  })

  test('ignores an invalid rendering value and falls back to ssr', () => {
    // invalid enum → whole frontmatter parse fails → {} → ssr default
    expect(getPageRendering(parsePageFrontmatter('---\nrendering: nonsense\n---\n'))).toBe('ssr')
  })
})
