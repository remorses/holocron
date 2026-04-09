import type { Heading, PhrasingContent, Root, RootContent } from 'mdast'
import GithubSlugger from 'github-slugger'
import { mdastHeadingId } from 'mdast-heading-id'
import { micromarkHeadingId } from 'micromark-heading-id'
import { visit } from 'unist-util-visit'
import { createElement, expressionAttribute, literalAttribute, numberExpression } from './jsx-utils.ts'

type IdStringNode = { type: 'idString'; value: string }

type JsxNode = RootContent & {
  name?: string
  attributes?: Array<{ type: string; name?: string; value?: unknown }>
  children?: RootContent[]
}

/**
 * Normalize markdown/native headings into the custom <Heading> MDX component.
 * Keeps Mintlify's {#custom-id} syntax while avoiding runtime overrides for
 * lowercase native h1-h6 tags.
 */
export function remarkHeadings(this: { data(): Record<string, unknown> }) {
  const data = this.data()
  const micromarkExtensions = (data.micromarkExtensions ??= []) as unknown[]
  const fromMarkdownExtensions = (data.fromMarkdownExtensions ??= []) as unknown[]

  micromarkExtensions.push(micromarkHeadingId())
  fromMarkdownExtensions.push(mdastHeadingId())

  return (tree: Root) => {
    const slugger = new GithubSlugger()

    visit(tree as never, 'idString', (_node, _index, parent) => {
      if (!parent) {
        throw new Error('Unexpected idString under no parent.')
      }
      const parentNode = parent as { type?: string }
      if (parentNode.type !== 'heading') {
        throw new Error(`Unexpected idString under ${parentNode.type}.`)
      }
    })

    visit(tree, (node, index, parent) => {
      const currentNode = node as RootContent

      if (!parent || typeof index !== 'number') {
        return
      }

      if (currentNode.type === 'heading') {
        const explicitId = takeExplicitId(currentNode)
        const text = extractText(currentNode.children)
        const headingId = explicitId || slugger.slug(text)

        parent.children.splice(index, 1, createElement(
          'Heading',
          [
            expressionAttribute('level', numberExpression(currentNode.depth)),
            literalAttribute('id', headingId),
          ],
          currentNode.children as unknown[],
        ) as never)
        return
      }

      if (!isNativeJsxHeading(currentNode)) {
        return
      }

      const explicitId = getLiteralJsxAttrValue(currentNode, 'id')
      const noAnchor = hasBooleanJsxAttr(currentNode, 'noAnchor')
      const text = extractText((currentNode.children ?? []) as PhrasingContent[])
      const headingId = explicitId || slugger.slug(text)
      const level = Number(currentNode.name?.slice(1) ?? '1')

      const attributes = [
        expressionAttribute('level', numberExpression(level)),
        literalAttribute('id', headingId),
      ]
      if (noAnchor) {
        attributes.push(literalAttribute('noAnchor', null))
      }

      parent.children.splice(index, 1, createElement(
        'Heading',
        attributes,
        (currentNode.children ?? []) as unknown[],
      ) as never)
    })
  }
}

function takeExplicitId(node: Heading): string | undefined {
  const ids = node.children.filter((child) => {
    return (child as { type?: string }).type === 'idString'
  }) as unknown as IdStringNode[]

  if (ids.length === 0) {
    return undefined
  }
  if (ids.length > 1) {
    throw new Error(`Found ${ids.length} ids under heading ${node.depth}.`)
  }

  const idNode = ids[0]
  if (!idNode?.value) {
    return undefined
  }

  const nodeIndex = node.children.indexOf(idNode as never)
  if (nodeIndex >= 1) {
    const previous = node.children[nodeIndex - 1]
    if (previous?.type === 'text') {
      previous.value = previous.value.trimEnd()
    }
  }
  node.children.splice(nodeIndex, 1)
  return idNode.value
}

function isNativeJsxHeading(node: RootContent): node is JsxNode {
  if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') {
    return false
  }
  return /^h[1-6]$/.test(node.name ?? '')
}

function getLiteralJsxAttrValue(node: JsxNode, attrName: string): string | undefined {
  const attr = (node.attributes ?? []).find((attribute) => {
    return attribute.type === 'mdxJsxAttribute' && attribute.name === attrName
  })
  if (!attr || typeof attr.value !== 'string') {
    return undefined
  }
  return attr.value
}

function hasBooleanJsxAttr(node: JsxNode, attrName: string): boolean {
  return (node.attributes ?? []).some((attribute) => {
    return attribute.type === 'mdxJsxAttribute' && attribute.name === attrName
  })
}

function extractText(children: PhrasingContent[]): string {
  return children
    .map((child) => {
      if (child.type === 'text') {
        return child.value
      }
      if ('children' in child) {
        return extractText(child.children)
      }
      return ''
    })
    .join('')
}
