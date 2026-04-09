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
import { remarkMermaidCode } from './remark-mermaid.ts'
import { remarkSingleAccordionItems } from './remark-single-accordion.ts'

function rewriteMarkdownHeadingIds(content: string) {
  return content.replace(/^(#{1,6})\s+(.+?)\s+\{#([A-Za-z][\w-]*)\}\s*$/gm, (_, hashes: string, text: string, id: string) => {
    const level = hashes.length
    return `<h${level} id="${id}">\n  ${text}\n</h${level}>`
  })
}

export function normalizeMdx(content: string): string {
  const normalizedContent = rewriteMarkdownHeadingIds(content)
  const processor = remark()
    .use(remarkMdx)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkCodeGroup)
    .use(remarkMermaidCode)
    .use(remarkSingleAccordionItems)

  const parsed = processor.parse(normalizedContent)
  const normalized = processor.runSync(parsed) as Root

  return toMarkdown(normalized, {
    extensions: [
      gfmToMarkdown(),
      mdxToMarkdown(),
      frontmatterToMarkdown(['yaml']),
    ],
  })
}
