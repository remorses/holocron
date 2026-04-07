import { frontmatterToMarkdown } from 'mdast-util-frontmatter'
import { mdxToMarkdown } from 'mdast-util-mdx'
import { toMarkdown } from 'mdast-util-to-markdown'
import type { Root } from 'mdast'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import { remark } from 'remark'
import { remarkCodeGroup } from './remark-code-group.ts'
import { remarkFlattenComponentNames } from './remark-flatten-component-names.ts'
import { remarkHeadingIds } from './remark-heading-ids.ts'
import { remarkMermaidCode } from './remark-mermaid.ts'
import { remarkSingleAccordionItems } from './remark-single-accordion.ts'

function preprocessHeadingIds(content: string): string {
  return content.replace(/^(#{1,6}\s+.*?)(?:\s+\{#([A-Za-z0-9_-]+)\})\s*$/gm, (_, headingLine: string, id: string) => {
    return `${headingLine}\n{/*holocron-heading-id:${id}*/}`
  })
}

export function normalizeMdx(content: string): string {
  const preprocessedContent = preprocessHeadingIds(content)
  const processor = remark()
    .use(remarkMdx)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkFlattenComponentNames)
    .use(remarkHeadingIds)
    .use(remarkCodeGroup)
    .use(remarkMermaidCode)
    .use(remarkSingleAccordionItems)

  const parsed = processor.parse(preprocessedContent)
  const normalized = processor.runSync(parsed) as Root

  return toMarkdown(normalized, {
    extensions: [
      mdxToMarkdown(),
      frontmatterToMarkdown(['yaml']),
    ],
  })
}
