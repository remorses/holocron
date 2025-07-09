import { StructureOptions } from 'fumadocs-core/mdx-plugins/remark-structure'
import Slugger from 'github-slugger'
import type { Nodes, Root, RootContent, Content } from 'mdast'
import type {
    MdxJsxAttribute,
    MdxJsxExpressionAttribute,
    MdxJsxFlowElement,
} from 'mdast-util-mdx-jsx'
import type { Processor, Transformer } from 'unified'
import { visit } from 'unist-util-visit'

export interface Heading {
    id: string
    content: string
    line?: number
}

export interface StructuredContent {
    heading: string | undefined
    content: string
    line?: number
}

export interface StructuredData {
    headings: Heading[]
    contents: StructuredContent[]
}


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

export function flattenNode(node: any): string {
    if ('children' in node) {
        return node.children.map((child: any) => flattenNode(child)).join('')
    }

    // Handle links - include href for context along with child text
    if (node.type === 'link' && node.url) {
        const childText = node.children ? node.children.map((child: any) => flattenNode(child)).join('') : ''
        return `${childText} ${node.url}`.trim()
    }

    // Handle link references - include identifier for context
    if (node.type === 'linkReference' && node.identifier) {
        const childText = node.children ? node.children.map((child: any) => flattenNode(child)).join('') : ''
        return `${childText} ${node.identifier}`.trim()
    }

    // Handle images - include alt text and title
    if (node.type === 'image') {
        const parts: string[] = []
        if (node.alt) parts.push(node.alt)
        if (node.title) parts.push(node.title)
        if (node.url) parts.push(node.url)
        return parts.join(' ')
    }

    // Handle image references - include alt text and identifier
    if (node.type === 'imageReference') {
        const parts: string[] = []
        if (node.alt) parts.push(node.alt)
        if (node.identifier) parts.push(node.identifier)
        return parts.join(' ')
    }

    // Handle definitions - include identifier, url, and title for search context
    if (node.type === 'definition') {
        const parts: string[] = []
        if (node.identifier) parts.push(node.identifier)
        if (node.url) parts.push(node.url)
        if (node.title) parts.push(node.title)
        return parts.join(' ')
    }

    // Handle footnote references
    if (node.type === 'footnoteReference' && node.identifier) {
        return node.identifier
    }

    // Handle YAML frontmatter
    if (node.type === 'yaml' && node.value) {
        return node.value
    }

    // Handle HTML nodes - extract text content but not tags
    if (node.type === 'html' && node.value) {
        // Simple text extraction from HTML, removing tags
        return node.value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    }

    // Handle all other nodes with value (text, code, inlineCode, etc.)
    if ('value' in node) {
        return node.value
    }

    return ''
}

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
                const content = flattenNode(element)
                const id = properties.id ?? slugger.slug(content)

                data.headings.push({
                    id,
                    content,
                    line: element.position?.start?.line,
                })

                lastHeading = id
                return 'skip'
            }

            if (element.data?._string) {
                for (const content of element.data._string) {
                    data.contents.push({
                        heading: lastHeading,
                        content,
                        line: element.position?.start?.line,
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
                            line: element.position?.start?.line,
                        }
                    }),
                )

                return
            }

            const content = flattenNode(element).trim()
            if (content.length === 0) return

            data.contents.push({
                heading: lastHeading,
                content,
                line: element.position?.start?.line,
            })

            return 'skip'
        })

        file.data.structuredData = data
    }
}
