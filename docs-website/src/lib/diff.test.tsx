import { test, describe, expect } from 'vitest'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import { markRemarkAstAdditions } from './diff'
import type { Root } from 'mdast'
import { SafeMdxRenderer } from 'safe-mdx'
import { customTransformer } from './mdx'
import { mdxComponents } from '../components/mdx-components'
import { renderToStaticMarkup } from 'react-dom/server.edge'

const processor = remark().use(remarkMdx)

function parseWithPositions(markdown: string): Root {
    return processor.parse(markdown)
}

import prettier from 'prettier/standalone'
import prettierHtml from 'prettier/plugins/html'

// Helper to extract relevant test data from AST
async function extractTestData(ast: Root) {
    try {
        const html = renderToStaticMarkup(<SafeMdxRenderer mdast={ast} />)
        return await prettier.format(`<html>${html}</html>`, {
            parser: 'html',
            plugins: [prettierHtml],
        })
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('extractTestData error for AST:', JSON.stringify(ast, null, 2))
        throw err
    }
}

describe('markRemarkAstAdditions', () => {
    test('detects no changes when trees are identical', async () => {
        const old = parseWithPositions('# Hello\n\nWorld')
        const new_ = parseWithPositions('# Hello\n\nWorld')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <h1>Hello</h1>
            <p>World</p>
          </html>
          "
        `)
    })

    test('detects text content changes with inline diff', async () => {
        const old = parseWithPositions('Hello world')
        const new_ = parseWithPositions('Hello universe')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`Promise {}`)

        // Also verify the AST structure has the expected markers
        expect(new_.children[0]).toHaveProperty(
            'data.hProperties.data-added',
            true,
        )
    })

    test('detects heading level changes', async () => {
        const old = parseWithPositions('# Title')
        const new_ = parseWithPositions('## Title')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <h2 data-added="true"><span data-added="true">Title</span></h2>
          </html>
          "
        `)
    })

    test('detects new paragraphs', async () => {
        const old = parseWithPositions('First paragraph')
        const new_ = parseWithPositions('First paragraph\n\nSecond paragraph')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p>First paragraph</p>
            <p data-added="true"><span data-added="true">Second paragraph</span></p>
          </html>
          "
        `)
    })

    test('detects link URL changes', async () => {
        const old = parseWithPositions('[Link](https://old.com)')
        const new_ = parseWithPositions('[Link](https://new.com)')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p><a href="https://old.com" title="">Link</a></p>
          </html>
          "
        `)
    })

    test('detects link title changes', async () => {
        const old = parseWithPositions(
            '[Link](https://example.com "Old Title")',
        )
        const new_ = parseWithPositions(
            '[Link](https://example.com "New Title")',
        )

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p><a href="https://example.com" title="Old Title">Link</a></p>
          </html>
          "
        `)
    })

    test('detects list type changes', async () => {
        const old = parseWithPositions('- Item 1\n- Item 2')
        const new_ = parseWithPositions('1. Item 1\n2. Item 2')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <ol start="1" data-added="true">
              <li>
                <p data-added="true"><span data-added="true">Item 1</span></p>
              </li>
              <li>
                <p data-added="true"><span data-added="true">Item 2</span></p>
              </li>
            </ol>
          </html>
          "
        `)
    })

    test('detects code block language changes', async () => {
        const old = parseWithPositions('```js\nconsole.log("hello")\n```')
        const new_ = parseWithPositions('```ts\nconsole.log("hello")\n```')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <pre data-added="true"><code>console.log(&quot;hello&quot;)</code></pre>
          </html>
          "
        `)
    })

    test('detects image changes', async () => {
        const old = parseWithPositions('![Alt](old.jpg)')
        const new_ = parseWithPositions('![New Alt](new.jpg)')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <link rel="preload" as="image" href="old.jpg" />
            <p><img src="old.jpg" alt="Alt" title="" /></p>
          </html>
          "
        `)
    })

    test('detects emphasis changes', async () => {
        const old = parseWithPositions('*italic*')
        const new_ = parseWithPositions('**bold**')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p><em>italic</em></p>
          </html>
          "
        `)
    })

    test('detects MDX component name changes', async () => {
        const old = parseWithPositions('<Card title="Hello" />')
        const new_ = parseWithPositions('<Alert title="Hello" />')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html></html>
          "
        `)
    })

    test('detects MDX component attribute changes', async () => {
        const old = parseWithPositions('<Card title="Old" />')
        const new_ = parseWithPositions('<Card title="New" />')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html></html>
          "
        `)
    })

    test('detects table structure changes', async () => {
        const old = parseWithPositions('| A | B |\n|---|---|\n| 1 | 2 |')
        const new_ = parseWithPositions(
            '| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |',
        )

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`Promise {}`)
    })

    test('preserves React identity for unchanged nodes', async () => {
        const old = parseWithPositions(
            '# Unchanged\n\nSame text\n\n## Also unchanged',
        )
        const new_ = parseWithPositions(
            '# Unchanged\n\nSame text\n\n## Also unchanged\n\nNew paragraph',
        )

        // Store references to original nodes
        const oldHeading = old.children[0]
        const oldParagraph = old.children[1]
        const oldSecondHeading = old.children[2]

        markRemarkAstAdditions(old, new_)

        // Check that unchanged nodes preserve identity
        expect(new_.children[0]).toBe(oldHeading)
        expect(new_.children[1]).toBe(oldParagraph)
        expect(new_.children[2]).toBe(oldSecondHeading)

        // Check that new node is different
        expect(new_.children[3]).not.toBe(undefined)

        expect({
            unchangedNodesPreserved:
                new_.children[0] === oldHeading &&
                new_.children[1] === oldParagraph &&
                new_.children[2] === oldSecondHeading,
            newNodeAdded: new_.children.length === 4,
        }).toMatchInlineSnapshot(`
          {
            "newNodeAdded": true,
            "unchangedNodesPreserved": true,
          }
        `)
    })

    test('handles complex nested changes', async () => {
        const old = parseWithPositions(`
# Title

This is a paragraph with [old link](https://old.com).

- List item 1
- List item 2

\`\`\`js
const old = "code"
\`\`\`
        `)

        const new_ = parseWithPositions(`
# Title

This is a paragraph with [new link](https://new.com) and **bold text**.

- List item 1
- List item 2
- List item 3

\`\`\`ts
const new = "code"
\`\`\`
        `)

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`Promise {}`)
    })

    test('handles blockquote changes', async () => {
        const old = parseWithPositions('> Old quote')
        const new_ = parseWithPositions('> New quote')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <blockquote><p>Old quote</p></blockquote>
          </html>
          "
        `)
    })

    test('handles inline code changes', async () => {
        const old = parseWithPositions('Use `oldFunction()` here')
        const new_ = parseWithPositions('Use `newFunction()` here')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p>Use <code>oldFunction()</code> here</p>
          </html>
          "
        `)
    })

    test('handles thematic break additions', async () => {
        const old = parseWithPositions('Paragraph one\n\nParagraph two')
        const new_ = parseWithPositions('Paragraph one\n\n---\n\nParagraph two')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p>Paragraph one</p>
            <hr data-added="true" />
            <p data-added="true"><span data-added="true">Paragraph two</span></p>
          </html>
          "
        `)
    })

    test('handles list item checkbox changes', async () => {
        const old = parseWithPositions('- [ ] Unchecked\n- [x] Checked')
        const new_ = parseWithPositions('- [x] Checked\n- [ ] Unchecked')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <ul>
              <li><p>[ ] Unchecked</p></li>
              <li><p>[x] Checked</p></li>
            </ul>
          </html>
          "
        `)
    })

    test('handles partial text changes with highlighting', async () => {
        const old = parseWithPositions('The quick brown fox jumps')
        const new_ = parseWithPositions('The quick red fox leaps')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`Promise {}`)
    })

    test('handles MDX expression changes', async () => {
        const old = parseWithPositions('{oldVariable}')
        const new_ = parseWithPositions('{newVariable}')

        markRemarkAstAdditions(old, new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html></html>
          "
        `)
    })
})
