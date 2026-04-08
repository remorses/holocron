import { frontmatterToMarkdown } from 'mdast-util-frontmatter'
import { gfmToMarkdown } from 'mdast-util-gfm'
import { mdxToMarkdown } from 'mdast-util-mdx'
import { toMarkdown } from 'mdast-util-to-markdown'
import type { Root } from 'mdast'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import { remark } from 'remark'
import { remarkCodeGroup } from './remark-code-group.ts'
import { remarkHeadingIds } from './remark-heading-ids.ts'
import { remarkMermaidCode } from './remark-mermaid.ts'
import { remarkSingleAccordionItems } from './remark-single-accordion.ts'

export function normalizeMdx(content: string): string {
  const processor = remark()
    .use(remarkMdx)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkHeadingIds as never)
    .use(remarkCodeGroup)
    .use(remarkMermaidCode)
    .use(remarkSingleAccordionItems)

  const parsed = processor.parse(content)
  const normalized = processor.runSync(parsed) as Root

  return toMarkdown(normalized, {
    extensions: [
      gfmToMarkdown(),
      mdxToMarkdown(),
      frontmatterToMarkdown(['yaml']),
    ],
  })
}
