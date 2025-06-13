import memoize from 'micro-memoize'
import remarkFrontmatter from 'remark-frontmatter'

import YAML from 'js-yaml'
import { remarkMarkAndUnravel } from 'safe-mdx'

import {
    transformerNotationDiff,
    transformerNotationHighlight,
    transformerNotationWordHighlight,
} from '@shikijs/transformers'
import * as mdxPluginsFumadocs from 'fumadocs-core/mdx-plugins'
import { } from 'js-yaml'
import { Heading, Root } from 'mdast'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import { createHighlighter, Highlighter } from 'shiki'
import { bundledLanguages } from 'shiki/langs'; // every grammar object

import { visit } from 'unist-util-visit'
import { remarkGitHubBlockquotes } from './github-blockquotes'

import { StructuredData } from 'fumadocs-core/mdx-plugins'
import { DocumentRecord } from 'fumadocs-core/search/algolia'

export type { DocumentRecord, StructuredData }

const remarkCodeToHtml = (highlighter: Highlighter) => () => {
    return (tree: Root) => {
        visit(tree, 'code', (node) => {
            const language = node.lang || 'text'

            const html = highlighter.codeToHtml(node.value, {
                lang: language,
                // theme: 'github-dark',

                themes: {
                    light: 'github-light',
                    dark: 'github-dark',
                },
                // experimentalJSEngine: false,
                defaultColor: false,
                transformers: [
                    transformerNotationHighlight({
                        matchAlgorithm: 'v3',
                    }),
                    transformerNotationWordHighlight({
                        matchAlgorithm: 'v3',
                    }),
                    transformerNotationDiff({
                        matchAlgorithm: 'v3',
                    }),
                    // transformerNotationFocus({
                    //     matchAlgorithm: 'v3',
                    // }),
                ],
            })

            node.data ||= {}
            node.data.html = html
        })

        return tree
    }
}

declare module 'mdast' {
    interface CodeData {
        html?: string
    }
}

const remarkExtractFirstHeading = () => {
    return (tree: Root, file: any) => {
        if (!file.data) {
            file.data = {}
        }

        // Find the first h1 heading
        const nodes = tree.children
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i]
            if (node.type === 'heading' && (node as Heading).depth === 1) {
                // Extract title from the heading
                let title = ''
                visit(node, 'text', (textNode) => {
                    title += textNode.value
                })

                // Store the title in file data
                file.data.title = title.trim()

                // Remove the heading from the tree
                nodes.splice(i, 1)
                break
            }
        }

        return tree
    }
}

export const getProcessor = memoize(async function getProcessor(
    extension?: string,
) {
    const highlighter = await createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: Object.keys(bundledLanguages),
    })

    if (typeof extension === 'string' && extension.endsWith('mdx')) {
        return (
            remark()
                .use(remarkMdx)
                .use(remarkFrontmatter, ['yaml'])
                .use(mdxPluginsFumadocs.remarkGfm)
                .use(remarkGitHubBlockquotes)
                .use(mdxPluginsFumadocs.remarkAdmonition)
                .use(mdxPluginsFumadocs.remarkCodeTab)
                .use(mdxPluginsFumadocs.remarkHeading)
                // .use(mdxPluginsFumadocs.remarkImage)
                .use(mdxPluginsFumadocs.remarkSteps)
                .use(mdxPluginsFumadocs.remarkStructure)
                .use(remarkMarkAndUnravel)
                .use(remarkCodeToHtml(highlighter))
                .use(remarkExtractFirstHeading)
                .use(() => {
                    return (tree, file) => {
                        file.data.ast = tree
                    }
                })
        )
    } else {
        return (
            remark()
                // .use(remarkMdx)
                .use(remarkFrontmatter, ['yaml'])
                .use(mdxPluginsFumadocs.remarkGfm)
                // .use(remarkGitHubBlockquotes) // TODO remarkGitHubBlockquotes cannot be stringified later because the mdx ast nodes are not valid md
                .use(mdxPluginsFumadocs.remarkAdmonition)
                .use(mdxPluginsFumadocs.remarkCodeTab)
                .use(mdxPluginsFumadocs.remarkHeading)
                // .use(mdxPluginsFumadocs.remarkImage)
                .use(mdxPluginsFumadocs.remarkSteps)
                .use(mdxPluginsFumadocs.remarkStructure)
                // .use(remarkMarkAndUnravel)
                .use(remarkCodeToHtml(highlighter))
                .use(remarkExtractFirstHeading)
                .use(() => {
                    return (tree, file) => {
                        file.data.ast = tree
                    }
                })
        )
    }
})
type ProcessorData = {
    title?: string
    description?: string
    ast: Root
    frontmatter: Record<string, any>
    frontmatterYaml?: string
    structuredData: mdxPluginsFumadocs.StructuredData
}

export async function processMdx({
    markdown: mdx,
    extension,
}: {
    markdown: string
    extension?: string
}) {
    const processor = await getProcessor(extension)
    const file = processor.processSync(mdx)
    const data = file.data as ProcessorData
    const frontmatterYaml = data.ast?.children.find(
        (node) => node.type === 'yaml',
    )?.value
    let frontmatter: Record<string, any> = {}
    if (frontmatterYaml) {
        frontmatter = YAML.load(frontmatterYaml) as any
    }
    let title = data.title
    let description
    if (typeof frontmatter.description === 'string') {
        description = frontmatter.description
    }
    if (typeof frontmatter.title === 'string') {
        title = frontmatter.title
    }
    return {
        data: {
            ...data,

            title,
            description,
            frontmatter,
            frontmatterYaml: frontmatterYaml || '',
        },
    }
}
