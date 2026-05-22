import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'

type FlowJsxNode = Extract<Root['children'][number], { type: 'mdxJsxFlowElement' }>

const SIDEBAR_COMPONENT_NAMES = new Set(['RequestExample', 'ResponseExample'])

/**
 * Normalize sidebar-like MDX components into explicit `<Aside>` wrappers so the
 * section splitter only needs to reason about one sidebar primitive.
 */
export function remarkSidebarComponents() {
  return (tree: Root) => {
    visit(tree, 'mdxJsxFlowElement', (node, index, parent) => {
      if (node.type !== 'mdxJsxFlowElement' || !SIDEBAR_COMPONENT_NAMES.has(node.name ?? '') || !Array.isArray(parent?.children)) {
        return
      }

      if (parent.type === 'mdxJsxFlowElement' && parent.name === 'Aside') {
        return
      }

      if (typeof index !== 'number') {
        return
      }

      const asideNode: FlowJsxNode = {
        type: 'mdxJsxFlowElement',
        name: 'Aside',
        attributes: [],
        children: [node],
      }

      parent.children.splice(index, 1, asideNode)
    })
  }
}
