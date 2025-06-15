import { mdxComponents } from 'docs-website/src/components/mdx-components'
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { memo } from 'react'
import { CustomTransformer, SafeMdxRenderer } from 'safe-mdx'
import { createHighlighter, Highlighter } from 'shiki'
import { getProcessor } from './mdx'

const customTransformer: CustomTransformer = (node, transform) => {
    if (node.type === 'code') {
        const language = node.lang || ''
        const meta = parseMetaString(node.meta)
        // the mdast plugin replaces the code string with shiki html
        const html = node.data?.['html'] || node.value || ''
        return (
            <CodeBlock {...meta} lang={language}>
                <Pre>
                    <div
                        className='content'
                        dangerouslySetInnerHTML={{ __html: html }}
                    ></div>
                </Pre>
            </CodeBlock>
        )
    }
}

const onMissingLanguage = (highlighter: Highlighter, language) => {
    throw highlighter.loadLanguage(language)
}

function setHighlighter() {
    if (highlighter) return
    createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: ['text'],
    }).then((x) => {
        if (highlighter) return
        highlighter = x
    })
}

let highlighter: Highlighter | undefined
setHighlighter()

export const MarkdownRender = memo(function MarkdownRender({
    content,
    ast,
}: {
    content?: string
    ast?: any
}) {
    if (!ast) {
        if (!highlighter) {
            throw setHighlighter()
        }
        const processor = getProcessor({
            extension: 'mdx',
            onMissingLanguage,
            highlighter,
        })
        const file = processor.processSync(content)
        ast = file.data.ast
    }
    return (
        <SafeMdxRenderer
            customTransformer={customTransformer}
            components={mdxComponents}
            mdast={ast}
        />
    )
})

MarkdownRender.displayName = 'MemoizedMarkdownBlock'

function parseMetaString(
    meta: string | null | undefined,
): Record<string, string> {
    if (!meta) {
        return {}
    }

    const map: Record<string, string> = {}
    const metaRegex = /(\w+)="([^"]+)"/g
    let match

    while ((match = metaRegex.exec(meta)) !== null) {
        const [, name, value] = match
        map[name] = value
    }

    return map
}
