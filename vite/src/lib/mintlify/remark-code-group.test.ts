import { describe, expect, test } from 'vitest'
import { remarkCodeGroup } from './remark-code-group.ts'
import { runRemarkPlugin } from './remark-test-utils.ts'

describe('remarkCodeGroup', () => {
  test('converts a CodeGroup into Tabs and Tab nodes', () => {
    const result = runRemarkPlugin(`
<CodeGroup dropdown>

\`\`\`ts helloWorld.ts theme={null}
console.log('ts')
\`\`\`

\`\`\`js helloWorld.js
console.log('js')
\`\`\`

</CodeGroup>
`, remarkCodeGroup)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<Tabs dropdown items={[\"helloWorld.ts\", \"helloWorld.js\"]}>
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

  test('falls back to the code language when a title is missing', () => {
    const result = runRemarkPlugin(`
<CodeGroup>

\`\`\`bash
pnpm build
\`\`\`

</CodeGroup>
`, remarkCodeGroup)

    expect(result.markdown).toMatchInlineSnapshot(`
      "<Tabs items={[\"bash\"]}>
        <Tab title=\"bash\">
          \`\`\`bash
          pnpm build
          \`\`\`
        </Tab>
      </Tabs>
      "
    `)
  })
})
