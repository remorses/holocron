import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'

const COMPONENT_NAME_MAP: Record<string, string> = {
  'Tree.Folder': 'TreeFolder',
  'Tree.File': 'TreeFile',
  'Color.Row': 'ColorRow',
  'Color.Item': 'ColorItem',
}

export function remarkFlattenComponentNames() {
  return (tree: Root) => {
    visit(tree, (node) => {
      if ((node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') || !('name' in node)) {
        return
      }
      const nextName = COMPONENT_NAME_MAP[node.name ?? '']
      if (nextName) {
        node.name = nextName
      }
    })
  }
}
