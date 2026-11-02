import { visit, type NodeOf, type Root } from 'mdastic'

const SIDEBAR_COMPONENT_NAMES = new Set(['RequestExample', 'ResponseExample'])

/**
 * Normalize sidebar-like MDX components into explicit `<Aside>` wrappers so the
 * section splitter only needs to reason about one sidebar primitive.
 */
export function remarkSidebarComponents(tree: Root): void {
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

    const asideNode: NodeOf<'mdxJsxFlowElement'> = {
      type: 'mdxJsxFlowElement',
      name: 'Aside',
      attributes: [],
      children: [node],
    }

    parent.children.splice(index, 1, asideNode)
  })
}
