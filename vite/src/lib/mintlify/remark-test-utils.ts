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
  plugin: unknown,
) {
  const processor = remark().use(remarkMdx).use(plugin as never)
  const parsed = processor.parse(content) as Root
  const parsedSnapshot = structuredClone(parsed) as Root
  const transformed = processor.runSync(parsed) as Root

  return {
    parsed: parsedSnapshot,
    transformed,
    markdown: toMarkdown(transformed, {
      extensions: [gfmToMarkdown(), mdxToMarkdown(), frontmatterToMarkdown(['yaml'])],
    }),
  }
}
