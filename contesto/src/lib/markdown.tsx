import { lazy } from 'react'
import { SafeMdxRenderer } from 'safe-mdx'

import { cn } from './cn.js'
import { renderNode } from './mdx-code-block.js'

const MarkdownRuntimeComponent = lazy(() =>
    import('./markdown-runtime.js').then((mod) => ({
        default: mod.StreamingMarkdownRuntimeComponent,
    })),
)

export type MarkdownRendererProps = {
    markdown?: string
    className?: string
    ast?: any
    isStreaming?: boolean | undefined
    components?: any
    processor?: any
}

export const Markdown = function MarkdownRender(props: MarkdownRendererProps) {
    const { ast } = props
    if (!ast) {
        return <MarkdownRuntimeComponent {...props} />
    }
    return (
        <div
            className={cn(
                'contents select-text prose dark:prose-invert',
                props.className,
            )}
        >
            <SafeMdxRenderer
                renderNode={renderNode}
                components={props.components}
                mdast={ast}
            />
        </div>
    )
}

Markdown.displayName = 'MemoizedMarkdownBlock'
