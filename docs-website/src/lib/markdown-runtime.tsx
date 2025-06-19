import {
    useId,
    useMemo,
    Suspense,
    memo,
    useState,
    useEffect,
    startTransition,
    useDeferredValue,
} from 'react'
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

export const StreamingMarkdownRuntimeComponent = memo(
    function MarkdownRuntimeComponent({
        markdown: _markdown,
        extension = 'mdx',
        isStreaming: _isStreaming,
    }: MarkdownRendererProps) {
        const previousBlocksRef = React.useRef<any[]>([])
        const markdown = _markdown
        const isStreaming = _isStreaming

        const blocks = useMemo(
            function getMarkdownBlocks() {
                let localBlocks = previousBlocksRef.current
                try {
                    const { ast } = processMdxInClient({ extension, markdown })
                    // Add a `raw` field to each child by using its `position` to extract from the markdown text.
                    localBlocks = ast.children
                    previousBlocksRef.current = localBlocks
                    return localBlocks
                } catch (err) {
                    if (err instanceof Promise) {
                        throw err
                    }
                    if (!isStreaming) {
                        console.log(
                            `no streaming markdown right now, throwing error for invalid markdown`,
                            markdown,
                        )
                        throw err
                    }
                    console.error(
                        'Markdown lexing error, showing previous markdown content:',
                        err,
                    )
                    return localBlocks
                }
            },
            [extension, markdown, isStreaming],
        )
        if (!markdown) return null
        return (blocks || []).map((block, index) => {
            // if (block.type === 'space') return block.raw
            return <MarkdownAstRenderer key={index} ast={block} />
        })
    },
)

const missingLanguagePromises = new Map<string, Promise<any> | null>()

const onMissingLanguage = (highlighter: Highlighter, language: string) => {
    if (missingLanguagePromises.has(language)) {
        const p = missingLanguagePromises.get(language)
        if (p instanceof Promise) {
            return
        }
        console.warn(
            `suspending markdown processing because of missing language ${language}`,
        )
        throw p
    }
    let promise = highlighter.loadLanguage(language as any).finally(() => {
        // console.error(`could not load shiki language ${language}`, e)
        missingLanguagePromises.set(language, null)
    })
    if (promise instanceof Promise) {
        console.warn(
            `suspending markdown processing because of missing language ${language}`,
        )
        missingLanguagePromises.set(language, promise)
        throw promise
    }
}

function setHighlighter() {
    if (highlighter) return Promise.resolve()
    return createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: ['plaintext'],
    }).then((x) => {
        if (highlighter) return
        highlighter = x
    })
}

let highlighter: Highlighter | undefined
setHighlighter()

let processors = new Map<string, any>()

export function processMdxInClient({ extension = 'mdx', markdown }) {
    if (!highlighter) {
        console.warn(
            `suspending markdown processing because of missing highlighter`,
        )
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

    console.time(`${extension} processSync`)
    // console.trace('processSync')
    try {
        const file = processor.processSync(markdown)
        let ast = file.data.ast
        return file.data as ProcessorData
    } finally {
        console.timeEnd(`${extension} processSync`)
    }
}
