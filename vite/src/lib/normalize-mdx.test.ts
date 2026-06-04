import { describe, expect, test } from 'vitest'
import { normalizeMdx, type NormalizedMdx } from './normalize-mdx.ts'
import { HolocronMdxParseError } from './logger.ts'

/** Assert normalizeMdx succeeded and return the result. */
function expectSuccess(result: HolocronMdxParseError | NormalizedMdx): NormalizedMdx {
  expect(result).not.toBeInstanceOf(Error)
  if (result instanceof Error) throw result
  return result
}

/** Strip positions from mdast nodes for readable snapshots. */
function simplifyNode(node: any): any {
  const { position, data, ...rest } = node
  const out: any = { type: rest.type }
  if (rest.name) out.name = rest.name
  if (rest.value !== undefined) out.value = rest.value
  if (rest.depth !== undefined) out.depth = rest.depth
  if (rest.attributes?.length) {
    out.attributes = rest.attributes.map((a: any) => {
      const attr: any = { name: a.name }
      if (typeof a.value === 'string') attr.value = a.value
      else if (a.value) attr.value = '(expression)'
      return attr
    })
  }
  if (rest.children?.length) out.children = rest.children.map(simplifyNode)
  return out
}

describe('normalizeMdx error handling', () => {
  test('returns HolocronMdxParseError on malformed MDX with line info', () => {
    const result = normalizeMdx('<div>\n  <span\n</div>', '/test-page')
    expect(result).toBeInstanceOf(HolocronMdxParseError)
    if (!(result instanceof Error)) return

    expect(result.line).toBeGreaterThan(0)
    expect(result.source).toBe('/test-page')
    expect(result.reason).toBeTruthy()
    expect(result.codeFrame).toContain('<span')
  })

  test('returns HolocronMdxParseError on unclosed expression', () => {
    const result = normalizeMdx('Hello {world', '/expr-page')
    expect(result).toBeInstanceOf(HolocronMdxParseError)
    if (!(result instanceof Error)) return

    expect(result.line).toBe(1)
    expect(result.reason).toContain('closing brace')
  })

  test('works without source parameter', () => {
    const result = normalizeMdx('Hello {world')
    expect(result).toBeInstanceOf(HolocronMdxParseError)
    if (!(result instanceof Error)) return

    expect(result.source).toBeUndefined()
    expect(result.message).toContain('line 1')
  })
})

describe('normalizeMdx', () => {
  test('rewrites markdown headings to Heading JSX', () => {
    const { content: result } = expectSuccess(normalizeMdx('## My heading {#custom-id}'))

    expect(result).toMatchInlineSnapshot(`
      "<Heading level={2} id="custom-id">
        My heading
      </Heading>
      "
    `)
  })

  test('rewrites CodeGroup into Tabs and Tab components', () => {
    const { content: result } = expectSuccess(normalizeMdx(`
<CodeGroup>

\`\`\`ts helloWorld.ts
console.log('ts')
\`\`\`

\`\`\`js helloWorld.js
console.log('js')
\`\`\`

</CodeGroup>
`))

    expect(result).toMatchInlineSnapshot(`
      "<Tabs items={[\"helloWorld.ts\", \"helloWorld.js\"]}>
        <Tab title=\"helloWorld.ts\">
          \`\`\`ts
          console.log('ts')
          \`\`\`
        </Tab>

        <Tab title=\"helloWorld.js\">
          \`\`\`js
          console.log('js')
          \`\`\`
        </Tab>
      </Tabs>
      "
    `)
  })

  test('rewrites mermaid fences to Mermaid JSX', () => {
    const { content: result } = expectSuccess(normalizeMdx(`
\`\`\`mermaid placement=\"top-left\" actions={false}
flowchart LR
A-->B
\`\`\`
`))

    expect(result).toBe('<Mermaid\n  chart="flowchart LR\nA-->B"\n  placement="top-left"\n  actions={false}\n/>\n')
  })

  test('wraps a standalone Accordion in AccordionGroup', () => {
    const { content: result } = expectSuccess(normalizeMdx(`
<Accordion title=\"Hello\">
  Body
</Accordion>
`))

    expect(result).toMatchInlineSnapshot(`
      "<AccordionGroup>
        <Accordion title=\"Hello\">
          Body
        </Accordion>
      </AccordionGroup>
      "
    `)
  })

  test('rewrites html details to Expandable', () => {
    const { content: result } = expectSuccess(normalizeMdx(`
<details open>
<summary>Advanced</summary>

Hidden **content**.
</details>
`))

    expect(result).toMatchInlineSnapshot(`
      "<Expandable title={<Markdown inline children=\"Advanced\" />} defaultOpen>
        Hidden **content**.
      </Expandable>
      "
    `)
  })

  test('rewrites GitHub callout quotes to Callout JSX', () => {
    const { content: result } = expectSuccess(normalizeMdx(`
> [!IMPORTANT]
> Use **Holocron** callouts.
`))

    expect(result).toMatchInlineSnapshot(`
      "<Info title=\"Important\">
        Use **Holocron** callouts.
      </Info>
      "
    `)
  })

  test('preserves dotted Mintlify component names', () => {
    const { content: result } = expectSuccess(normalizeMdx(`
<Tree>
  <Tree.Folder name="src" defaultOpen>
    <Tree.File name="app.tsx" />
  </Tree.Folder>
</Tree>

<Color>
  <Color.Row title="Brand colors">
    <Color.Item name="Primary" value="#0969da" />
  </Color.Row>
</Color>
`))

    expect(result).toMatchInlineSnapshot(`
      "<Tree>
        <Tree.Folder name=\"src\" defaultOpen>
          <Tree.File name=\"app.tsx\" />
        </Tree.Folder>
      </Tree>

      <Color>
        <Color.Row title=\"Brand colors\">
          <Color.Item name=\"Primary\" value=\"#0969da\" />
        </Color.Row>
      </Color>
      "
    `)
  })

  test('preserves inline content inside single-line JSX flow elements', () => {
    const { content: result } = expectSuccess(normalizeMdx(
      '<Note>Use `Note` for neutral supporting information.</Note>',
    ))
    // Must stay on one line — if mdxToMarkdown splits phrasing children
    // with blank lines, safe-mdx re-parses them as separate paragraphs.
    expect(result).toMatchInlineSnapshot(`
      "<Note>Use \`Note\` for neutral supporting information.</Note>
      "
    `)
  })

  test('preserves inline content with bold and links in single-line JSX', () => {
    const { content: result } = expectSuccess(normalizeMdx(
      '<Warning>Do **not** run [this command](https://example.com) in production.</Warning>',
    ))
    expect(result).toMatchInlineSnapshot(`
      "<Warning>Do **not** run [this command](https://example.com) in production.</Warning>
      "
    `)
  })

  test('multi-line callout content stays as block paragraphs', () => {
    const { content: result } = expectSuccess(normalizeMdx(`<Callout>
some \`code\` content

works correctly
</Callout>`))
    expect(result).toMatchInlineSnapshot(`
      "<Callout>
        some \`code\` content

        works correctly
      </Callout>
      "
    `)
  })

  test('mdast: single-line Callout is promoted to flow with phrasing children', () => {
    const { mdast } = expectSuccess(normalizeMdx('<Note>Use `Note` for info.</Note>'))
    expect(mdast.children.map(simplifyNode)).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "type": "text",
              "value": "Use ",
            },
            {
              "type": "inlineCode",
              "value": "Note",
            },
            {
              "type": "text",
              "value": " for info.",
            },
          ],
          "name": "Note",
          "type": "mdxJsxFlowElement",
        },
      ]
    `)
  })

  test('mdast: Heading with custom id is a flow element', () => {
    const { mdast } = expectSuccess(normalizeMdx('## Getting Started {#getting-started}'))
    expect(mdast.children.map(simplifyNode)).toMatchInlineSnapshot(`
      [
        {
          "attributes": [
            {
              "name": "level",
              "value": "(expression)",
            },
            {
              "name": "id",
              "value": "getting-started",
            },
          ],
          "children": [
            {
              "type": "text",
              "value": "Getting Started",
            },
          ],
          "name": "Heading",
          "type": "mdxJsxFlowElement",
        },
      ]
    `)
  })

  test('mdast: multi-line Callout children are paragraphs', () => {
    const { mdast } = expectSuccess(normalizeMdx(`<Callout>
first paragraph

second paragraph
</Callout>`))
    expect(mdast.children.map(simplifyNode)).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "children": [
                {
                  "type": "text",
                  "value": "first paragraph",
                },
              ],
              "type": "paragraph",
            },
            {
              "children": [
                {
                  "type": "text",
                  "value": "second paragraph",
                },
              ],
              "type": "paragraph",
            },
          ],
          "name": "Callout",
          "type": "mdxJsxFlowElement",
        },
      ]
    `)
  })

  test('wraps request and response examples in Aside for sidebar extraction', () => {
    const { content: result } = expectSuccess(normalizeMdx(`
<RequestExample>
  Request body
</RequestExample>

<ResponseExample>
  Response body
</ResponseExample>
`))

    expect(result).toMatchInlineSnapshot(`
      "<Aside>
        <RequestExample>
          Request body
        </RequestExample>
      </Aside>

      <Aside>
        <ResponseExample>
          Response body
        </ResponseExample>
      </Aside>
      "
    `)
  })
})

describe('normalizeMdx relative link resolution', () => {
  // ── slugDir derivation from slug ──────────────────────────────────
  // slug: "index"                    → slugDir: ""
  // slug: "getting-started"          → slugDir: ""
  // slug: "docs/index"              → slugDir: "docs"
  // slug: "docs/getting-started"    → slugDir: "docs"
  // slug: "guides/setup/index"      → slugDir: "guides/setup"
  // slug: "a/b/c/page"             → slugDir: "a/b/c"

  // ── Root-level pages (slugDir = "") ───────────────────────────────

  test('root index: ./foo → /foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](./foo).',
      undefined,
      { slug: 'index' },
    ))
    expect(content).toContain('[x](/foo)')
  })

  test('root index: bare foo → /foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](foo).',
      undefined,
      { slug: 'index' },
    ))
    expect(content).toContain('[x](/foo)')
  })

  test('root index: foo/bar → /foo/bar', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](foo/bar).',
      undefined,
      { slug: 'index' },
    ))
    expect(content).toContain('[x](/foo/bar)')
  })

  test('top-level page: ./foo → /foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](./foo).',
      undefined,
      { slug: 'getting-started' },
    ))
    expect(content).toContain('[x](/foo)')
  })

  test('top-level page: ../foo clamps to /foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](../foo).',
      undefined,
      { slug: 'getting-started' },
    ))
    expect(content).toContain('[x](/foo)')
  })

  // ── One-level nesting (slugDir = "docs") ──────────────────────────

  test('docs/index: ./foo → /docs/foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](./foo).',
      undefined,
      { slug: 'docs/index' },
    ))
    expect(content).toContain('[x](/docs/foo)')
  })

  test('docs/index: bare foo → /docs/foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](foo).',
      undefined,
      { slug: 'docs/index' },
    ))
    expect(content).toContain('[x](/docs/foo)')
  })

  test('docs/index: ../foo → /foo (up one level)', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](../foo).',
      undefined,
      { slug: 'docs/index' },
    ))
    expect(content).toContain('[x](/foo)')
  })

  test('docs/getting-started: ./foo → /docs/foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](./foo).',
      undefined,
      { slug: 'docs/getting-started' },
    ))
    expect(content).toContain('[x](/docs/foo)')
  })

  test('docs/getting-started: ../foo → /foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](../foo).',
      undefined,
      { slug: 'docs/getting-started' },
    ))
    expect(content).toContain('[x](/foo)')
  })

  // ── Two-level nesting (slugDir = "guides/setup") ──────────────────

  test('guides/setup/index: ./foo → /guides/setup/foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](./foo).',
      undefined,
      { slug: 'guides/setup/index' },
    ))
    expect(content).toContain('[x](/guides/setup/foo)')
  })

  test('guides/setup/index: ../foo → /guides/foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](../foo).',
      undefined,
      { slug: 'guides/setup/index' },
    ))
    expect(content).toContain('[x](/guides/foo)')
  })

  test('guides/setup/index: ../../foo → /foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](../../foo).',
      undefined,
      { slug: 'guides/setup/index' },
    ))
    expect(content).toContain('[x](/foo)')
  })

  test('guides/setup/index: bare foo → /guides/setup/foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](foo).',
      undefined,
      { slug: 'guides/setup/index' },
    ))
    expect(content).toContain('[x](/guides/setup/foo)')
  })

  test('a/b/c/page: ./foo → /a/b/c/foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](./foo).',
      undefined,
      { slug: 'a/b/c/page' },
    ))
    expect(content).toContain('[x](/a/b/c/foo)')
  })

  test('a/b/c/page: ../../foo → /a/foo', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](../../foo).',
      undefined,
      { slug: 'a/b/c/page' },
    ))
    expect(content).toContain('[x](/a/foo)')
  })

  // ── Hash/query preservation ───────────────────────────────────────

  test('preserves hash fragment after resolution', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](./quickstart#install).',
      undefined,
      { slug: 'docs/guide/index' },
    ))
    expect(content).toContain('[x](/docs/guide/quickstart#install)')
  })

  test('preserves query string after resolution', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](../api?v=2).',
      undefined,
      { slug: 'docs/guide/index' },
    ))
    expect(content).toContain('[x](/docs/api?v=2)')
  })

  test('preserves both hash and query', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](./page?tab=1#section).',
      undefined,
      { slug: 'docs/index' },
    ))
    expect(content).toContain('[x](/docs/page?tab=1#section)')
  })

  // ── .md/.mdx extension stripping + resolution combined ───────────

  test('strips .md and resolves in one pass', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](./guide.md) and [y](../api/overview.mdx#auth).',
      undefined,
      { slug: 'docs/setup/index' },
    ))
    expect(content).toContain('[x](/docs/setup/guide)')
    expect(content).toContain('[y](/docs/api/overview#auth)')
    expect(content).not.toContain('.md')
  })

  test('strips .md from bare relative with hash', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](guide.md#install).',
      undefined,
      { slug: 'docs/index' },
    ))
    expect(content).toContain('[x](/docs/guide#install)')
  })

  // ── JSX href attributes ───────────────────────────────────────────

  test('resolves JSX href with ./prefix', () => {
    const { content } = expectSuccess(normalizeMdx(
      '<Card href="./quickstart">Go</Card>',
      undefined,
      { slug: 'docs/index' },
    ))
    expect(content).toContain('href="/docs/quickstart"')
  })

  test('resolves JSX href with bare path', () => {
    const { content } = expectSuccess(normalizeMdx(
      '<a href="quickstart">Go</a>',
      undefined,
      { slug: 'docs/index' },
    ))
    expect(content).toContain('href="/docs/quickstart"')
  })

  test('resolves JSX href with ../', () => {
    const { content } = expectSuccess(normalizeMdx(
      '<Tile href="../overview">Go</Tile>',
      undefined,
      { slug: 'docs/guides/index' },
    ))
    expect(content).toContain('href="/docs/overview"')
  })

  // ── Reference-style definitions ───────────────────────────────────

  test('resolves reference-style relative definition', () => {
    const { content } = expectSuccess(normalizeMdx(
      `See [guide][g].

[g]: ./guide.md#install`,
      undefined,
      { slug: 'docs/index' },
    ))
    expect(content).toContain('[g]: /docs/guide#install')
  })

  // ── Links that should NOT be rewritten ────────────────────────────

  test('does not touch absolute paths', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](/getting-started).',
      undefined,
      { slug: 'docs/index' },
    ))
    expect(content).toContain('[x](/getting-started)')
  })

  test('does not touch external URLs', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](https://example.com/./path).',
      undefined,
      { slug: 'docs/index' },
    ))
    expect(content).toContain('https://example.com/./path')
  })

  test('does not touch mailto links', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](mailto:test@example.com).',
      undefined,
      { slug: 'docs/index' },
    ))
    expect(content).toContain('mailto:test@example.com')
  })

  test('does not touch anchor-only links', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](#install).',
      undefined,
      { slug: 'docs/index' },
    ))
    expect(content).toContain('[x](#install)')
  })

  test('handles slug with leading slash', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](./foo).',
      undefined,
      { slug: '/docs/index' },
    ))
    expect(content).toContain('[x](/docs/foo)')
  })

  test('handles slug with trailing slash', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](./foo).',
      undefined,
      { slug: 'docs/index/' },
    ))
    expect(content).toContain('[x](/docs/foo)')
  })

  test('handles slug with both leading and trailing slashes', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [x](./foo).',
      undefined,
      { slug: '/docs/guide/' },
    ))
    expect(content).toContain('[x](/docs/foo)')
  })

  test('leaves relative links as-is when no slug provided', () => {
    const { content } = expectSuccess(normalizeMdx(
      'See [a](./intro) and [b](../parent) and [c](bare).',
    ))
    expect(content).toContain('[a](./intro)')
    expect(content).toContain('[b](../parent)')
    expect(content).toContain('[c](bare)')
  })
})

describe('normalizeMdx .md/.mdx link extension stripping', () => {
  test('strips .md extension from markdown links', () => {
    const { content } = expectSuccess(normalizeMdx(`
See [guide](/getting-started.md) and [setup](./setup.md).
`))
    expect(content).toContain('[guide](/getting-started)')
    expect(content).toContain('[setup](./setup)')
    expect(content).not.toContain('.md')
  })

  test('strips .mdx extension from markdown links', () => {
    const { content } = expectSuccess(normalizeMdx(`
See [guide](/getting-started.mdx) and [setup](./setup.mdx).
`))
    expect(content).toContain('[guide](/getting-started)')
    expect(content).toContain('[setup](./setup)')
    expect(content).not.toContain('.mdx')
  })

  test('preserves hash fragment after stripping extension', () => {
    const { content } = expectSuccess(normalizeMdx(`
See [install](/getting-started.md#installation).
`))
    expect(content).toContain('[install](/getting-started#installation)')
    expect(content).not.toContain('.md')
  })

  test('preserves query string after stripping extension', () => {
    const { content } = expectSuccess(normalizeMdx(`
See [filtered](/api.mdx?version=2).
`))
    expect(content).toContain('[filtered](/api?version=2)')
    expect(content).not.toContain('.mdx')
  })

  test('does not strip extensions from external URLs', () => {
    const { content } = expectSuccess(normalizeMdx(`
See [external](https://example.com/guide.md).
`))
    expect(content).toContain('https://example.com/guide.md')
  })

  test('does not strip non-.md extensions', () => {
    const { content } = expectSuccess(normalizeMdx(`
Download [schema](/openapi.json) and [logo](/logo.png).
`))
    expect(content).toContain('/openapi.json')
    expect(content).toContain('/logo.png')
  })

  test('strips .md from JSX href attributes', () => {
    const { content } = expectSuccess(normalizeMdx(`
<Card href="/getting-started.md">Get Started</Card>
<a href="./setup.mdx">Setup</a>
`))
    expect(content).toContain('href="/getting-started"')
    expect(content).toContain('href="./setup"')
    expect(content).not.toContain('.md')
    expect(content).not.toContain('.mdx')
  })

  test('strips .md from relative ../path links', () => {
    const { content } = expectSuccess(normalizeMdx(`
See [parent](../intro.md) and [deep](../../api/overview.mdx).
`))
    expect(content).toContain('[parent](../intro)')
    expect(content).toContain('[deep](../../api/overview)')
  })

  test('does not strip .md inside query strings or hash values', () => {
    const { content } = expectSuccess(normalizeMdx(`
See [search](/search?file=guide.md) and [section](/page#readme.md).
`))
    expect(content).toContain('/search?file=guide.md')
    expect(content).toContain('/page#readme.md')
  })

  test('strips extension from reference-style link definitions', () => {
    const { content } = expectSuccess(normalizeMdx(`
See [guide][g] and [setup][s].

[g]: /getting-started.md
[s]: ./setup.mdx#config
`))
    expect(content).toContain('[g]: /getting-started')
    expect(content).not.toContain('/getting-started.md')
    expect(content).toContain('[s]: ./setup#config')
    expect(content).not.toContain('./setup.mdx')
  })
})
