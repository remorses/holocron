import type { Root } from 'mdast'
import { visit } from 'unist-util-visit'
import { parseCodeMeta } from './code-meta.ts'
import { booleanExpression, createElement, expressionAttribute, literalAttribute } from './jsx-utils.ts'

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
      const attributes: object[] = [literalAttribute('chart', node.value)]
      if (typeof meta.attributes.placement === 'string') {
        attributes.push(literalAttribute('placement', meta.attributes.placement))
      }
      if (typeof meta.attributes.actions === 'boolean') {
        attributes.push(expressionAttribute('actions', booleanExpression(meta.attributes.actions)))
      }

      parent.children.splice(index, 1, createElement('Mermaid', attributes) as never)
    })
  }
}
