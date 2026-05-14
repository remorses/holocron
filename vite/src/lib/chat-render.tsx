/**
 * Chat markdown renderer — reuses the same editorial mdx components
 * and renderNode from mdx-components-map.tsx. This ensures chat
 * responses look identical to the main docs content (same CodeBlock,
 * same List, same P, same A, same image handling).
 */

import type { Root, RootContent } from 'mdast'
import { SafeMdxRenderer } from 'safe-mdx'
import { mdxComponents, renderNode } from './mdx-components-map.tsx'
import { logMdxError } from './logger.ts'

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
      renderNode={renderNode}
      onError={(error) => logMdxError(error, 'AI chat response')}
    />
  )
}
