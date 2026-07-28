/**
 * Chat markdown renderer — reuses the same editorial mdx components and a
 * chat-tuned renderNode from mdx-components-map.tsx. This ensures chat
 * responses look identical to the main docs content (same CodeBlock,
 * same List, same P, same A, same image handling), minus the code block
 * chrome that only makes sense in a wide docs column.
 */

import type { Root, RootContent } from 'mdast'
import { SafeMdxRenderer } from 'safe-mdx'
import { createRenderNode, mdxComponents } from './mdx-components-map.tsx'
import { logMdxError } from './logger.ts'

/**
 * The chat panel is a narrow column, so code blocks drop the line-number
 * gutter and the right-edge bleed that docs pages use. Everything else stays
 * identical to the docs renderer.
 */
const chatRenderNode = createRenderNode({
  forceNoLineNumbers: true,
  defaultCodeBleed: 'none',
})

/** Render an array of mdast nodes through safe-mdx with the editorial
 *  component map. Used server-side to render AI chat response text. */
export function ChatRenderNodes({
  markdown,
  nodes,
}: {
  markdown: string
  nodes: RootContent[]
}) {
  const syntheticRoot: Root = { type: 'root', children: nodes }
  return (
    <SafeMdxRenderer
      markdown={markdown}
      mdast={syntheticRoot}
      components={mdxComponents}
      renderNode={chatRenderNode}
      onError={(error) => logMdxError(error, 'AI chat response')}
    />
  )
}
