import { mdxComponents } from 'docs-website/src/components/mdx-components'

import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { memo, Suspense, useId, useMemo } from 'react'
import { CustomTransformer, SafeMdxRenderer } from 'safe-mdx'
import { createHighlighter, Highlighter } from 'shiki'
import { getProcessor } from './mdx'
import { lazy } from 'react'

const MarkdownRuntimeComponent = lazy(() =>
    import('./markdown-runtime').then((mod) => ({
        default: mod.MarkdownRuntimeComponent,
    })),
)

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

export type MarkdownRendererProps = {
    markdown?: string
    ast?: any
    id?: any
    extension?: any
}

export const Markdown = memo(function MarkdownRender(
    props: MarkdownRendererProps,
) {
    const { markdown, ast,  } = props
    if (!ast) {
        return <MarkdownRuntimeComponent {...props} />
    }
    return <MarkdownAstRenderer ast={ast} />
})

export const MarkdownAstRenderer = ({ ast }) => {
    return (
        <SafeMdxRenderer
            customTransformer={customTransformer}
            components={mdxComponents}
            mdast={ast}
        />
    )
}

Markdown.displayName = 'MemoizedMarkdownBlock'

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
