/** Test helpers for running Mintlify remark plugins through the same mdx serializer. */

import { frontmatterToMarkdown } from 'mdast-util-frontmatter'
import { gfmToMarkdown } from 'mdast-util-gfm'
import { mdxToMarkdown } from 'mdast-util-mdx'
import { toMarkdown } from 'mdast-util-to-markdown'
import type { Root } from 'mdast'
import remarkMdx from 'remark-mdx'
import { remark } from 'remark'

export function runRemarkPlugin(
  content: string,
  plugin: () => (tree: Root) => void,
) {
  const processor = remark().use(remarkMdx).use(plugin)
  const parsed: Root = processor.parse(content)
  const parsedSnapshot: Root = structuredClone(parsed)
  const transformedNode = processor.runSync(parsed)
  const transformedChildren = Reflect.get(transformedNode, 'children')
  if (transformedNode.type !== 'root' || !Array.isArray(transformedChildren)) {
    throw new Error('Remark plugin must return a root node')
  }
  const transformed: Root = { type: 'root', children: transformedChildren }

  return {
    parsed: parsedSnapshot,
    transformed,
    markdown: toMarkdown(transformed, {
      extensions: [gfmToMarkdown(), mdxToMarkdown(), frontmatterToMarkdown(['yaml'])],
    }),
  }
}
