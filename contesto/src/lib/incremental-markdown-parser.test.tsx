import { describe, expect, test } from 'vitest'
import { SafeMdxRenderer } from 'safe-mdx'
import { renderToStaticMarkup } from 'react-dom/server'
import { simplerProcessor } from './simple-processor.js'

import {
    IncrementalParsingProps,
    parseMarkdownIncremental,
    SegmentEntry,
} from './incremental-markdown-parser.js'
import React from 'react'

// Wait for highlighter to initialize
async function parseAndWaitForHighlighter(props: IncrementalParsingProps) {
    let retries = 0
    while (retries < 10) {
        try {
            return parseMarkdownIncremental({
                ...props,
            })
        } catch (promise) {
            if (promise instanceof Promise) {
                await promise
                retries++
            } else {
                throw promise
            }
        }
    }
    throw new Error('Highlighter initialization timed out')
}

function toMarkdown(ast: any): string {
    const file = simplerProcessor.stringify(ast)
    return String(file)
}

function simulateStreaming(text: string): string[] {
    const words = text.split(' ')
    const result: string[] = []
    for (let i = 1; i <= words.length; i++) {
        result.push(words.slice(0, i).join(' '))
    }
    return result
}

describe('incremental parse', () => {
    const cache = new Map<number, SegmentEntry>()
    const extension = 'mdx'
    const markdown = `
# Welcome to the Example Document

This is a sample markdown file to showcase various features.

## Features

* Easy formatting
* Lists
* **Bold text**
* [Links](https://example.com)

> "Markdown makes documentation easy!"

\`\`\`js
console.log('Hello, world!');
\`\`\`

1. one
2. two
3. three

this is another paragraph

<Cards>
  <Card>
  some text
  </Card>
</Cards>


`.trim()

    // Loop over streaming chunks and parse incrementally
    const streamingChunks = simulateStreaming(markdown)
    streamingChunks.forEach((chunk, idx) => {
        test(`incremental parsing at chunk ${idx + 1}`, async () => {
            try {
                const ast = await parseAndWaitForHighlighter({
                    markdown: chunk,
                    cache,
                })
                const md = toMarkdown(ast)
                // const changes = diffWords(chunk, md)
                // const additions = changes.filter((change) => change.added)
                expect(md).toMatchSnapshot()
            } catch (error) {
                expect(error.message).toMatchSnapshot()
            }
        })
        test(`incremental parsing and jsx at chunk ${idx + 1}`, async () => {
            try {
                const ast = await parseAndWaitForHighlighter({
                    markdown: chunk,
                    cache,
                })
                const jsx = renderToStaticMarkup(
                    <SafeMdxRenderer

                        mdast={ast}
                        components={{
                            Cards({ children }) {
                                return React.createElement(
                                    'cards',
                                    null,
                                    children,
                                )
                            },
                            Card({ children }) {
                                return React.createElement(
                                    'card',
                                    null,
                                    children,
                                )
                            },
                        }}
                    />,
                )
                // const changes = diffWords(chunk, md)
                // const additions = changes.filter((change) => change.added)
                expect(jsx).toMatchSnapshot()
            } catch (error) {
                expect(error.message).toMatchSnapshot()
            }
        })
    })

    test('returns full AST when no previous data', async () => {
        const ast = await parseAndWaitForHighlighter({
            markdown,
            cache,
        })

        expect(toMarkdown(ast)).toMatchInlineSnapshot(`
          "# Welcome to the Example Document

          This is a sample markdown file to showcase various features.

          ## Features

          * Easy formatting
          * Lists
          * **Bold text**
          * [Links](https://example.com)

          > "Markdown makes documentation easy!"

          \`\`\`js
          console.log('Hello, world!');
          \`\`\`

          1. one
          2. two
          3. three

          this is another paragraph

          <Cards>
            <Card>
              some text
            </Card>
          </Cards>
          "
        `)
    })
})
