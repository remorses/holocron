import { describe, expect, test } from 'vitest'
import { normalizeMdx, type NormalizedMdx } from './normalize-mdx.ts'
import { HolocronMdxParseError } from '../logger.ts'

/** Assert normalizeMdx succeeded and return the result. */
function expectSuccess(result: HolocronMdxParseError | NormalizedMdx): NormalizedMdx {
  expect(result).not.toBeInstanceOf(Error)
  return result as NormalizedMdx
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
