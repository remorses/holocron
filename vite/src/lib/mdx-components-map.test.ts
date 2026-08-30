import { describe, expect, it } from 'vitest'

import { createRenderNode, mdxComponents, renderNode } from './mdx-components-map.tsx'
import { buildCodeFrame, formatMdxError, HolocronMdxParseError } from './logger.ts'
import { normalizeMdx } from './normalize-mdx.ts'
import { RenderNodes } from './mdx-components-map.tsx'
import { assignUniqueHeadingIds } from './toc-tree.ts'
import { SafeMdxRenderer } from 'safe-mdx'
import { mdxParse } from 'safe-mdx/parse'
import type { Root, RootContent } from 'mdast'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import dedent from 'string-dedent'

/**
 * Full production pipeline: raw MDX → normalizeMdx (remark plugins + serialize)
 * → mdxParse (safe-mdx re-parse) → RenderNodes → HTML string.
 *
 * This matches app-factory.tsx's renderMdxPage path:
 * 1. normalizeMdx runs remark plugins and serializes to MDX string (done during sync)
 * 2. mdxParse re-parses the serialized MDX into a fresh mdast (done at request time)
 * 3. RenderNodes renders nodes through SafeMdxRenderer + mdxComponents + renderNode
 *
 * buildSections is skipped because it injects PageNavRow/assistant components
 * that need runtime context. Section splitting doesn't affect component mapping.
 */
function renderMdx(raw: string) {
  // Step 1: normalizeMdx (remark plugins + serialize) — same as sync.ts
  const normalized = normalizeMdx(raw)
  if (normalized instanceof Error) throw normalized

  // Step 2: mdxParse re-parses serialized content — same as parsePageMdx in app-factory.tsx
  const mdast = mdxParse(normalized.content)
  assignUniqueHeadingIds(mdast.children)

  // Step 3: RenderNodes — same as renderMdxPage (minus section splitting)
  const html = renderToStaticMarkup(
    createElement(RenderNodes, { markdown: normalized.content, nodes: mdast.children }),
  )

  return { html, mdast, normalized: normalized.content }
}

describe('mdxComponents', () => {
  it('overrides native heading tags with P-unwrapping wrappers', () => {
    const overriddenHeadingTags = Object.keys(mdxComponents).filter((key) => {
      return /^h[1-6]$/.test(key)
    })

    expect(overriddenHeadingTags).toMatchInlineSnapshot(`
      [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
      ]
    `)
  })

  it('overrides native table tags for editorial styling', () => {
    const overriddenTableTags = Object.keys(mdxComponents).filter((key) => {
      return ['table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption'].includes(key)
    })

    expect(overriddenTableTags).toMatchInlineSnapshot(`
      [
        "table",
        "thead",
        "tbody",
        "tfoot",
        "tr",
        "th",
        "td",
        "caption",
      ]
    `)
  })
})

describe('buildCodeFrame', () => {
  it('shows context lines around the error with a caret', () => {
    const source = [
      'line 1',
      'line 2',
      'line 3',
      'line 4 has an <error',
      'line 5',
      'line 6',
      'line 7',
    ].join('\n')

    const frame = buildCodeFrame(source, 4, 15)
    // Strip ANSI codes for snapshot
    const clean = frame.replace(/\x1b\[[0-9;]*m/g, '')
    expect(clean).toMatchInlineSnapshot(`
      "  1 | line 1
        2 | line 2
        3 | line 3
      > 4 | line 4 has an <error
                          ^
        5 | line 5
        6 | line 6
        7 | line 7"
    `)
  })

  it('handles error on first line', () => {
    const source = 'bad syntax here\nline 2\nline 3'
    const frame = buildCodeFrame(source, 1, 5)
    const clean = frame.replace(/\x1b\[[0-9;]*m/g, '')
    expect(clean).toMatchInlineSnapshot(`
      "> 1 | bad syntax here
                ^
        2 | line 2
        3 | line 3"
    `)
  })
})

describe('HolocronMdxParseError', () => {
  it('includes source, line, reason, and code frame in message', () => {
    const err = new HolocronMdxParseError({
      reason: 'Unexpected character',
      line: 3,
      column: 5,
      source: '/getting-started',
      mdxSource: 'line 1\nline 2\nline 3 {bad\nline 4',
    })
    expect(err.name).toBe('HolocronMdxParseError')
    expect(err.line).toBe(3)
    expect(err.column).toBe(5)
    expect(err.reason).toBe('Unexpected character')
    expect(err.source).toBe('/getting-started')
    expect(err.message).toContain('/getting-started:3:5')
    expect(err.message).toContain('Unexpected character')
    expect(err.codeFrame).toContain('line 3 {bad')
  })
})

describe('formatMdxError', () => {
  it('formats missing components as a concise terminal line', () => {
    const formatted = formatMdxError(
      { type: 'missing-component', line: 34, message: 'Unsupported jsx component Caption' },
      '/components',
    )

    expect(formatted.replace(/\x1b\[[0-9;]*m/g, '')).toMatchInlineSnapshot(`
      "▲ holocron MDX /components:34 Unsupported jsx component Caption"
    `)
  })
})

describe('ordered list numbering — full production pipeline', () => {
  it('preserves start attribute on ordered lists split by code blocks', () => {
    const { html } = renderMdx(dedent`
      1. Clone the repo:

      \`\`\`bash
      git clone https://github.com/example/repo.git
      \`\`\`

      2. Install dependencies:

      \`\`\`bash
      pnpm install
      \`\`\`

      3. Run locally:

      \`\`\`bash
      pnpm dev
      \`\`\`

      4. Deploy:

      \`\`\`bash
      pnpm deploy
      \`\`\`
    `)

    // Each separate <ol> must have the correct start attribute so the
    // browser renders 1, 2, 3, 4 instead of 1, 1, 1, 1.
    const olMatches = html.match(/<ol[^>]*>/g) || []
    expect(olMatches.length).toBe(4)
    expect(olMatches[0]).toContain('start="1"')
    expect(olMatches[1]).toContain('start="2"')
    expect(olMatches[2]).toContain('start="3"')
    expect(olMatches[3]).toContain('start="4"')
  })
})

describe('MDX paragraph rendering — full production pipeline', () => {
  it('plain markdown text gets editorial-prose styling', () => {
    const { html } = renderMdx('Hello world')
    expect(html).toMatchInlineSnapshot(`"<div class="editorial-prose">Hello world</div>"`)
  })

  it('JSX <p> gets same editorial-prose styling as markdown paragraph', () => {
    const { html } = renderMdx('<p>Hello world</p>')
    expect(html).toMatchInlineSnapshot(`"<div class="editorial-prose">Hello world</div>"`)
  })

  it('JSX <p> with className merges into editorial-prose', () => {
    const { html } = renderMdx(dedent`
      <p className='text-center font-medium'>Styled paragraph</p>
    `)
    expect(html).toMatchInlineSnapshot(`"<div class="editorial-prose text-center font-medium">Styled paragraph</div>"`)
  })

  it('JSX <p> inside Hero gets editorial-prose', () => {
    const { html } = renderMdx(dedent`
      <Hero>

      <p className='text-center'>Inner paragraph</p>

      </Hero>
    `)
    expect(html).toMatchInlineSnapshot(`"<div><div class="editorial-prose text-center">Inner paragraph</div></div>"`)
  })

  it('plain text inside Hero gets editorial-prose', () => {
    const { html } = renderMdx(dedent`
      <Hero>

      Inner paragraph text

      </Hero>
    `)
    expect(html).toMatchInlineSnapshot(`"<div><div class="editorial-prose">Inner paragraph text</div></div>"`)
  })

  it('h1 with className inside Above — multi-line form unwraps P automatically', () => {
    const { html } = renderMdx(dedent`
      <Above>
          <h1 className='w-full my-14 text-6xl font-bold text-balance leading-tight'>
              Launching Playwriter
          </h1>
      </Above>
    `)
    // renderNode unwraps paragraph children from native h1-h6 flow elements,
    // so multi-line and single-line produce the same clean output
    expect(html).toMatchInlineSnapshot(`"<div><h1 class="w-full my-14 text-6xl font-bold text-balance leading-tight" id="launching-playwriter">Launching Playwriter</h1></div>"`)
  })

  it('h1 with className inside Above — single-line form also works', () => {
    const { html } = renderMdx(dedent`
      <Above>
          <h1 className='w-full my-14 text-6xl font-bold text-balance leading-tight'>Launching Playwriter</h1>
      </Above>
    `)
    expect(html).toMatchInlineSnapshot(`"<div><h1 class="w-full my-14 text-6xl font-bold text-balance leading-tight" id="launching-playwriter">Launching Playwriter</h1></div>"`)
  })

  it('h2 multi-line inside container — unwraps P', () => {
    const { html } = renderMdx(dedent`
      <div>
          <h2 className='text-3xl'>
              Section Title
          </h2>
      </div>
    `)
    expect(html).toMatchInlineSnapshot(`"<div><h2 class="text-3xl" id="section-title">Section Title</h2></div>"`)
  })
})

describe('interactive MDX components — full production pipeline', () => {
  function expectSeparateLinks(html: string, overlayHref: string, innerHref: string) {
    const overlayStart = html.indexOf(`href="${overlayHref}"`)
    const overlayEnd = html.indexOf('</a>', overlayStart)
    const innerStart = html.indexOf(`href="${innerHref}"`)

    expect(overlayStart).toBeGreaterThan(-1)
    expect(overlayEnd).toBeGreaterThan(overlayStart)
    expect(innerStart).toBeGreaterThan(overlayEnd)
    expect(html.match(/<a\b/g)).toHaveLength(2)
  }

  it('renders Card, Tile, and linked Badge children outside their overlay links', () => {
    const card = renderMdx(dedent`
      <Card href="/card" title="Card">
      [Inner card link](/card-inner)
      </Card>
    `).html
    const tile = renderMdx(dedent`
      <Tile href="/tile" title="Tile">
      [Inner tile link](/tile-inner)
      </Tile>
    `).html
    const badge = renderMdx(dedent`
      <Badge href="/badge">
      [Inner badge link](/badge-inner)
      </Badge>
    `).html

    expectSeparateLinks(card, '/card', '/card-inner')
    expectSeparateLinks(tile, '/tile', '/tile-inner')
    expectSeparateLinks(badge, '/badge', '/badge-inner')
  })

  it('does not nest the overlay link when Card requests an interactive root element', () => {
    const html = renderMdx(dedent`
      <Card as="a" href="/card" title="Card">
      [Inner card link](/card-inner)
      </Card>
    `).html

    expectSeparateLinks(html, '/card', '/card-inner')
    expect(html).not.toMatch(/<a[^>]*>\s*<a/)
  })

  it('renders a disabled Card with an interactive root as a non-interactive div', () => {
    const html = renderMdx(dedent`
      <Card as="button" href="/card" title="Disabled" disabled>
      Disabled body
      </Card>
    `).html

    expect(html).toContain('<div')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('href="/card"')
  })
})

describe('Image rendering — full production pipeline', () => {
  it('derives intrinsic height from the responsive frame width', () => {
    const { html } = renderMdx(dedent`
      <Image src="/screenshot.png" alt="Screenshot" intrinsicWidth="1280" intrinsicHeight="800" />
    `)

    expect(html).toContain('width:1280px')
    expect(html).toContain('height:auto')
    expect(html).toContain('aspect-ratio:1280 / 800')
  })

  it('preserves a style width and keeps the real image and placeholder uncropped', () => {
    const { html } = renderMdx(dedent`
      <Image
        src="/logo.png"
        alt="Logo"
        intrinsicWidth="1200"
        intrinsicHeight="800"
        placeholder="data:image/png;base64,abc123"
        style={{ width: '20px' }}
      />
    `)

    expect(html).toContain('width:20px')
    expect(html).toContain('object-fit:contain')
    expect(html).not.toContain('object-fit:cover')
    expect(html).toContain('max-width:100%')
  })

  it('uses auto for the missing author dimension', () => {
    const { html } = renderMdx(dedent`
      <Image src="/logo.png" alt="Logo" width="20" intrinsicWidth="1200" intrinsicHeight="800" />
    `)

    expect(html).toContain('width:20px')
    expect(html).toContain('height:auto')
  })

  it('uses auto width when only author height is set', () => {
    const { html } = renderMdx(dedent`
      <Image src="/logo.png" alt="Logo" height="20" intrinsicWidth="1200" intrinsicHeight="800" />
    `)

    expect(html).toContain('width:auto')
    expect(html).toContain('height:20px')
  })

  it('constrains a large explicit width to the content column', () => {
    const { html } = renderMdx(dedent`
      <Image src="/large.png" alt="Large" width="900" intrinsicWidth="1200" intrinsicHeight="800" />
    `)

    expect(html).toContain('width:900px')
    expect(html).toContain('max-width:100%')
    expect(html).toContain('height:auto')
  })
})

describe('Callout icons — full production pipeline', () => {
  it('preserves ZWJ emoji and URL icons', () => {
    const emoji = renderMdx(dedent`
      <Note icon="👩🏽‍💻">
      Emoji icon
      </Note>
    `).html
    const custom = renderMdx(dedent`
      <Info icon="https://example.com/custom.svg">
      Custom icon
      </Info>
    `).html

    expect(emoji).toContain('👩🏽‍💻')
    expect(custom).toContain('src="https://example.com/custom.svg"')
  })

  it('uses the callout type icon when a named atlas icon is unavailable', () => {
    const { html } = renderMdx(dedent`
      <Warning icon="not-a-real-icon">
      Fallback icon
      </Warning>
    `)

    expect(html).toContain('<svg')
    expect(html).toContain('Fallback icon')
  })

  it('assigns unique ids to duplicate heading titles after re-parse', () => {
    const { html } = renderMdx('### Accounts\n\n### Accounts')
    expect(html).toMatchInlineSnapshot(`"<h3 id="accounts" class="editorial-heading editorial-h3" data-toc-heading="true" data-toc-level="3"><span>Accounts</span></h3><h3 id="accounts-1" class="editorial-heading editorial-h3" data-toc-heading="true" data-toc-level="3"><span>Accounts</span></h3>"`)
  })
})

describe('createRenderNode code block options', () => {
  const md = dedent`
    \`\`\`ts
    const a = 1
    \`\`\`
  `

  function renderWith(renderNode: ReturnType<typeof createRenderNode>) {
    const mdast = mdxParse(md)
    return renderToStaticMarkup(
      createElement(SafeMdxRenderer, {
        markdown: md,
        mdast,
        components: mdxComponents,
        renderNode,
      }),
    )
  }

  it('docs default: line-number gutter + right bleed', () => {
    const html = renderWith(renderNode)
    expect(html.includes('aria-hidden="true"')).toBe(true)
    expect(html.includes('bleed-right')).toBe(true)
  })

  it('chat options: no gutter, no bleed', () => {
    const html = renderWith(
      createRenderNode({ forceNoLineNumbers: true, defaultCodeBleed: 'none' }),
    )
    expect(html.includes('aria-hidden="true"')).toBe(false)
    expect(html.includes('bleed-right')).toBe(false)
  })

  it('forceNoLineNumbers wins over an explicit `lines` meta flag', () => {
    const withMeta = '```ts lines\nconst a = 1\n```'
    const html = renderToStaticMarkup(
      createElement(SafeMdxRenderer, {
        markdown: withMeta,
        mdast: mdxParse(withMeta),
        components: mdxComponents,
        renderNode: createRenderNode({ forceNoLineNumbers: true }),
      }),
    )
    expect(html.includes('aria-hidden="true"')).toBe(false)
  })
})
