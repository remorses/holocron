import { test } from 'vitest'
import dedent from 'dedent'
import { describe, expect } from 'vitest'
import { remark } from 'remark'
import { visit } from 'unist-util-visit'
import { Root } from 'mdast'
import { processMdxInServer } from './mdx.server'
import { SafeMdxRenderer } from 'safe-mdx'
import { renderToStaticMarkup } from 'react-dom/server'

describe('admonitions', () => {
    test('admonitions with ::: and no space', async () => {
        const markdown = dedent`
        # hello

        :::tip

        You should commit your project's file to Git.

        :::

        `

        const result = await processMdxInServer({
            markdown,
            githubPath: '',
            extension: 'mdx',
        })
        const data = result.data as { ast: Root }
        const jsx = renderToStaticMarkup(
            <SafeMdxRenderer
                mdast={data?.ast}
                components={{
                    Callout({ children, type }) {
                        return (
                            <div
                                className={`callout callout-${type ?? 'note'}`}
                            >
                                {children}
                            </div>
                        )
                    },
                }}
            />,
        )

        // Check the full output
        expect(jsx).toMatchInlineSnapshot(
            `"<div class="callout callout-info"><p>You should commit your project&#x27;s file to Git.</p></div>"`,
        )
    })
})
