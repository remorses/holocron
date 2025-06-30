import { memo, useMemo, useRef, useState } from 'react'

import { diffWordsWithSpace } from 'diff'
import memoize from 'micro-memoize'
import React from 'react'
import { SafeMdxRenderer } from 'safe-mdx'
import { createHighlighter, Highlighter } from 'shiki'
import { mdxComponents } from '../components/mdx-components'
import { cn } from './cn'
import { markAddedNodes } from './diff'
import {
    useAddedHighlighter,
    useScrollToFirstAddedIfAtTop,
} from './diff-highlight'
import { MarkdownRendererProps } from './markdown'
import { getProcessor, ProcessorData } from './mdx-heavy'
import { parseMarkdownIncremental } from './incremental-markdown-parser'
import { renderNode } from './mdx-code-block'

export const StreamingMarkdownRuntimeComponent = memo(
    function MarkdownRuntimeComponent({
        markdown: markdown,
        extension = 'mdx',
        isStreaming: isStreaming,
        previousMarkdown,
        previousAst,
        className,
        addDiffAttributes = false,
        components,
    }: MarkdownRendererProps & {}) {
        const container = useRef<HTMLDivElement>(null)

        useAddedHighlighter({
            root: container,
            enabled: addDiffAttributes,
        })
        useScrollToFirstAddedIfAtTop({
            enabled: addDiffAttributes && isStreaming,
        })

        let [markdownCache] = useState(() => new Map())
        const previousAstRef = React.useRef<any>(null)

        const resultAst = useMemo(() => {
            if (!markdown) return []

            try {
                if (!markdown) return []

                const ast = parseMarkdownIncremental({
                    cache: markdownCache,
                    extension,
                    markdown,
                    trailingNodes: 2,
                })

                if (previousMarkdown) {
                    const diffs = diffWordsWithSpace(previousMarkdown, markdown)
                    markAddedNodes(diffs, ast)
                }

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
        }, [extension, markdown, isStreaming, previousMarkdown, previousAst])
        if (!markdown) return null
        return (
            <div
                className={cn('contents prose select-text dark:prose-invert', className)}
                ref={container}
            >
                {resultAst?.children?.map((block, index) => {
                    return (
                        <SafeMdxRenderer
                            key={index}
                            renderNode={renderNode}
                            components={components || mdxComponents}
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

let processors = new Map<string, any>()

export function processMdxInClient({
    extension = 'mdx',
    onMissingLanguage = throwOnMissingLanguage,
    markdown,
}) {
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
            onMissingLanguage: onMissingLanguage,
            highlighter,
        })
        processors.set(extension, processor)
    }

    console.time(`${extension} processSync`)
    // console.trace('processSync')
    try {
        const file = processor.processSync(markdown)
        return file.data as ProcessorData
    } finally {
        console.timeEnd(`${extension} processSync`)
    }
}
