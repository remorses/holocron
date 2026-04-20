import { describe, expect, test } from 'vitest'
import { normalizeMdx } from './normalize-mdx.ts'

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

describe('normalizeMdx', () => {
  test('rewrites markdown headings to Heading JSX', async () => {
    const { content: result } = await normalizeMdx('## My heading {#custom-id}')

    expect(result).toMatchInlineSnapshot(`
      "<Heading level={2} id="custom-id">
        My heading
      </Heading>
      "
    `)
  })

  test('rewrites CodeGroup into Tabs and Tab components', async () => {
    const { content: result } = await normalizeMdx(`
<CodeGroup>

\`\`\`ts helloWorld.ts
console.log('ts')
\`\`\`

\`\`\`js helloWorld.js
console.log('js')
\`\`\`

</CodeGroup>
`)

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

  test('rewrites mermaid fences to Mermaid JSX', async () => {
    const { content: result } = await normalizeMdx(`
\`\`\`mermaid placement=\"top-left\" actions={false}
flowchart LR
A-->B
\`\`\`
`)

    expect(result).toBe('<Mermaid\n  chart="flowchart LR\nA-->B"\n  placement="top-left"\n  actions={false}\n/>\n')
  })

  test('wraps a standalone Accordion in AccordionGroup', async () => {
    const { content: result } = await normalizeMdx(`
<Accordion title=\"Hello\">
  Body
</Accordion>
`)

    expect(result).toMatchInlineSnapshot(`
      "<AccordionGroup>
        <Accordion title=\"Hello\">
          Body
        </Accordion>
      </AccordionGroup>
      "
    `)
  })

  test('preserves dotted Mintlify component names', async () => {
    const { content: result } = await normalizeMdx(`
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
`)

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

  test('preserves inline content inside single-line JSX flow elements', async () => {
    const { content: result } = await normalizeMdx(
      '<Note>Use `Note` for neutral supporting information.</Note>',
    )
    // Must stay on one line — if mdxToMarkdown splits phrasing children
    // with blank lines, safe-mdx re-parses them as separate paragraphs.
    expect(result).toMatchInlineSnapshot(`
      "<Note>Use \`Note\` for neutral supporting information.</Note>
      "
    `)
  })

  test('preserves inline content with bold and links in single-line JSX', async () => {
    const { content: result } = await normalizeMdx(
      '<Warning>Do **not** run [this command](https://example.com) in production.</Warning>',
    )
    expect(result).toMatchInlineSnapshot(`
      "<Warning>Do **not** run [this command](https://example.com) in production.</Warning>
      "
    `)
  })

  test('multi-line callout content stays as block paragraphs', async () => {
    const { content: result } = await normalizeMdx(`<Callout>
some \`code\` content

works correctly
</Callout>`)
    expect(result).toMatchInlineSnapshot(`
      "<Callout>
        some \`code\` content

        works correctly
      </Callout>
      "
    `)
  })

  test('mdast: single-line Callout is promoted to flow with phrasing children', async () => {
    const { mdast } = await normalizeMdx('<Note>Use `Note` for info.</Note>')
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

  test('mdast: Heading with custom id is a flow element', async () => {
    const { mdast } = await normalizeMdx('## Getting Started {#getting-started}')
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

  test('mdast: multi-line Callout children are paragraphs', async () => {
    const { mdast } = await normalizeMdx(`<Callout>
first paragraph

second paragraph
</Callout>`)
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

  test('wraps request and response examples in Aside for sidebar extraction', async () => {
    const { content: result } = await normalizeMdx(`
<RequestExample>
  Request body
</RequestExample>

<ResponseExample>
  Response body
</ResponseExample>
`)

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
