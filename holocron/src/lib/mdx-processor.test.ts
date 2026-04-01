import { describe, test, expect } from 'vitest'
import { processMdx, rewriteMdxImages, type ResolvedImage } from './mdx-processor.ts'

describe('processMdx', () => {
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

  test('collects JSX PixelatedImage srcs', () => {
    const result = processMdx(`
<PixelatedImage src="./screenshot.png" alt="screenshot" />

<PixelatedImage src="/hero.png" alt="hero" />
`)
    expect(result.imageSrcs).toMatchInlineSnapshot(`
      [
        "./screenshot.png",
        "/hero.png",
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

  test('converts standalone markdown image to PixelatedImage JSX', () => {
    const { mdast } = processMdx(`![screenshot](./images/screenshot.png)`)
    const images = new Map([['./images/screenshot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    expect(result).toMatchInlineSnapshot(`
      "<PixelatedImage src="/_holocron/images/a1b2c3-screenshot.png" alt="screenshot" width="1200" height="800" placeholder="data:image/png;base64,abc123" />
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

  test('adds width/height/placeholder to existing JSX PixelatedImage', () => {
    const { mdast } = processMdx(`<PixelatedImage src="./screenshot.png" alt="test" />`)
    const images = new Map([['./screenshot.png', testMeta]])
    const result = rewriteMdxImages(mdast, images)
    expect(result).toMatchInlineSnapshot(`
      "<PixelatedImage src="/_holocron/images/a1b2c3-screenshot.png" alt="test" width="1200" height="800" placeholder="data:image/png;base64,abc123" />
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

      <PixelatedImage src="/_holocron/images/a1b2c3-screenshot.png" alt="shot" width="1200" height="800" placeholder="data:image/png;base64,abc123" />
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
