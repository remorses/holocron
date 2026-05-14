import { describe, test, expect } from 'vitest'
import { processMdx, rewriteMdxImages, type ResolvedImage } from './mdx-processor.ts'

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
    expect(result.title).toBe('My heading')
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

  test('adds width/height/placeholder to existing JSX Image', () => {
    const { mdast } = processMdx(`<Image src="./screenshot.png" alt="test" />`)
    const images = new Map([['./screenshot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    expect(result).toMatchInlineSnapshot(`
      "<Image src="/_holocron/images/a1b2c3-screenshot.png" alt="test" width="1200" height="800" placeholder="data:image/png;base64,abc123" />
      "
    `)
  })

  test('converts root-level JSX img to responsive Image while preserving non-sizing attrs', () => {
    const { mdast } = processMdx(`<img className="hero" height="200" src="./screenshot.png" />`)
    const images = new Map([['./screenshot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    expect(result).toMatchInlineSnapshot(`
      "<Image className="hero" src="/_holocron/images/a1b2c3-screenshot.png" alt="" width="1200" height="800" placeholder="data:image/png;base64,abc123" />
      "
    `)
  })

  test('converts nested flow JSX img to responsive Image while preserving non-sizing attrs', () => {
    const { mdast } = processMdx(`
<Step title="Create account">
  <img className="hero" height="200" src="./screenshot.png" />
</Step>`)
    const images = new Map([['./screenshot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    expect(result).toMatchInlineSnapshot(`
      "<Step title="Create account">
        <Image className="hero" src="/_holocron/images/a1b2c3-screenshot.png" alt="" width="1200" height="800" placeholder="data:image/png;base64,abc123" />
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
