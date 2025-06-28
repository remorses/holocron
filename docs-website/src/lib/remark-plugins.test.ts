import { describe, expect, test } from 'vitest'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import { remarkCodeGroup } from './remark-plugins'

describe('remarkCodeGroup', () => {
    test('transforms simple CodeGroup with two code blocks', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkCodeGroup)

        const input = `<CodeGroup>

\`\`\`js title="JavaScript"
console.log('Hello')
\`\`\`

\`\`\`ts title="TypeScript"
console.log('Hello' as string)
\`\`\`

</CodeGroup>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Tabs items={}>
            <Tab value="JavaScript">
              \`\`\`js
              console.log('Hello')
              \`\`\`
            </Tab>

            <Tab value="TypeScript">
              \`\`\`ts
              console.log('Hello' as string)
              \`\`\`
            </Tab>
          </Tabs>
          "
        `)
    })

    test('handles CodeGroup with language as fallback title', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkCodeGroup)

        const input = `<CodeGroup>

\`\`\`python
print("Hello")
\`\`\`

\`\`\`ruby
puts "Hello"
\`\`\`

</CodeGroup>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Tabs items={}>
            <Tab value="python">
              \`\`\`python
              print("Hello")
              \`\`\`
            </Tab>

            <Tab value="ruby">
              \`\`\`ruby
              puts "Hello"
              \`\`\`
            </Tab>
          </Tabs>
          "
        `)
    })

    test('handles CodeGroup with persist configuration', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkCodeGroup, {
                persist: { id: 'package-manager' }
            })

        const input = `<CodeGroup>

\`\`\`bash title="npm"
npm install package
\`\`\`

\`\`\`bash title="yarn"
yarn add package
\`\`\`

\`\`\`bash title="pnpm"
pnpm add package
\`\`\`

</CodeGroup>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Tabs groupId="package-manager" persist items={}>
            <Tab value="npm">
              \`\`\`bash
              npm install package
              \`\`\`
            </Tab>

            <Tab value="yarn">
              \`\`\`bash
              yarn add package
              \`\`\`
            </Tab>

            <Tab value="pnpm">
              \`\`\`bash
              pnpm add package
              \`\`\`
            </Tab>
          </Tabs>
          "
        `)
    })

    test('handles CodeGroup with custom Tab and Tabs names', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkCodeGroup, {
                Tab: 'CustomTab',
                Tabs: 'CustomTabs'
            })

        const input = `<CodeGroup>

\`\`\`json title="Config"
{
  "name": "test"
}
\`\`\`

\`\`\`yaml title="YAML Config"
name: test
\`\`\`

</CodeGroup>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<CustomTabs items={}>
            <CustomTab value="Config">
              \`\`\`json
              {
                "name": "test"
              }
              \`\`\`
            </CustomTab>

            <CustomTab value="YAML Config">
              \`\`\`yaml
              name: test
              \`\`\`
            </CustomTab>
          </CustomTabs>
          "
        `)
    })

    test('handles empty CodeGroup', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkCodeGroup)

        const input = `<CodeGroup>
</CodeGroup>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<CodeGroup />
          "
        `)
    })

    test('handles CodeGroup with mixed content', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkCodeGroup)

        const input = `<CodeGroup>

Some text content

\`\`\`js title="Example"
const x = 1
\`\`\`

More text

\`\`\`css title="Styles"
.class { color: red; }
\`\`\`

</CodeGroup>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Tabs items={}>
            <Tab value="Example">
              \`\`\`js
              const x = 1
              \`\`\`
            </Tab>

            <Tab value="Styles">
              \`\`\`css
              .class { color: red; }
              \`\`\`
            </Tab>
          </Tabs>
          "
        `)
    })

    test('handles code blocks without title or language', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkCodeGroup)

        const input = `<CodeGroup>

\`\`\`
plain text code
\`\`\`

\`\`\`
another block
\`\`\`

</CodeGroup>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Tabs items={}>
            <Tab value="Code">
              \`\`\`
              plain text code
              \`\`\`
            </Tab>

            <Tab value="Code">
              \`\`\`
              another block
              \`\`\`
            </Tab>
          </Tabs>
          "
        `)
    })

    test('preserves code block meta after title extraction', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkCodeGroup)

        const input = `<CodeGroup>

\`\`\`js title="Component" showLineNumbers {2-4}
function MyComponent() {
  const [state, setState] = useState(0)
  return <div>{state}</div>
}
\`\`\`

</CodeGroup>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Tabs items={}>
            <Tab value="Component">
              \`\`\`js
              function MyComponent() {
                const [state, setState] = useState(0)
                return <div>{state}</div>
              }
              \`\`\`
            </Tab>
          </Tabs>
          "
        `)
    })
})