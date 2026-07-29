/**
 * Chat markdown renderer — reuses the same editorial mdx components and a
 * chat-tuned renderNode from mdx-components-map.tsx. This ensures chat
 * responses look identical to the main docs content (same CodeBlock,
 * same List, same P, same A, same image handling), minus the code block
 * chrome that only makes sense in a wide docs column.
 */

import type React from 'react'
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

/**
 * Wrapper tags models emit around their scratchpad. They are registered as
 * components that render nothing, which is the whole handling: the tag and
 * its contents disappear and the real answer around it renders normally.
 *
 * Registering them beats stripping them from the text: no regex, no
 * code-fence carve-outs, and an answer that *documents* `<think>` inside a
 * code block is untouched because fenced code is never parsed as JSX.
 *
 * Chat-only — docs pages keep the plain component map.
 */
export const DROPPED_CHAT_TAGS = ['think', 'thinking', 'thought', 'reasoning', 'scratchpad', 'antml'] as const

/**
 * Wrapper tags models put AROUND the answer. Unlike the scratchpad tags these
 * must keep their contents, so they render as a passthrough.
 *
 * Without this, safe-mdx has no component for them (they are not valid HTML
 * elements either) and renders them as null — deleting the answer.
 */
export const PASSTHROUGH_CHAT_TAGS = ['answer', 'response', 'final_answer', 'solution'] as const

const chatComponents = {
  ...mdxComponents,
  ...Object.fromEntries(DROPPED_CHAT_TAGS.map((tag) => [tag, () => null])),
  ...Object.fromEntries(
    PASSTHROUGH_CHAT_TAGS.map((tag) => [tag, ({ children }: { children?: React.ReactNode }) => children]),
  ),
}

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
      components={chatComponents}
      renderNode={chatRenderNode}
      onError={(error) => logMdxError(error, 'AI chat response')}
    />
  )
}
