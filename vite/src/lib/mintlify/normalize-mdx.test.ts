import { describe, expect, test } from 'vitest'
import { normalizeMdx } from './normalize-mdx.ts'

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
