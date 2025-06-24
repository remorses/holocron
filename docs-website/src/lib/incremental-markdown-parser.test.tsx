import { describe, expect, test, beforeAll } from 'vitest'
import { getOptimizedMarkdownAst } from './incremental-markdown-parser'
import { processMdxInClient } from './markdown-runtime'
import { renderToStaticMarkup } from 'react-dom/server.edge'
import { SafeMdxRenderer } from 'safe-mdx'
import prettierHtml from 'prettier/plugins/html'
import prettier from 'prettier/standalone'

// Wait for highlighter to initialize
async function waitForHighlighter() {
    let retries = 0
    while (retries < 10) {
        try {
            await processMdxInClient({ extension: 'mdx', markdown: '# test' })
            return
        } catch (promise) {
            if (promise instanceof Promise) {
                await promise
                retries++
            } else {
                throw promise
            }
        }
    }
}

async function parseMarkdown(markdown: string) {
    const { ast } = processMdxInClient({ extension: 'mdx', markdown })
    return ast
}

// Helper to extract HTML from AST nodes
async function extractTestData(astNodes: any[]) {
    try {
        const html = renderToStaticMarkup(
            <>
                {astNodes.map((node, index) => (
                    <SafeMdxRenderer
                        key={index}
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
                        mdast={node}
                    />
                ))}
            </>
        )
        return await prettier.format(`<html>${html}</html>`, {
            parser: 'html',
            plugins: [prettierHtml],
        })
    } catch (err) {
        console.error(
            'extractTestData error for AST nodes:',
            JSON.stringify(astNodes, null, 2),
        )
        throw err
    }
}

describe('getOptimizedMarkdownAst', () => {
    beforeAll(async () => {
        await waitForHighlighter()
    })
    test('returns full AST when no previous data', async () => {
        const markdown = '# Hello\n\nWorld'
        const result = getOptimizedMarkdownAst({ markdown })
        
        expect(await extractTestData(result)).toMatchInlineSnapshot(`
          "<html>
            <p>World</p>
          </html>
          "
        `)
    })

    test('returns empty array for empty markdown', async () => {
        const result = getOptimizedMarkdownAst({ markdown: '' })
        
        expect(await extractTestData(result)).toMatchInlineSnapshot(`
          "<html></html>
          "
        `)
    })

    test('reuses entire AST when markdown is unchanged', async () => {
        const markdown = '# Hello\n\nWorld'
        const previousMarkdown = '# Hello\n\nWorld'
        const previousAst = await parseMarkdown(previousMarkdown)
        
        const result = getOptimizedMarkdownAst({
            markdown,
            previousMarkdown,
            previousAst,
        })
        
        expect(await extractTestData(result)).toMatchInlineSnapshot(`
          "<html>
            <p>World</p>
          </html>
          "
        `)
    })

    test('optimizes when only part of markdown changes', async () => {
        const previousMarkdown = '# Title\n\nFirst paragraph\n\nSecond paragraph'
        const markdown = '# Title\n\nFirst paragraph\n\nModified paragraph'
        const previousAst = await parseMarkdown(previousMarkdown)
        
        const result = getOptimizedMarkdownAst({
            markdown,
            previousMarkdown,
            previousAst,
        })
        
        expect(await extractTestData(result)).toMatchInlineSnapshot(`
          "<html>
            <p>First paragraph</p>
            <p>Modified paragraph</p>
          </html>
          "
        `)
    })

    test('handles new content addition', async () => {
        const previousMarkdown = '# Title\n\nFirst paragraph'
        const markdown = '# Title\n\nFirst paragraph\n\nNew paragraph'
        const previousAst = await parseMarkdown(previousMarkdown)
        
        const result = getOptimizedMarkdownAst({
            markdown,
            previousMarkdown,
            previousAst,
        })
        
        expect(await extractTestData(result)).toMatchInlineSnapshot(`
          "<html>
            <p>First paragraph</p>
            <p>New paragraph</p>
          </html>
          "
        `)
    })

    test('handles content removal', async () => {
        const previousMarkdown = '# Title\n\nFirst paragraph\n\nSecond paragraph'
        const markdown = '# Title\n\nFirst paragraph'
        const previousAst = await parseMarkdown(previousMarkdown)
        
        const result = getOptimizedMarkdownAst({
            markdown,
            previousMarkdown,
            previousAst,
        })
        
        expect(await extractTestData(result)).toMatchInlineSnapshot(`
          "<html>
            <p>First paragraph</p>
          </html>
          "
        `)
    })

    test('handles mixed changes', async () => {
        const previousMarkdown = '# Old Title\n\nFirst paragraph\n\nSecond paragraph'
        const markdown = '# New Title\n\nFirst paragraph\n\nModified second paragraph\n\nThird paragraph'
        const previousAst = await parseMarkdown(previousMarkdown)
        
        const result = getOptimizedMarkdownAst({
            markdown,
            previousMarkdown,
            previousAst,
        })
        
        expect(await extractTestData(result)).toMatchInlineSnapshot(`
          "<html>
            <p>First paragraph</p>
            <p>Modified second paragraph</p>
            <p>Third paragraph</p>
          </html>
          "
        `)
    })

    test('handles nodes without position info', async () => {
        const previousMarkdown = '# Title\n\nContent'
        const markdown = '# Title\n\nContent'
        const previousAst = await parseMarkdown(previousMarkdown)
        
        // Remove position info from a node to test fallback
        if (previousAst?.children?.[0]) {
            delete previousAst.children[0].position
        }
        
        const result = getOptimizedMarkdownAst({
            markdown,
            previousMarkdown,
            previousAst,
        })
        
        expect(await extractTestData(result)).toMatchInlineSnapshot(`
          "<html>
            <p>Content</p>
          </html>
          "
        `)
    })

    test('handles parsing errors gracefully', async () => {
        const previousMarkdown = '# Title\n\nContent'
        const markdown = '# Title\n\nModified content'
        const previousAst = await parseMarkdown(previousMarkdown)
        
        const result = getOptimizedMarkdownAst({
            markdown,
            previousMarkdown,
            previousAst,
        })
        
        expect(await extractTestData(result)).toMatchInlineSnapshot(`
          "<html>
            <p>Modified content</p>
          </html>
          "
        `)
    })
})