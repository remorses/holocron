import {
    keepPreviousData,
    useQuery,
    useSuspenseQuery,
} from '@tanstack/react-query'
import { memo, useRef, useState } from 'react'

import { SafeMdxRenderer } from 'safe-mdx'
import { cn } from './cn.js'

import { parseMarkdownIncremental } from './incremental-markdown-parser.js'
import { MarkdownRendererProps } from './markdown.js'

import { processorWithAst, simplerProcessor } from './simple-processor.js'

export const StreamingMarkdownRuntimeComponent = memo(
    function MarkdownRuntimeComponent({
        markdown: markdown,
        isStreaming: isStreaming,
        onAst,
        className,
        components,
        processor = simplerProcessor,
        renderNode,
    }: MarkdownRendererProps & {}) {
        const container = useRef<HTMLDivElement>(null)

        let [markdownCache] = useState(() => new Map())

        const { data: resultAst } = useSuspenseQuery({
            queryKey: ['markdown-ast', markdown, isStreaming],

            queryFn: async ({}) => {
                if (!markdown) return []

                try {
                    // const file = await processorWithAst(processor).process(markdown)
                    // const ast = file.data.ast
                    const ast = await parseMarkdownIncremental({
                        cache: markdownCache,
                        markdown,
                        trailingNodes: 2,
                        processor,
                    })
                    onAst?.(ast)

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
                    // React Query with placeholderData will show previous data on error
                    throw err
                }
            },
            retry(failureCount, error) {
                if (isStreaming) return true
                return false
            },

            // placeholderData: keepPreviousData,
        })

        return (
            <div
                className={cn('prose select-text dark:prose-invert', className)}
                ref={container}
            >
                {resultAst?.children?.map((block, index) => {
                    return (
                        <SafeMdxRenderer
                            allowClientEsmImports
                            key={index}
                            addMarkdownLineNumbers
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
