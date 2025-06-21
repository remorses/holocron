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
} from './markdown'
import { createHighlighter, Highlighter } from 'shiki'
import { getProcessor, ProcessorData } from './mdx'
import markdownRs from '@xmorse/markdown-rs'
import React from 'react'
import memoize from 'micro-memoize'

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
const failedLanguages = new Set<string>()

const loadLanguageMemo = memoize(
    (highlighter: Highlighter, language: string) => {
        return highlighter.loadLanguage(language as any).catch((e) => {
            console.error(e)
            failedLanguages.add(language)
        })
    },
)

const onMissingLanguage = (highlighter: Highlighter, language: string) => {
    if (failedLanguages.has(language)) {
        console.warn(
            `Skipping language loading for previously failed language ${language}`,
        )
        return
    }
    const promise = loadLanguageMemo(highlighter, language)
    if (promise instanceof Promise) {
        console.warn(
            `suspending markdown processing because of missing language ${language}`,
        )
        throw promise
    }
}

let highlighter: Highlighter | undefined

const setHighlighter = memoize(() => {
    return createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: ['plaintext'],
    }).then((x) => {
        highlighter = x
        return x
    })
})

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
