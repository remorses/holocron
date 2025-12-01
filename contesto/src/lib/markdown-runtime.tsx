import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { memo, useRef, useState } from 'react'

import { SafeMdxRenderer } from 'safe-mdx'
import { cn } from './cn'

import { parseMarkdownIncremental } from './incremental-markdown-parser'
import { MarkdownRendererProps } from './markdown'

import { processorWithAst, simplerProcessor } from './simple-processor'

export const StreamingMarkdownRuntimeComponent = memo(function MarkdownRuntimeComponent({
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

  const { data: resultAst, isError } = useQuery({
    queryKey: ['markdown-ast', markdown, isStreaming],

    queryFn: async () => {
      if (!markdown) return []

      const ast = await parseMarkdownIncremental({
        cache: markdownCache,
        markdown,
        trailingNodes: 2,
        processor,
      })
      onAst?.(ast)

      return ast
    },
    retry: isStreaming,
    throwOnError: false,
    // keepPreviousData returns last successful query data when current query fails or is loading,
    // preventing flicker during streaming when markdown temporarily becomes invalid mid-parse
    placeholderData: isStreaming ? keepPreviousData : undefined,
  })

  // fallback to raw markdown only when no previous data available
  if (!resultAst && (isError || !markdown)) {
    return (
      <div className={cn('select-text whitespace-pre-wrap', className)} ref={container}>
        {markdown}
      </div>
    )
  }

  return (
    <div className={cn('select-text ', className)} ref={container}>
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
})
