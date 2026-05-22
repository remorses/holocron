import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'
import { parseCodeMeta, metaBool } from './code-meta.ts'
import { booleanExpression, createElement, expressionAttribute, literalAttribute, type JsxAttribute } from './jsx-utils.ts'

/**
 * Mermaid fences need to become an explicit component node so the runtime can
 * render SVG diagrams instead of treating them like ordinary highlighted code.
 */
export function remarkMermaidCode() {
  return (tree) => {
    visit(tree, 'code', (node, index, parent) => {
      if (node.type !== 'code' || node.lang !== 'mermaid' || !parent || typeof index !== 'number') {
        return
      }

      const meta = parseCodeMeta(node.meta)
      const attributes: JsxAttribute[] = [literalAttribute('chart', node.value)]
      if (meta.attributes.placement) {
        attributes.push(literalAttribute('placement', meta.attributes.placement))
      }
      const actions = metaBool(meta.attributes.actions)
      if (actions !== undefined) {
        attributes.push(expressionAttribute('actions', booleanExpression(actions)))
      }

      parent.children.splice(index, 1, createElement({ name: 'Mermaid', attributes }))
    })
  }
}
