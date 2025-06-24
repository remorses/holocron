import type { Root } from 'mdast'
import { renderToStaticMarkup } from 'react-dom/server.edge'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import { SafeMdxRenderer } from 'safe-mdx'
import { describe, expect, test } from 'vitest'
import { markAddedNodes } from './diff'

async function parseWithPositions(markdown: string) {
    const res = await processMdxInServer({ markdown, extension: 'mdx' })
    return res.data?.ast
}

function diffMarkdowns(oldMarkdown, newMarkdown, ast) {
    const diffs: Change[] = diffWords(oldMarkdown, newMarkdown)
    return markAddedNodes(diffs, ast)
}

import prettierHtml from 'prettier/plugins/html'
import prettier from 'prettier/standalone'
import { processMdxInServer } from './mdx.server'
import { Change, diffWords } from 'diff'

// Helper to extract relevant test data from AST
async function extractTestData(ast: Root) {
    try {
        const html = renderToStaticMarkup(
            <SafeMdxRenderer
                components={{
                    Card: ({ children, ...props }: any) => (
                        <div role='card' {...props}>
                            {children}
                        </div>
                    ),
                    Alert: ({ children, ...props }: any) => (
                        <div role='alert' {...props}>
                            {children}
                        </div>
                    ),
                }}
                mdast={ast}
            />,
        )
        return await prettier.format(`<html>${html}</html>`, {
            parser: 'html',
            plugins: [prettierHtml],
        })
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(
            'extractTestData error for AST:',
            JSON.stringify(ast, null, 2),
        )
        throw err
    }
}

describe('markRemarkAstAdditions', () => {
    test('detects no changes when trees are identical', async () => {
        const old = await parseWithPositions('# Hello\n\nWorld')
        const new_ = await parseWithPositions('# Hello\n\nWorld')

        diffMarkdowns('# Hello\n\nWorld', '# Hello\n\nWorld', new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p>World</p>
          </html>
          "
        `)
    })

    test('detects text content changes with inline diff', async () => {
        const old = await parseWithPositions('Hello world')
        const new_ = await parseWithPositions('Hello universe')

        diffMarkdowns('Hello world', 'Hello universe', new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p>Hello universe</p>
          </html>
          "
        `)
    })

    test('detects heading level changes', async () => {
        const old = await parseWithPositions('# Title')
        const new_ = await parseWithPositions('## Title')

        diffMarkdowns('# Title', '## Title', new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <h2 id="title">Title</h2>
          </html>
          "
        `)
    })

    test('detects new paragraphs', async () => {
        const old = await parseWithPositions('First paragraph')
        const new_ = await parseWithPositions(
            'First paragraph\n\nSecond paragraph',
        )

        diffMarkdowns(
            'First paragraph',
            'First paragraph\n\nSecond paragraph',
            new_,
        )

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p>First paragraph</p>
            <p>Second paragraph</p>
          </html>
          "
        `)
    })

    test('detects link URL changes', async () => {
        const old = await parseWithPositions('[Link](https://old.com)')
        const new_ = await parseWithPositions('[Link](https://new.com)')

        diffMarkdowns(
            '[Link](https://old.com)',
            '[Link](https://new.com)',
            new_,
        )

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p><a href="https://new.com" title="">Link</a></p>
          </html>
          "
        `)
    })

    test('detects link title changes', async () => {
        const old = await parseWithPositions(
            '[Link](https://example.com "Old Title")',
        )
        const new_ = await parseWithPositions(
            '[Link](https://example.com "New Title")',
        )

        diffMarkdowns(
            '[Link](https://example.com "Old Title")',
            '[Link](https://example.com "New Title")',
            new_,
        )

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p><a href="https://example.com" title="New Title">Link</a></p>
          </html>
          "
        `)
    })

    test('detects list type changes', async () => {
        const old = await parseWithPositions('- Item 1\n- Item 2')
        const new_ = await parseWithPositions('1. Item 1\n2. Item 2')

        diffMarkdowns('- Item 1\n- Item 2', '1. Item 1\n2. Item 2', new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <ol start="1">
              <li><p>Item 1</p></li>
              <li><p>Item 2</p></li>
            </ol>
          </html>
          "
        `)
    })

    test('detects code block language changes', async () => {
        const old = await parseWithPositions('```js\nconsole.log("hello")\n```')
        const new_ = await parseWithPositions(
            '```ts\nconsole.log("hello")\n```',
        )

        diffMarkdowns(
            '```js\nconsole.log("hello")\n```',
            '```ts\nconsole.log("hello")\n```',
            new_,
        )

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <pre><code>console.log(&quot;hello&quot;)</code></pre>
          </html>
          "
        `)
    })

    test('detects image changes', async () => {
        const old = await parseWithPositions('![Alt](old.jpg)')
        const new_ = await parseWithPositions('![New Alt](new.jpg)')

        diffMarkdowns('![Alt](old.jpg)', '![New Alt](new.jpg)', new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <link rel="preload" as="image" href="new.jpg" />
            <p><img src="new.jpg" alt="New Alt" title="" /></p>
          </html>
          "
        `)
    })

    test('detects emphasis changes', async () => {
        const old = await parseWithPositions('*italic*')
        const new_ = await parseWithPositions('**bold**')

        diffMarkdowns('*italic*', '**bold**', new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p><strong>bold</strong></p>
          </html>
          "
        `)
    })

    test('detects MDX component name changes', async () => {
        const old = await parseWithPositions('<Card title="Hello" />')
        const new_ = await parseWithPositions('<Alert title="Hello" />')

        diffMarkdowns('<Card title="Hello" />', '<Alert title="Hello" />', new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <div role="alert" title="Hello"></div>
          </html>
          "
        `)
    })

    test('detects MDX component attribute changes', async () => {
        const old = await parseWithPositions('<Card title="Old" />')
        const new_ = await parseWithPositions('<Card title="New" />')

        diffMarkdowns('<Card title="Old" />', '<Card title="New" />', new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <div role="card" title="New"></div>
          </html>
          "
        `)
    })

    test('detects table structure changes', async () => {
        const old = await parseWithPositions('| A | B |\n|---|---|\n| 1 | 2 |')
        const new_ = await parseWithPositions(
            '| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |',
        )

        diffMarkdowns(
            '| A | B |\n|---|---|\n| 1 | 2 |',
            '| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |',
            new_,
        )

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <table>
              <thead>
                <tr class="">
                  <td class="">A</td>
                  <td class="">B</td>
                  <td class="">C</td>
                </tr>
              </thead>
              <tbody>
                <tr class="">
                  <td class="">1</td>
                  <td class="">2</td>
                  <td class="">3</td>
                </tr>
              </tbody>
            </table>
          </html>
          "
        `)
    })

    test.todo('preserves React identity for unchanged nodes', async () => {
        const old = await parseWithPositions(
            '# Unchanged\n\nSame text\n\n## Also unchanged',
        )
        const new_ = await parseWithPositions(
            '# Unchanged\n\nSame text\n\n## Also unchanged\n\nNew paragraph',
        )

        // Store references to original nodes
        const oldHeading = old.children[0]
        const oldParagraph = old.children[1]
        const oldSecondHeading = old.children[2]

        diffMarkdowns(
            '# Unchanged\n\nSame text\n\n## Also unchanged',
            '# Unchanged\n\nSame text\n\n## Also unchanged\n\nNew paragraph',
            new_,
        )

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
        const old = await parseWithPositions(`
# Title

This is a paragraph with [old link](https://old.com).

- List item 1
- List item 2

\`\`\`js
const old = "code"
\`\`\`
        `)

        const new_ = await parseWithPositions(`
# Title

This is a paragraph with [new link](https://new.com) and **bold text**.

- List item 1
- List item 2
- List item 3

\`\`\`ts
const new = "code"
\`\`\`
        `)

        diffMarkdowns(
            `
# Title

This is a paragraph with [old link](https://old.com).

- List item 1
- List item 2

\`\`\`js
const old = "code"
\`\`\`
        `,
            `
# Title

This is a paragraph with [new link](https://new.com) and **bold text**.

- List item 1
- List item 2
- List item 3

\`\`\`ts
const new = "code"
\`\`\`
        `,
            new_,
        )

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p>
              This is a paragraph with <a href="https://new.com" title="">new link</a> and
              <strong>bold text</strong>.
            </p>
            <ul>
              <li><p>List item 1</p></li>
              <li><p>List item 2</p></li>
              <li><p>List item 3</p></li>
            </ul>
            <pre><code>const new = &quot;code&quot;</code></pre>
          </html>
          "
        `)
    })

    test('handles blockquote changes', async () => {
        const old = await parseWithPositions('> Old quote')
        const new_ = await parseWithPositions('> New quote')

        diffMarkdowns('> Old quote', '> New quote', new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <blockquote><p>New quote</p></blockquote>
          </html>
          "
        `)
    })

    test('handles inline code changes', async () => {
        const old = await parseWithPositions('Use `oldFunction()` here')
        const new_ = await parseWithPositions('Use `newFunction()` here')

        diffMarkdowns(
            'Use `oldFunction()` here',
            'Use `newFunction()` here',
            new_,
        )

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p>Use <code>newFunction()</code> here</p>
          </html>
          "
        `)
    })

    test('handles thematic break additions', async () => {
        const old = await parseWithPositions('Paragraph one\n\nParagraph two')
        const new_ = await parseWithPositions(
            'Paragraph one\n\n---\n\nParagraph two',
        )

        diffMarkdowns(
            'Paragraph one\n\nParagraph two',
            'Paragraph one\n\n---\n\nParagraph two',
            new_,
        )

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p>Paragraph one</p>
            <hr />
            <p>Paragraph two</p>
          </html>
          "
        `)
    })

    test('handles list item checkbox changes', async () => {
        const old = await parseWithPositions(
            'todos\n\n- [ ] Unchecked\n- [x] Checked',
        )
        const new_ = await parseWithPositions(
            'todos\n\n- [x] Checked\n- [ ] Unchecked',
        )

        diffMarkdowns(
            'todos\n\n- [ ] Unchecked\n- [x] Checked',
            'todos\n\n- [x] Checked\n- [ ] Unchecked',
            new_,
        )

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p>todos</p>
            <ul>
              <li data-checked="true"><p>Checked</p></li>
              <li data-checked="false"><p>Unchecked</p></li>
            </ul>
          </html>
          "
        `)
    })

    test('handles partial text changes with highlighting', async () => {
        const old = await parseWithPositions('The quick brown fox jumps')
        const new_ = await parseWithPositions('The quick red fox leaps')

        diffMarkdowns(
            'The quick brown fox jumps',
            'The quick red fox leaps',
            new_,
        )

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html>
            <p>The quick red fox leaps</p>
          </html>
          "
        `)
    })

    test('handles MDX expression changes', async () => {
        const old = await parseWithPositions('{oldVariable}')
        const new_ = await parseWithPositions('{newVariable}')

        diffMarkdowns('{oldVariable}', '{newVariable}', new_)

        expect(await extractTestData(new_)).toMatchInlineSnapshot(`
          "<html></html>
          "
        `)
    })
})
