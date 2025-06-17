import { useId, useMemo, Suspense, memo } from 'react'
import { marked } from 'marked'

import {
    MarkdownAstRenderer,
    Markdown,
    MarkdownRendererProps,
} from './safe-mdx'
import { createHighlighter, Highlighter } from 'shiki'
import { getProcessor } from './mdx'
import React from 'react'

export function MarkdownRuntimeComponent({
    markdown,
    extension = 'mdx',
    id,
}: MarkdownRendererProps) {
    const generatedId = useId()
    const blockId = id ?? generatedId
    const blocks = useMemo(() => {
        try {
            return marked.lexer(markdown || '')
        } catch (err) {
            console.error('Markdown lexing error:', err)
            return []
        }
    }, [markdown])

    return (
        <Suspense>
            {blocks.map((block, index) => {
                if (block.type === 'space') return block.raw
                return (
                    <PreserveUIBoundary>
                        <MarkdownRuntimeItem
                            key={index}
                            extension={extension}
                            markdown={block.raw}
                        />
                    </PreserveUIBoundary>
                )
            })}
        </Suspense>
    )
}

const onMissingLanguage = (highlighter: Highlighter, language) => {
    let promise = highlighter.loadLanguage(language)
    if (promise instanceof Promise) {
        throw promise
    }
}

function setHighlighter() {
    if (highlighter) return Promise.resolve()
    return createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: ['text'],
    }).then((x) => {
        if (highlighter) return
        highlighter = x
    })
}

let highlighter: Highlighter | undefined
setHighlighter()

let processors = new Map<string, any>()

const MarkdownRuntimeItem = memo(
    ({ markdown, extension }: { markdown; extension }) => {
        if (!highlighter) {
            throw setHighlighter()
        }

        let processor = processors.get(extension)
        if (!processor) {
            processor = getProcessor({
                extension,
                onMissingLanguage,
                highlighter,
            })
            processors.set(extension, processor)
        }

        try {
            const file = processor.processSync(markdown)
            let ast = file.data.ast
            return <MarkdownAstRenderer ast={ast} />
        } catch (e) {
            console.error(e)
            return null
        }
    },
)

export class PreserveUIBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; lastGoodChildren: React.ReactNode | null }
> {
    state = { hasError: false, lastGoodChildren: null }

    // 1️⃣ Capture last good children whenever props change and no error yet
    static getDerivedStateFromProps(
        props: Readonly<{ children: React.ReactNode }>,
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
        if (this.state.hasError && this.state.lastGoodChildren) {
            return <>{this.state.lastGoodChildren}</> // show previous UI
        }
        return this.props.children // normal path
    }
}
