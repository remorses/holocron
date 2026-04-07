import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'
import { createElement } from './jsx-utils.ts'

export function remarkSingleAccordionItems() {
  return (tree) => {
    visit(tree, 'mdxJsxFlowElement', (node, index, parent) => {
      if (node.type !== 'mdxJsxFlowElement' || node.name !== 'Accordion' || !Array.isArray(parent?.children)) {
        return
      }

      if (parent.type === 'mdxJsxFlowElement' && parent.name === 'AccordionGroup') {
        return
      }

      if (typeof index !== 'number') {
        return
      }

      parent.children.splice(index, 1, createElement('AccordionGroup', [], [node]) as never)
    })
  }
}
