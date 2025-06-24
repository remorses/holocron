import { toMarkdown } from 'mdast-util-to-markdown'
import { describe, expect, test } from 'vitest'

import { diffWords } from 'diff'
import {
    IncrementalParsingProps,
    parseMarkdownIncremental,
    SegmentEntry,
} from './incremental-markdown-parser'

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

function simulateStreaming(text: string): string[] {
    const words = text.split(' ')
    const result: string[] = []
    for (let i = 1; i <= words.length; i++) {
        result.push(words.slice(0, i).join(' '))
    }
    return result
}

describe('getOptimizedMarkdownAst', () => {
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


`.trim()

    // Loop over streaming chunks and parse incrementally
    const streamingChunks = simulateStreaming(markdown)
    streamingChunks.forEach((chunk, idx) => {
        test(`incremental parsing at chunk ${idx + 1}`, async () => {
            const ast = await parseAndWaitForHighlighter({
                markdown: chunk,
                cache,
                extension,
            })

            const md = toMarkdown(ast)
            // const changes = diffWords(chunk, md)
            // const additions = changes.filter((change) => change.added)
            expect(md).toMatchSnapshot()
        })
    })

    test('returns full AST when no previous data', async () => {
        const ast = await parseAndWaitForHighlighter({
            markdown,
            cache,
            extension,
        })

        expect(toMarkdown(ast)).toMatchInlineSnapshot(`
          "This is a sample markdown file to showcase various features.

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
          "
        `)
    })
})
