import type { Heading, Root } from 'mdast'
import { mdastHeadingId } from 'mdast-heading-id'
import { micromarkHeadingId } from 'micromark-heading-id'
import { visit } from 'unist-util-visit'
import { createElement, literalAttribute } from './jsx-utils.ts'

type IdStringNode = { type: 'idString'; value: string }

/**
 * Mintlify supports `{#custom-id}` on markdown headings. We need parser-level
 * support so the id survives in mdast (`data.id` + `data.hProperties.id`) and
 * then a final JSX heading rewrite so the normalized output still parses in
 * safe-mdx, which doesn't consume mdast data fields directly.
 */
export function remarkHeadingIds(this: any) {
  const data = this.data() as any

  ;(data.micromarkExtensions || (data.micromarkExtensions = [])).push(
    micromarkHeadingId(),
  )
  ;(data.fromMarkdownExtensions || (data.fromMarkdownExtensions = [])).push(
    mdastHeadingId(),
  )

  return (tree) => {
    visit(tree as never, 'idString', (_node, _index, parent) => {
      if (!parent) {
        throw new Error('Unexpected idString under no parent.')
      }
      const parentNode = parent as { type?: string }
      if (parentNode.type !== 'heading') {
        throw new Error(`Unexpected idString under ${parentNode.type}.`)
      }
    })

    visit(tree, 'heading', (node, index, parent) => {
      const heading = node as Heading
      const ids = heading.children.filter((child) => (child as { type?: string }).type === 'idString') as unknown as IdStringNode[]
      if (ids.length === 0) {
        return
      }
      if (ids.length > 1) {
        throw new Error(`Found ${ids.length} ids under heading ${heading.depth}.`)
      }

      const idNode = ids[0]
      if (!idNode?.value) {
        return
      }

      const explicitId = idNode.value
      if (!heading.data) heading.data = {}
      if (!heading.data.hProperties) heading.data.hProperties = {}
      ;(heading.data as { id?: string }).id = explicitId
      ;(heading.data.hProperties as { id?: string }).id = explicitId

      idNode.value = ''

      const nodeIndex = heading.children.indexOf(idNode as never)
      if (nodeIndex >= 1) {
        const previous = heading.children[nodeIndex - 1]
        if (previous?.type === 'text') {
          previous.value = previous.value.trimEnd()
        }
      }
      heading.children.splice(nodeIndex, 1)

      if (!parent || typeof index !== 'number') {
        return
      }

      parent.children.splice(index, 1, createElement(
        `h${heading.depth}`,
        [literalAttribute('id', explicitId)],
        heading.children as unknown as unknown[],
      ) as never)
    })
  }
}
