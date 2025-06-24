import { memo, useMemo, useRef } from 'react'

import memoize from 'micro-memoize'
import React from 'react'
import { SafeMdxRenderer } from 'safe-mdx'
import { createHighlighter, Highlighter } from 'shiki'
import { diffWords, diffWordsWithSpace } from 'diff'
import { mdxComponents } from '../components/mdx-components'
import { cn } from './cn'
import { useAddedHighlighter } from './diff-highlight'
import { MarkdownRendererProps } from './markdown'
import { customTransformer, getProcessor, ProcessorData } from './mdx'
import { getOptimizedMarkdownAst } from './incremental-markdown-parser'
import { markAddedNodes } from './diff'

export const StreamingMarkdownRuntimeComponent = memo(
    function MarkdownRuntimeComponent({
        markdown: _markdown,
        extension = 'mdx',
        isStreaming: _isStreaming,
        previousMarkdown,
        previousAst,
        className,
        addDiffAttributes = false,
    }: MarkdownRendererProps & {
        previousMarkdown?: any
        previousAst?: any
        addDiffAttributes?: any
    }) {
        const container = useRef<HTMLDivElement>(null)

        useAddedHighlighter({ root: container, enabled: addDiffAttributes })
        const previousAstRef = React.useRef<any[]>(null)
        const markdown = _markdown
        const isStreaming = _isStreaming

        const astNodes = useMemo(() => {
            if (!markdown) return []

            try {
                if (!markdown) return []
                const { ast } = processMdxInClient({ extension, markdown })
                if (previousMarkdown) {
                    const diffs = diffWordsWithSpace(previousMarkdown, markdown)
                    markAddedNodes(diffs, ast)
                }
                const nodes = ast.children
                // const nodes = getOptimizedMarkdownAst({
                //     markdown,
                //     previousMarkdown: oldAstToDiff,
                //     previousAst,
                //     extension,
                // })

                // Always update the ref with the new AST structure
                previousAstRef.current = nodes

                return nodes
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
                return previousAstRef.current || []
            }
        }, [extension, markdown, isStreaming, previousMarkdown, previousAst])
        if (!markdown) return null
        return (
            <div className={cn('contents', className)} ref={container}>
                {astNodes?.map((block, index) => {
                    // if (block.type === 'space') return block.raw
                    // Use position-based key for better memoization when nodes are reused
                    const nodeKey =
                        block.position?.start?.offset !== undefined
                            ? `${block.position.start.offset}-${block.position.end?.offset || 0}`
                            : index
                    return (
                        <SafeMdxRenderer
                            key={index}
                            customTransformer={customTransformer}
                            components={mdxComponents}
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

const onMissingLanguage = (highlighter: Highlighter, language: string) => {
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
