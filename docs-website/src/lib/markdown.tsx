import { mdxComponents } from 'docs-website/src/components/mdx-components'

import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import React, { lazy, Suspense } from 'react'
import { CustomTransformer, SafeMdxRenderer } from 'safe-mdx'
import { customTransformer } from './mdx'

const MarkdownRuntimeComponent = lazy(() =>
    import('./markdown-runtime').then((mod) => ({
        default: mod.StreamingMarkdownRuntimeComponent,
    })),
)

export type MarkdownRendererProps = {
    markdown?: string
    className?: string
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
    return (
        <div className={props.className}>
            <SafeMdxRenderer
                customTransformer={customTransformer}
                components={mdxComponents}
                mdast={ast}
            />
        </div>
    )
}

Markdown.displayName = 'MemoizedMarkdownBlock'


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
