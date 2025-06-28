import type { Code, Root } from 'mdast'
import type { Transformer } from 'unified'
import { visit } from 'unist-util-visit'

export type RemarkInstallOptions = Partial<{
    Tabs: string
    Tab: string

    /**
     * Persist Tab value (Fumadocs UI only)
     *
     * @defaultValue false
     */
    persist?:
        | {
              id: string
          }
        | false
}>

export function remarkCodeGroup({
    Tab = 'Tab',
    Tabs = 'Tabs',
    persist = false,
}: RemarkInstallOptions = {}): Transformer<Root, Root> {
    return (tree) => {
        visit(tree, 'mdxJsxFlowElement', (node, index, parent) => {
            if (
                node.type !== 'mdxJsxFlowElement' ||
                node.name !== 'CodeGroup' ||
                !Array.isArray(node.children)
            ) {
                return
            }

            // Find all code blocks directly under this <CodeGroup>
            const tabBlocks: { title: string; code: Code }[] = []

            for (const child of node.children) {
                if (child.type === 'code') {
                    const meta = child.meta || ''
                    const { title } = parseMetaString(meta) || {}
                    tabBlocks.push({
                        title: title || child.lang || 'Code',
                        code: child,
                    })
                }
            }

            if (tabBlocks.length === 0) return

            const newNode = createElement(
                Tabs,
                [
                    ...(typeof persist === 'object'
                        ? [
                              {
                                  type: 'mdxJsxAttribute',
                                  name: 'groupId',
                                  value: persist.id,
                              },
                              {
                                  type: 'mdxJsxAttribute',
                                  name: 'persist',
                                  value: null,
                              },
                          ]
                        : []),
                    {
                        type: 'mdxJsxAttribute',
                        name: 'items',
                        value: {
                            type: 'mdxJsxAttributeValueExpression',
                            value: `[${tabBlocks.map((block) => JSON.stringify(block.title)).join(', ')}]`,
                        },
                    },
                ],
                tabBlocks.map((block) => ({
                    type: 'mdxJsxFlowElement',
                    name: Tab,
                    attributes: [
                        {
                            type: 'mdxJsxAttribute',
                            name: 'value',
                            value: block.title,
                        },
                    ],
                    children: [
                        {
                            ...block.code,
                            type: 'code',
                            lang: block.code.lang,
                            meta: '',
                            value: block.code.value,
                        } satisfies Code,
                    ],
                })),
            )

            // Replace the current CodeGroup node with newNode
            if (parent && typeof index === 'number') {
                parent.children.splice(index, 1, newNode as any)
            }
        })
    }
}

import type { Expression, Program } from 'estree'
import { parseMetaString } from './mdx-code-block'

export function createElement(
    name: string,
    attributes: object[],
    children?: unknown,
): object {
    const element: Record<string, unknown> = {
        type: 'mdxJsxFlowElement',
        name,
        attributes,
    }

    if (children) element.children = children

    return element
}

export function expressionToAttribute(key: string, value: Expression): object {
    return {
        type: 'mdxJsxAttribute',
        name: key,
        value: {
            type: 'mdxJsxAttributeValueExpression',
            data: {
                estree: {
                    type: 'Program',
                    body: [
                        {
                            type: 'ExpressionStatement',
                            expression: value,
                        },
                    ],
                } as Program,
            },
        },
    }
}
