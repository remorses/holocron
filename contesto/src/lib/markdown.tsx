import { lazy } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { RenderNode, SafeMdxRenderer } from 'safe-mdx'

import { cn } from './cn.js'

const MarkdownRuntimeComponent = lazy(() =>
  import('./markdown-runtime.js').then((mod) => ({
    default: mod.StreamingMarkdownRuntimeComponent,
  })),
)

export type MarkdownRendererProps = {
  markdown?: string
  className?: string
  ast?: any
  isStreaming?: boolean | undefined
  components?: any
  processor?: any
  onAst?: (ast: any) => void
  renderNode?: RenderNode
  addMarkdownLineNumbers?: boolean
}

const reactQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      experimental_prefetchInRender: true,
    },
  },
})

export const Markdown = function MarkdownRender(props: MarkdownRendererProps) {
  const { ast } = props
  if (!ast) {
    return (
      <QueryClientProvider client={reactQueryClient}>
        <MarkdownRuntimeComponent {...props} />
      </QueryClientProvider>
    )
  }
  return (
    <div
      className={cn('select-text prose-sm dark:prose-invert', props.className)}
    >
      <SafeMdxRenderer
        addMarkdownLineNumbers={props.addMarkdownLineNumbers ?? true}
        allowClientEsmImports
        renderNode={props.renderNode}
        components={props.components}
        markdown={props.markdown}
        mdast={ast}
      />
    </div>
  )
}

Markdown.displayName = 'MemoizedMarkdownBlock'
