import { mdxComponents } from 'docs-website/src/components/mdx-components'

import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { memo, Suspense, useId, useMemo } from 'react'
import { CustomTransformer, SafeMdxRenderer } from 'safe-mdx'
import { createHighlighter, Highlighter } from 'shiki'
import { getProcessor } from './mdx'
import { lazy } from 'react'
import React from 'react'

const MarkdownRuntimeComponent = lazy(() =>
    import('./markdown-runtime').then((mod) => ({
        default: mod.StreamingMarkdownRuntimeComponent,
    })),
)

const customTransformer: CustomTransformer = (node, transform) => {
    if (node.type === 'code') {
        const language = node.lang || ''
        const meta = parseMetaString(node.meta)
        // the mdast plugin replaces the code string with shiki html
        const html = node.data?.['html'] || node.value || ''
        return (
            <CodeBlock {...node.data?.hProperties} {...meta} lang={language}>
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
    isStreaming: boolean | undefined
    extension?: any
}

export const Markdown = function MarkdownRender(props: MarkdownRendererProps) {
    const { markdown, ast } = props
    if (!ast) {
        return (
            <Suspense fallback={null}>
                <MarkdownRuntimeComponent {...props} />
            </Suspense>
        )
    }
    return <MarkdownAstRenderer ast={ast} />
}

export const MarkdownAstRenderer = memo(({ ast }: { ast: any }) => {
    return (
        <SafeMdxRenderer
            customTransformer={customTransformer}
            components={mdxComponents}
            mdast={ast}
        />
    )
})

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

export class PreserveUIBoundary extends React.Component<
    { children: React.ReactNode; enabled?: boolean },
    { hasError: boolean; lastGoodChildren: React.ReactNode | null }
> {
    state = { hasError: false, lastGoodChildren: null }

    // 1️⃣ Capture last good children whenever props change and no error yet
    static getDerivedStateFromProps(
        props: Readonly<{ children: React.ReactNode; enabled?: boolean }>,
        state: Readonly<{ hasError: boolean }>,
    ) {
        if (!state.hasError) {
            return { lastGoodChildren: props.children }
        }
        return null
    }

    // 2️⃣ Trip the error flag
    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(err: unknown, info: unknown) {
        // optional: log
        console.error('Render error caught by boundary:', err, info)
    }

    reset = () => this.setState({ hasError: false })

    render() {
        const { enabled = true, children } = this.props
        if (!enabled) {
            return children
        }
        if (this.state.hasError && this.state.lastGoodChildren) {
            return <>{this.state.lastGoodChildren}</> // show previous UI
        }
        return children // normal path
    }
}
