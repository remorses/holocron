import { useId, useMemo, Suspense, memo } from 'react'
import { marked } from 'marked'

import {
    MarkdownAstRenderer,
    Markdown,
    MarkdownRendererProps,
} from './safe-mdx'
import { createHighlighter, Highlighter } from 'shiki'
import { getProcessor, ProcessorData } from './mdx'
import markdownRs from '@xmorse/markdown-rs'
import React from 'react'

export function MarkdownRuntimeComponent({
    markdown,
    extension = 'mdx',
    renderPreviousMarkdownOnError = true,
}: MarkdownRendererProps) {
    const previousBlocksRef = React.useRef<any[]>([])

    const blocks = useMemo(() => {
        if (!markdown) return []
        try {
            const { ast } = processMdxInClient({ extension, markdown })
            // Add a `raw` field to each child by using its `position` to extract from the markdown text.
            const newBlocks = ast.children.map((child) => {
                if (!child.position) {
                    console.error(`markdown ast has no position: ${child}`)
                    return { ...child, raw: '' }
                }
                return {
                    ...child,
                    raw: markdown.slice(
                        child.position.start.offset,
                        child.position.end.offset,
                    ),
                }
            })
            previousBlocksRef.current = newBlocks
            return newBlocks
        } catch (err) {
            if (err instanceof Promise) throw err
            console.error('Markdown lexing error:', err)
            // TODO add a way to return valid prefixes for old markdown
            if (renderPreviousMarkdownOnError) {
                return previousBlocksRef.current
            }
            return []
        }
    }, [markdown, extension, renderPreviousMarkdownOnError])

    return (
        <Suspense>
            {blocks.map((block, index) => {
                // if (block.type === 'space') return block.raw
                return <MarkdownAstRenderer key={index} ast={block} />
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

export function processMdxInClient({ extension, markdown = 'mdx' }) {
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

    const file = processor.processSync(markdown)
    let ast = file.data.ast
    return file.data as ProcessorData
}

const MarkdownRuntimeItem = memo(
    ({ markdown, extension }: { markdown; extension }) => {
        const { ast } = processMdxInClient({ extension, markdown })

        return <MarkdownAstRenderer ast={ast} />
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
