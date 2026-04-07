import type { Code, Root } from 'mdast'
import { visit } from 'unist-util-visit'
import { parseCodeMeta } from './code-meta.ts'
import { createElement, expressionAttribute, literalAttribute, stringArrayExpression } from './jsx-utils.ts'

/**
 * Mintlify authors use <CodeGroup> as structural sugar around titled fences.
 * Holocron's renderer only understands explicit Tabs/Tab JSX, so normalize the
 * authoring syntax here before safe-mdx tries to render the page.
 */
export function remarkCodeGroup() {
  return (tree) => {
    visit(tree, 'mdxJsxFlowElement', (node, index, parent) => {
      if (node.type !== 'mdxJsxFlowElement' || node.name !== 'CodeGroup' || !Array.isArray(node.children)) {
        return
      }

      const tabBlocks: { title: string; code: Code }[] = []
      for (const child of node.children) {
        if (child.type !== 'code') {
          continue
        }
        const meta = parseCodeMeta(child.meta)
        tabBlocks.push({
          title: typeof meta.title === 'string' && meta.title !== '' ? meta.title : child.lang || 'Code',
          code: child,
        })
      }

      if (tabBlocks.length === 0 || !parent || typeof index !== 'number') {
        return
      }

      parent.children.splice(index, 1, createElement(
        'Tabs',
        [expressionAttribute('items', stringArrayExpression(tabBlocks.map((block) => block.title)))],
        tabBlocks.map((block) => {
          return createElement('Tab', [literalAttribute('title', block.title)], [
            {
              ...block.code,
              type: 'code',
              meta: '',
            },
          ])
        }),
      ) as never)
    })
  }
}
