import type { Heading, Root, PhrasingContent } from 'mdast'
import { visit } from 'unist-util-visit'
import { createElement, literalAttribute } from './jsx-utils.ts'

const HEADING_ID_RE = /^(.*?)(?:\s+)?\{#([A-Za-z0-9_-]+)\}$/
const HEADING_MARKER_RE = /^\/\*holocron-heading-id:([A-Za-z0-9_-]+)\*\/$/

export function remarkHeadingIds() {
  return (tree) => {
    for (let index = 0; index < tree.children.length; index++) {
      const node = tree.children[index]
      const next = tree.children[index + 1]
      if (!node || node.type !== 'heading' || !next || next.type !== 'mdxFlowExpression') {
        continue
      }
      const markerMatch = HEADING_MARKER_RE.exec(next.value.trim())
      if (!markerMatch) {
        continue
      }
      const heading = node as Heading
      tree.children.splice(index, 2, createElement(
        `h${heading.depth}`,
        [literalAttribute('id', markerMatch[1] ?? '')],
        heading.children as unknown as PhrasingContent[],
      ) as never)
    }

    visit(tree, 'heading', (node, index, parent) => {
      if (!parent || typeof index !== 'number') {
        return
      }

      const heading = node as Heading
      const lastChild = heading.children.at(-1)
      if (!lastChild || lastChild.type !== 'text') {
        return
      }

      const match = HEADING_ID_RE.exec(lastChild.value)
      if (!match) {
        return
      }

      const [, cleanedText, id] = match
      if (!cleanedText || !id) {
        return
      }
      lastChild.value = cleanedText.trimEnd()
      parent.children.splice(index, 1, createElement(
        `h${heading.depth}`,
        [literalAttribute('id', id)],
        heading.children as unknown as PhrasingContent[],
      ) as never)
    })
  }
}
