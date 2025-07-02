import { memo, useMemo, useRef, useState } from 'react'

import { diffWordsWithSpace } from 'diff'
import memoizePkg from 'micro-memoize'
const memoize = memoizePkg.default || memoizePkg
import React from 'react'
import { SafeMdxRenderer } from 'safe-mdx'
import { createHighlighter, Highlighter } from 'shiki'
import { cn } from './cn.js'

import { MarkdownRendererProps } from './markdown.js'
import { simplerProcessor } from './simple-processor.js'
import { parseMarkdownIncremental } from './incremental-markdown-parser.js'
import { renderNode } from './mdx-code-block.js'

export const StreamingMarkdownRuntimeComponent = memo(
    function MarkdownRuntimeComponent({
        markdown: markdown,

        isStreaming: isStreaming,

        className,
        components,
        processor,
    }: MarkdownRendererProps & {}) {
        const container = useRef<HTMLDivElement>(null)

        let [markdownCache] = useState(() => new Map())
        const previousAstRef = React.useRef<any>(null)

        const resultAst = useMemo(() => {
            if (!markdown) return []

            try {
                if (!markdown) return []

                const ast = parseMarkdownIncremental({
                    cache: markdownCache,
                    markdown,
                    trailingNodes: 2,
                    processor,
                })

                // if (previousMarkdown) {
                //     const diffs = diffWordsWithSpace(previousMarkdown, markdown)
                //     markAddedNodes(diffs, ast)
                // }

                previousAstRef.current = ast

                return ast
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
                // Return previous AST nodes when streaming and error occurs
                return previousAstRef.current
            }
        }, [markdown, isStreaming])
        if (!markdown) return null
        return (
            <div
                className={cn(
                    'contents prose select-text dark:prose-invert',
                    className,
                )}
                ref={container}
            >
                {resultAst?.children?.map((block, index) => {
                    return (
                        <SafeMdxRenderer
                            key={index}
                            renderNode={renderNode}
                            components={components}
                            mdast={block}
                        />
                    )
                })}
            </div>
        )
    },
)

const alreadyLoadedLanguages = new Set<string>()

const loadLanguageMemo = memoize(
    (highlighter: Highlighter, language: string) => {
        return highlighter.loadLanguage(language as any).finally(() => {
            alreadyLoadedLanguages.add(language)
        })
    },
)

const throwOnMissingLanguage = (highlighter: Highlighter, language: string) => {
    if (alreadyLoadedLanguages.has(language)) {
        console.warn(
            `Skipping language loading for previously loaded language ${language}`,
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

export function processMdxInClient({
    onMissingLanguage = throwOnMissingLanguage,
    markdown,
    processor: customProcessor,
}) {
    if (!highlighter) {
        console.warn(
            `suspending markdown processing because of missing highlighter`,
        )
        throw setHighlighter()
    }
    let processor = customProcessor
    if (!processor) {
        processor = simplerProcessor
    }

    const start = performance.now()
    try {
        const file = processor.processSync(markdown)
        // For simple processor, return the mdast directly
        return { mdast: file.result }
    } finally {
        const duration = performance.now() - start
        if (duration > 5) {
            console.log(`processMdxInClient took ${duration.toFixed(2)}ms`)
        }
    }
}
