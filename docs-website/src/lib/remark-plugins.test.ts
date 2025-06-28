import { describe, expect, test } from 'vitest'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import { remarkCodeGroup, remarkSingleAccordionItems, remarkMermaidCode } from './remark-plugins'

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
          "<Tabs items={["JavaScript", "TypeScript"]}>
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

\`\`\`python title 1
print("Hello")
\`\`\`

\`\`\`ruby title 2
puts "Hello"
\`\`\`

</CodeGroup>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Tabs items={["title 1", "title 2"]}>
            <Tab value="title 1">
              \`\`\`python
              print("Hello")
              \`\`\`
            </Tab>

            <Tab value="title 2">
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
          "<Tabs groupId="package-manager" persist items={["npm", "yarn", "pnpm"]}>
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
          "<CustomTabs items={["Config", "YAML Config"]}>
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
          "<Tabs items={["Example", "Styles"]}>
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
          "<Tabs items={["Code", "Code"]}>
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
          "<Tabs items={["Component"]}>
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

describe('remarkSingleAccordionItems', () => {
    test('wraps single Accordion in AccordionGroup', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkSingleAccordionItems)

        const input = `<Accordion title="FAQ Item">
Content inside accordion
</Accordion>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<AccordionGroup>
            <Accordion title="FAQ Item">
              Content inside accordion
            </Accordion>
          </AccordionGroup>
          "
        `)
    })

    test('does not wrap Accordion already inside AccordionGroup', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkSingleAccordionItems)

        const input = `<AccordionGroup>
<Accordion title="Item 1">
Content 1
</Accordion>
<Accordion title="Item 2">
Content 2
</Accordion>
</AccordionGroup>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<AccordionGroup>
            <Accordion title="Item 1">
              Content 1
            </Accordion>

            <Accordion title="Item 2">
              Content 2
            </Accordion>
          </AccordionGroup>
          "
        `)
    })

    test('does not wrap Accordion already inside Accordions', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkSingleAccordionItems)

        const input = `<Accordions>
<Accordion title="Item 1">
Content 1
</Accordion>
<Accordion title="Item 2">
Content 2
</Accordion>
</Accordions>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Accordions>
            <Accordion title="Item 1">
              Content 1
            </Accordion>

            <Accordion title="Item 2">
              Content 2
            </Accordion>
          </Accordions>
          "
        `)
    })

    test('wraps multiple standalone Accordions separately', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkSingleAccordionItems)

        const input = `<Accordion title="First">
First content
</Accordion>

Some text between

<Accordion title="Second">
Second content
</Accordion>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<AccordionGroup>
            <Accordion title="First">
              First content
            </Accordion>
          </AccordionGroup>

          Some text between

          <AccordionGroup>
            <Accordion title="Second">
              Second content
            </Accordion>
          </AccordionGroup>
          "
        `)
    })

    test('handles nested Accordions in MDX components', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkSingleAccordionItems)

        const input = `<Card>
<Accordion title="Nested">
Nested content
</Accordion>
</Card>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Card>
            <AccordionGroup>
              <Accordion title="Nested">
                Nested content
              </Accordion>
            </AccordionGroup>
          </Card>
          "
        `)
    })

    test('preserves Accordion attributes when wrapping', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkSingleAccordionItems)

        const input = `<Accordion title="Advanced" icon="settings" defaultOpen>
Advanced content with attributes
</Accordion>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<AccordionGroup>
            <Accordion title="Advanced" icon="settings" defaultOpen>
              Advanced content with attributes
            </Accordion>
          </AccordionGroup>
          "
        `)
    })

    test('handles empty Accordion', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkSingleAccordionItems)

        const input = `<Accordion title="Empty" />`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<AccordionGroup>
            <Accordion title="Empty" />
          </AccordionGroup>
          "
        `)
    })

    test('handles Accordion with complex children', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkSingleAccordionItems)

        const input = `<Accordion title="Complex">

## Heading inside

- List item 1
- List item 2

\`\`\`js
console.log('code')
\`\`\`

</Accordion>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<AccordionGroup>
            <Accordion title="Complex">
              ## Heading inside

              * List item 1
              * List item 2

              \`\`\`js
              console.log('code')
              \`\`\`
            </Accordion>
          </AccordionGroup>
          "
        `)
    })
})

describe('remarkMermaidCode', () => {
    test('transforms mermaid code block to Mermaid component', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkMermaidCode)

        const input = `\`\`\`mermaid
graph TD
    A[Start] --> B{Is it?}
    B -->|Yes| C[OK]
    B -->|No| D[End]
\`\`\``

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Mermaid>
            graph TD
                A[Start] --> B{Is it?}
                B -->|Yes| C[OK]
                B -->|No| D[End]
          </Mermaid>
          "
        `)
    })

    test('does not transform non-mermaid code blocks', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkMermaidCode)

        const input = `\`\`\`javascript
console.log('Not mermaid')
\`\`\`

\`\`\`python
print("Also not mermaid")
\`\`\``

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "\`\`\`javascript
          console.log('Not mermaid')
          \`\`\`

          \`\`\`python
          print("Also not mermaid")
          \`\`\`
          "
        `)
    })

    test('handles multiple mermaid blocks', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkMermaidCode)

        const input = `First diagram:

\`\`\`mermaid
flowchart LR
    A --> B
\`\`\`

Second diagram:

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
    Bob->>Alice: Hi!
\`\`\``

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "First diagram:

          <Mermaid>
            flowchart LR
                A --> B
          </Mermaid>

          Second diagram:

          <Mermaid>
            sequenceDiagram
                Alice->>Bob: Hello
                Bob->>Alice: Hi!
          </Mermaid>
          "
        `)
    })

    test('handles mermaid block with complex content', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkMermaidCode)

        const input = `\`\`\`mermaid
gitGraph
    commit
    branch develop
    checkout develop
    commit
    checkout main
    merge develop
    commit
\`\`\``

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Mermaid>
            gitGraph
                commit
                branch develop
                checkout develop
                commit
                checkout main
                merge develop
                commit
          </Mermaid>
          "
        `)
    })

    test('preserves mermaid content with special characters', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkMermaidCode)

        const input = `\`\`\`mermaid
graph TD
    A["Node with 'quotes'"] --> B["Node with \"double quotes\""]
    B --> C[Node with <brackets>]
\`\`\``

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Mermaid>
            graph TD
                A["Node with 'quotes'"] --> B["Node with "double quotes""]
                B --> C[Node with <brackets>]
          </Mermaid>
          "
        `)
    })

    test('handles empty mermaid code block', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkMermaidCode)

        const input = `\`\`\`mermaid
\`\`\``

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Mermaid>

          </Mermaid>
          "
        `)
    })

    test('works with mixed content', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkMermaidCode)

        const input = `# Documentation

Here's a regular code block:

\`\`\`js
const x = 1
\`\`\`

And here's a mermaid diagram:

\`\`\`mermaid
pie title Pets
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15
\`\`\`

More text after.`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "# Documentation

          Here's a regular code block:

          \`\`\`js
          const x = 1
          \`\`\`

          And here's a mermaid diagram:

          <Mermaid>
            pie title Pets
                "Dogs" : 386
                "Cats" : 85
                "Rats" : 15
          </Mermaid>

          More text after.
          "
        `)
    })

    test('handles mermaid in MDX components', async () => {
        const processor = remark()
            .use(remarkMdx)
            .use(remarkMermaidCode)

        const input = `<Card>

\`\`\`mermaid
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
\`\`\`

</Card>`

        const result = await processor.process(input)
        expect(String(result)).toMatchInlineSnapshot(`
          "<Card>
            <Mermaid>
              classDiagram
                  Animal <|-- Duck
                  Animal <|-- Fish
            </Mermaid>
          </Card>
          "
        `)
    })
})
