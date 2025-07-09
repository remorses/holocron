import { StructureOptions } from 'fumadocs-core/mdx-plugins/remark-structure'
import Slugger from 'github-slugger'
import type { Nodes, Root } from 'mdast'
import type {
    MdxJsxAttribute,
    MdxJsxExpressionAttribute,
    MdxJsxFlowElement,
} from 'mdast-util-mdx-jsx'
import type { Processor, Transformer } from 'unified'
import { visit } from 'unist-util-visit'
import { StructuredData } from './mdx-heavy'


declare module 'mdast' {
    interface Data {
        /**
         * Get content of unserializable element
         *
         * Needed for `remarkStructure` to generate search index
         */
        _string?: string[]
    }
}

const slugger = new Slugger()

/**
 * Attach structured data to VFile, you can access via `vfile.data.structuredData`.
 */
export function remarkStructure(
    this: Processor,
    {
        types = [
            'heading',
            'paragraph',
            'blockquote',
            'tableCell',
            'mdxJsxFlowElement',
        ],
        allowedMdxAttributes = (node) => {
            if (!node.name) return false

            return ['TypeTable', 'Callout'].includes(node.name)
        },
    }: StructureOptions = {},
): Transformer<Root, Root> {
    if (Array.isArray(allowedMdxAttributes)) {
        const arr = allowedMdxAttributes
        allowedMdxAttributes = (_node, attribute) =>
            attribute.type === 'mdxJsxAttribute' && arr.includes(attribute.name)
    }

    if (Array.isArray(types)) {
        const arr = types
        types = (node) => arr.includes(node.type)
    }

    const processor = this

    return (node, file) => {
        slugger.reset()
        const data: StructuredData = { contents: [], headings: [] }
        let lastHeading: string | undefined = ''

        // Fumadocs OpenAPI Generated Structured Data
        if (file.data.frontmatter) {
            const frontmatter = file.data.frontmatter as {
                _openapi?: {
                    structuredData?: StructuredData
                }
            }

            if (frontmatter._openapi?.structuredData) {
                data.headings.push(
                    ...frontmatter._openapi.structuredData.headings,
                )
                data.contents.push(
                    ...frontmatter._openapi.structuredData.contents,
                )
            }
        }

        visit(node, (element) => {
            if (element.type === 'root') return
            if (!types(element)) return

            if (element.type === 'heading') {
                element.data ||= {}
                element.data.hProperties ||= {}
                const properties = element.data.hProperties
                const content = processor.stringify(element).toString().trim()
                const id = properties.id ?? slugger.slug(content)

                data.headings.push({
                    id,
                    content,
                })

                lastHeading = id
                return 'skip'
            }

            if (element.data?._string) {
                for (const content of element.data._string) {
                    data.contents.push({
                        heading: lastHeading,
                        content,
                    })
                }

                return 'skip'
            }

            if (element.type === 'mdxJsxFlowElement' && element.name) {
                data.contents.push(
                    ...element.attributes.flatMap((attribute) => {
                        const value =
                            typeof attribute.value === 'string'
                                ? attribute.value
                                : attribute.value?.value
                        if (!value || value.length === 0) return []
                        if (
                            allowedMdxAttributes &&
                            !allowedMdxAttributes(element, attribute)
                        )
                            return []

                        return {
                            heading: lastHeading,
                            content:
                                attribute.type === 'mdxJsxAttribute'
                                    ? `${attribute.name}: ${value}`
                                    : value,
                        }
                    }),
                )

                return
            }

            const content = processor.stringify(element).toString().trim()
            if (content.length === 0) return

            data.contents.push({
                heading: lastHeading,
                content,
            })

            return 'skip'
        })

        file.data.structuredData = data
    }
}
