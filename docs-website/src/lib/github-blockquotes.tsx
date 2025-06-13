// https://github.com/jaywcjlove/remark-github-blockquote-alert (modified to use MDX Callout component)
import type { PhrasingContent, Root } from 'mdast'
import { MdxJsxFlowElement } from 'mdast-util-mdx-jsx'
import { visit } from 'unist-util-visit'

const alertRegex = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i
const alertLegacyRegex = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)(\/.*)?\]/i

type Option = {
    /**
     * Use the legacy title format, which includes a slash and a title after the alert type.
     *
     * Enabling legacyTitle allows modifying the title, but this is not GitHub standard.
     */
    legacyTitle?: boolean
}

/**
 * Alerts are a Markdown extension based on the blockquote syntax that you can use to emphasize critical information.
 * On GitHub, they are displayed with distinctive colors and icons to indicate the significance of the content.
 * This version converts them to MDX Callout components.
 * https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts
 */
export const remarkGitHubBlockquotes = ({ legacyTitle = false } = {}) => {
    return (tree: Root) => {
        visit(tree, 'blockquote', (node, index, parent) => {
            let alertType = ''
            let title = ''
            let isNext = true
            let child = node.children.map((item) => {
                if (isNext && item.type === 'paragraph') {
                    const firstNode = item.children[0]
                    const text =
                        firstNode.type === 'text' ? firstNode.value : ''
                    const reg = legacyTitle ? alertLegacyRegex : alertRegex
                    const match = text.match(reg)
                    if (match) {
                        isNext = false
                        alertType = match[1].toLocaleLowerCase()
                        title = legacyTitle
                            ? match[2] || alertType.toLocaleUpperCase()
                            : alertType.toLocaleUpperCase()
                        if (text.includes('\n')) {
                            item.children[0] = {
                                type: 'text',
                                value: text
                                    .replace(reg, '')
                                    .replace(/^\n+/, ''),
                            }
                        }

                        if (!text.includes('\n')) {
                            const itemChild: Array<PhrasingContent> = []
                            item.children.forEach((item, idx) => {
                                if (idx == 0) return
                                if (idx == 1 && item.type === 'break') {
                                    return
                                }
                                itemChild.push(item)
                            })
                            item.children = [...itemChild]
                        }
                    }
                }
                return item
            })

            if (!!alertType && parent && typeof index === 'number') {
                // Filter out any empty paragraphs

                // Create a new MDX JSX flow element instead of mutating the node
                const mdxElement: MdxJsxFlowElement = {
                    type: 'mdxJsxFlowElement',
                    name: 'Callout',
                    attributes: [
                        {
                            type: 'mdxJsxAttribute',
                            name: 'type',
                            value: alertType,
                        },
                        // {
                        //     type: 'mdxJsxAttribute',
                        //     name: 'title',
                        //     value: title.replace(/^\//, ''),
                        // },
                    ],
                    children: child.filter((x) => x.type !== 'definition'),
                    position: node.position,
                    data: node.data,
                }

                // Replace the node in the parent's children array
                parent.children[index] = mdxElement
            }
        })
    }
}
