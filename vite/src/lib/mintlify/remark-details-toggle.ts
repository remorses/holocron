/** Remark plugin converting HTML details/summary blocks into Expandable MDX. */

import { gfmToMarkdown } from 'mdast-util-gfm'
import { mdxToMarkdown } from 'mdast-util-mdx'
import { toMarkdown } from 'mdast-util-to-markdown'
import type { Paragraph, Root, RootContent } from 'mdast'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import { visit } from 'unist-util-visit'

type JsxElement = Extract<RootContent, { type: 'mdxJsxFlowElement' | 'mdxJsxTextElement' }>
type FlowElement = Extract<RootContent, { type: 'mdxJsxFlowElement' }>

function isJsxElement(node: RootContent | Paragraph['children'][number]): node is JsxElement {
  return node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement'
}

function summaryMarkdown(summary: JsxElement): string {
  const children = summary.type === 'mdxJsxTextElement'
    ? summary.children
    : summary.children.flatMap((child) => {
        if (child.type === 'paragraph') return child.children
        return []
      })

  return toMarkdown({ type: 'root', children: [{ type: 'paragraph', children }] }, {
    extensions: [gfmToMarkdown(), mdxToMarkdown()],
  }).trim()
}

function titleFromSummary(summary: JsxElement): FlowElement['attributes'][number] {
  const markdown = summaryMarkdown(summary)
  const parsed = remark().use(remarkMdx).parse(`<Expandable title={<Markdown children=${JSON.stringify(markdown)} />} />`)
  const expandable = parsed.children[0]

  if (expandable?.type === 'mdxJsxFlowElement') {
    const title = expandable.attributes[0]
    if (title) return title
  }

  throw new Error('Failed to create details summary title attribute')
}

function getSummary(child: FlowElement['children'][number]): JsxElement | undefined {
  if (child.type === 'paragraph' && child.children.length === 1) {
    const [first] = child.children
    if (first && isJsxElement(first) && first.name === 'summary') {
      return first
    }
  }

  if (isJsxElement(child) && child.name === 'summary') {
    return child
  }
}

export function remarkDetailsToggle() {
  return (tree: Root) => {
    visit(tree, 'mdxJsxFlowElement', (node) => {
      if (node.type !== 'mdxJsxFlowElement' || node.name !== 'details') return

      const summary = node.children.map(getSummary).find(Boolean)
      node.name = 'Expandable'
      node.attributes = [
        ...(summary ? [titleFromSummary(summary)] : []),
        ...node.attributes.map((attribute) => {
          if (attribute.type === 'mdxJsxAttribute' && attribute.name === 'open') {
            return { ...attribute, name: 'defaultOpen' }
          }
          return attribute
        }),
      ]
      node.children = node.children.filter((child) => !getSummary(child))
    })
  }
}
