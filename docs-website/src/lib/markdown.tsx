import { mdxComponents } from 'docs-website/src/components/mdx-components'

import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import React, { lazy, Suspense } from 'react'
import { CustomTransformer, SafeMdxRenderer } from 'safe-mdx'
import { customTransformer } from './mdx'
import { cn } from './cn'

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
        <div className={cn('contents prose dark:prose-invert', props.className)}>
            <SafeMdxRenderer
                customTransformer={customTransformer}
                components={mdxComponents}
                mdast={ast}
            />
        </div>
    )
}

Markdown.displayName = 'MemoizedMarkdownBlock'
