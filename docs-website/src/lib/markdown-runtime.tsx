import { memo, useMemo, useRef } from 'react'

import memoize from 'micro-memoize'
import React from 'react'
import { SafeMdxRenderer } from 'safe-mdx'
import { createHighlighter, Highlighter } from 'shiki'
import { mdxComponents } from '../components/mdx-components'
import { cn } from './cn'
import { useAddedHighlighter } from './diff'
import { MarkdownRendererProps } from './markdown'
import { customTransformer, getProcessor, ProcessorData } from './mdx'

export const StreamingMarkdownRuntimeComponent = memo(
    function MarkdownRuntimeComponent({
        markdown: _markdown,
        extension = 'mdx',
        isStreaming: _isStreaming,
        previousMarkdown: oldAstToDiff,
        previousAst,
        className,
        addDiffAttributes = false,
    }: MarkdownRendererProps & {
        previousMarkdown?: any
        previousAst?: any
        addDiffAttributes?: any
    }) {
        const container = useRef<HTMLDivElement>(null)

        useAddedHighlighter({ root: container, enabled: !!oldAstToDiff })
        const previousAstRef = React.useRef<any>(null)
        const markdown = _markdown
        const isStreaming = _isStreaming

        const ast = useMemo(
            function getMarkdownAst() {
                let prevAst = previousAstRef.current
                try {
                    const { ast } = processMdxInClient({ extension, markdown })
                    // if (oldAstToDiff) {
                    //     console.log(`diffing the old ast`)
                    //     const result = markRemarkAstAdditions(oldAstToDiff, ast)
                    //     console.log(result)
                    // }
                    prevAst = ast
                    previousAstRef.current = prevAst
                    return prevAst
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
                    return prevAst
                }
            },
            [extension, markdown, isStreaming, oldAstToDiff],
        )
        if (!markdown) return null
        return (
            <div className={cn('contents', className)} ref={container}>
                {ast?.children?.map((block, index) => {
                    // if (block.type === 'space') return block.raw
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
