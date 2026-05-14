/**
 * End-to-end heading rendering tests.
 *
 * Traces the full pipeline: raw MDX → normalizeMdx → mdxParse → renderNode
 * to verify headings render WITHOUT a P wrapper (no <div class="editorial-prose">
 * inside the heading element).
 */

import { describe, expect, test } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { normalizeMdx } from './mintlify/normalize-mdx.ts'
import { RenderNodes } from './mdx-components-map.tsx'

function renderMdx(raw: string) {
  const result = normalizeMdx(raw)
  if (result instanceof Error) throw result
  const { content, mdast } = result
  const html = renderToStaticMarkup(
    createElement(RenderNodes, { markdown: content, nodes: mdast.children }),
  )
  return { normalized: content, mdast, html }
}

describe('heading rendering pipeline', () => {
  test('normalized MDX for ## heading', () => {
    const { normalized } = renderMdx('## Getting Started')
    expect(normalized).toMatchInlineSnapshot(`
      "## Getting Started
      "
    `)
  })

  test('mdast node type and children after parsing', () => {
    const { mdast } = renderMdx('## Getting Started')
    const node = mdast.children[0]
    if (!node || node.type !== 'heading') throw new Error('Expected first node to be a heading')
    expect({
      type: node.type,
      name: undefined,
      children: node.children?.map((c) => ({
        type: c.type,
        children: undefined,
      })),
    }).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": undefined,
            "type": "text",
          },
        ],
        "name": undefined,
        "type": "heading",
      }
    `)
  })

  test('heading renders without P wrapper', () => {
    const { html } = renderMdx('## Getting Started')
    expect(html).toMatchInlineSnapshot(`"<h1 id="getting-started" class="editorial-heading editorial-h1" data-toc-heading="true" data-toc-level="1"><span style="white-space:nowrap">Getting Started</span><span style="flex:1;height:1px;background:var(--divider)"></span></h1>"`)
  })

  test('heading with {#custom-id} renders without P wrapper', () => {
    const { normalized, html } = renderMdx('## My Section {#custom-id}')
    // Only headings with {#custom-id} get converted to <Heading> JSX
    expect(normalized).toMatchInlineSnapshot(`
      "<Heading level={2} id="custom-id">
        My Section
      </Heading>
      "
    `)
    expect(html).toContain('id="custom-id"')
    expect(html).not.toContain('editorial-prose')
    expect(html).toMatchInlineSnapshot(`"<h2 id="custom-id" class="editorial-heading editorial-h2" data-toc-heading="true" data-toc-level="2"><span style="white-space:normal">My Section</span></h2>"`)
  })

  test('multiple headings with body text', () => {
    const { html } = renderMdx('## H2 Title\n\n### H3 Title\n\nSome body text.')
    expect(html).toMatchInlineSnapshot(`"<h1 id="h2-title" class="editorial-heading editorial-h1" data-toc-heading="true" data-toc-level="1"><span style="white-space:nowrap">H2 Title</span><span style="flex:1;height:1px;background:var(--divider)"></span></h1><h2 id="h3-title" class="editorial-heading editorial-h2" data-toc-heading="true" data-toc-level="2"><span style="white-space:normal">H3 Title</span></h2><div class="editorial-prose " style="opacity:0.82">Some body text.</div>"`)
  })

  test('details summary markdown renders through mdx components', () => {
    const { html } = renderMdx(`
<details>
<summary>Use **rich** [links](https://example.com)</summary>

Content.
</details>
`)

    expect(html).toContain('<strong>rich</strong>')
    expect(html).toContain('href="https://example.com"')
    expect(html).not.toContain('Expandable</span>')
  })

  test('details body renders code blocks and tables', () => {
    const { html } = renderMdx(`
<details>
<summary>Examples</summary>

| Name | Value |
| ---- | ----- |
| foo  | bar   |

\`\`\`ts
const value = 'ok'
\`\`\`
</details>
`)

    expect(html).toContain('<table')
    expect(html).toContain('>foo</td>')
    expect(html).toContain('language-ts')
    expect(html).toContain('token keyword')
    expect(html).toContain('value')
  })
})
