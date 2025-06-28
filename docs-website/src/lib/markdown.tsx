import { mdxComponents } from 'docs-website/src/components/mdx-components'

import { lazy } from 'react'
import { SafeMdxRenderer } from 'safe-mdx'

import { cn } from './cn'
import { renderNode } from './mdx-code-block'

const MarkdownRuntimeComponent = lazy(() =>
    import('./markdown-runtime').then((mod) => ({
        default: mod.StreamingMarkdownRuntimeComponent,
    })),
)

export type MarkdownRendererProps = {
    markdown?: string
    className?: string
    ast?: any
    isStreaming?: boolean | undefined
    extension?: any
    previousMarkdown?: any
    previousAst?: any
    addDiffAttributes?: any
}

export const Markdown = function MarkdownRender(props: MarkdownRendererProps) {
    const { ast } = props
    if (!ast) {
        return <MarkdownRuntimeComponent {...props} />
    }
    return (
        <div
            className={cn('contents prose dark:prose-invert', props.className)}
        >
            <SafeMdxRenderer
                renderNode={renderNode}
                components={mdxComponents}
                mdast={ast}
            />
        </div>
    )
}

Markdown.displayName = 'MemoizedMarkdownBlock'
