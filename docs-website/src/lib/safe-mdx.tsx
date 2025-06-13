import { mdxComponents } from 'docs-website/src/components/mdx-components'
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { CustomTransformer, SafeMdxRenderer } from 'safe-mdx'
import { getProcessor, processMdx } from './mdx'
import { memo, use } from 'react'

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

export const MarkdownRender = memo(function MarkdownRender({
    content,
}: {
    content: string
}) {
    const processor = use(getProcessor('mdx'))
    const file = processor.processSync(content)
    const ast = file.data.ast
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
