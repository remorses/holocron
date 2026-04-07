import { describe, expect, test } from 'vitest'
import { normalizeMdx } from './normalize-mdx.ts'

describe('normalizeMdx', () => {
  test('rewrites markdown heading ids to explicit heading JSX', async () => {
    const result = await normalizeMdx('## My heading {#custom-id}')

    expect(result).toMatchInlineSnapshot(`
      "<h2 id=\"custom-id\">
        My heading
      </h2>
      "
    `)
  })

  test('rewrites CodeGroup into Tabs and Tab components', async () => {
    const result = await normalizeMdx(`
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
    const result = await normalizeMdx(`
\`\`\`mermaid placement=\"top-left\" actions={false}
flowchart LR
A-->B
\`\`\`
`)

    expect(result).toBe('<Mermaid\n  chart="flowchart LR\nA-->B"\n  placement="top-left"\n  actions={false}\n/>\n')
  })

  test('wraps a standalone Accordion in AccordionGroup', async () => {
    const result = await normalizeMdx(`
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
    const result = await normalizeMdx(`
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
})
