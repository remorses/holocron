import type { Heading, Root, RootContent } from 'mdast'
import GithubSlugger from 'github-slugger'
import { mdastHeadingId } from 'mdast-heading-id'
import { micromarkHeadingId } from 'micromark-heading-id'
import { visit } from 'unist-util-visit'
import { createElement, expressionAttribute, literalAttribute, numberExpression, type JsxElementNode } from './jsx-utils.ts'

type JsxNode = Extract<RootContent, { type: 'mdxJsxFlowElement' | 'mdxJsxTextElement' }>

/**
 * Normalize markdown headings into the custom <Heading> MDX component.
 * Native JSX h1-h6 tags stay native so authored classes/styles survive.
 * Keeps Mintlify's {#custom-id} syntax and injects missing ids on native JSX headings.
 */
export function remarkHeadings(this: { data(): Record<string, unknown> }) {
  const data = this.data()
  const micromarkExtensions = Array.isArray(data.micromarkExtensions) ? data.micromarkExtensions : (data.micromarkExtensions = [])
  const fromMarkdownExtensions = Array.isArray(data.fromMarkdownExtensions) ? data.fromMarkdownExtensions : (data.fromMarkdownExtensions = [])

  micromarkExtensions.push(micromarkHeadingId())
  fromMarkdownExtensions.push(mdastHeadingId())

  return (tree: Root) => {
    const slugger = new GithubSlugger()

    visit(tree, 'heading', (currentNode, index, parent) => {
      if (!parent || typeof index !== 'number') {
        return
      }

      const explicitId = takeExplicitId(currentNode)
      const text = extractText(currentNode.children)
      const headingId = explicitId || slugger.slug(text)

      parent.children.splice(index, 1, createHeadingNode(currentNode, headingId))
    })

    visit(tree, 'mdxJsxFlowElement', (currentNode) => {
      addMissingHeadingId(currentNode, slugger)
    })

    visit(tree, 'mdxJsxTextElement', (currentNode) => {
      addMissingHeadingId(currentNode, slugger)
    })
  }
}

function addMissingHeadingId(node: JsxNode, slugger: GithubSlugger): void {
  if (!isNativeJsxHeading(node)) {
    return
  }

  const explicitId = getLiteralJsxAttrValue(node, 'id')
  const text = extractText(node.children)
  const headingId = explicitId || slugger.slug(text)
  if (!explicitId) {
    node.attributes = [...node.attributes, literalAttribute('id', headingId)]
  }
}

function createHeadingNode(node: Heading, id: string): JsxElementNode {
  return createElement({
    name: 'Heading',
    attributes: [
      expressionAttribute('level', numberExpression(node.depth)),
      literalAttribute('id', id),
    ],
    // @ts-expect-error mdast narrows Flow JSX children more than the MDX serializer we emit here.
    children: node.children,
  })
}

function takeExplicitId(node: Heading): string | undefined {
  const idEntries = node.children.flatMap((child, index) => {
    const value = getMaybeIdStringValue(child)
    return value ? [{ index, value }] : []
  })

  if (idEntries.length === 0) {
    return undefined
  }
  if (idEntries.length > 1) {
    throw new Error(`Found ${idEntries.length} ids under heading ${node.depth}.`)
  }

  const idEntry = idEntries[0]
  if (!idEntry) {
    return undefined
  }

  const nodeIndex = idEntry.index
  if (nodeIndex >= 1) {
    const previous = node.children[nodeIndex - 1]
    if (previous?.type === 'text') {
      previous.value = previous.value.trimEnd()
    }
  }
  node.children.splice(nodeIndex, 1)
  return idEntry.value
}

function getMaybeIdStringValue(node: object): string | undefined {
  const childType = Reflect.get(node, 'type')
  const childValue = Reflect.get(node, 'value')
  return childType === 'idString' && typeof childValue === 'string' ? childValue : undefined
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

type TextLikeNode = {
  type?: string
  value?: string
  children?: readonly TextLikeNode[]
}

function extractText(children: readonly TextLikeNode[]): string {
  return children
    .map((child) => {
      if (child.type === 'text' && typeof child.value === 'string') {
        return child.value
      }
      if (child.children) {
        return extractText(child.children)
      }
      return ''
    })
    .join('')
}
