import remarkFrontmatter from 'remark-frontmatter'
import YAML from 'js-yaml'
import { remarkMarkAndUnravel } from 'safe-mdx'

import { createStyleTransformer } from 'fumadocs-core/highlight'
import * as mdxPluginsFumadocs from 'fumadocs-core/mdx-plugins'
import { remark } from 'remark'
import remarkMdx from 'remark-mdx'
import { codeToHtml } from 'shiki'
import {} from 'js-yaml'
import {
    transformerNotationDiff,
    transformerNotationHighlight,
    transformerNotationWordHighlight,
} from '@shikijs/transformers'
import { Root, Heading } from 'mdast'
import { visit } from 'unist-util-visit'
import { remarkGitHubBlockquotes } from './github-blockquotes'
import { notifyError } from './sentry'

import { DocumentRecord } from 'fumadocs-core/search/algolia'
import { StructuredData } from 'fumadocs-core/mdx-plugins'

export type { DocumentRecord, StructuredData }

const remarkCodeToHtml = () => {
    return async (tree: Root) => {
        const promises: Promise<void>[] = []

        visit(tree, 'code', (node) => {
            const language = node.lang || 'text'

            const promise = codeToHtml(node.value, {
                lang: language,
                // theme: 'github-dark',

                themes: {
                    light: 'github-light',
                    dark: 'github-dark',
                },
                defaultColor: false,
                transformers: [
                    createStyleTransformer(),
                    transformerNotationHighlight({
                        matchAlgorithm: 'v3',
                    }),
                    transformerNotationWordHighlight({
                        matchAlgorithm: 'v3',
                    }),
                    transformerNotationDiff({
                        matchAlgorithm: 'v3',
                    }),
                ],
            })
                .then((html) => {
                    // node.value = html
                    node.data ||= {}
                    node.data.html = html
                })
                .catch((e) => {
                    notifyError(e, 'shiki code html generation')
                })

            promises.push(promise)
        })

        await Promise.allSettled(promises)
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

export const processorMdx = remark()
    .use(remarkMdx)
    .use(remarkFrontmatter, ['yaml'])
    .use(mdxPluginsFumadocs.remarkGfm)
    .use(remarkGitHubBlockquotes)
    .use(mdxPluginsFumadocs.remarkAdmonition)
    .use(mdxPluginsFumadocs.remarkCodeTab)
    .use(mdxPluginsFumadocs.remarkHeading)
    .use(mdxPluginsFumadocs.remarkImage)
    .use(mdxPluginsFumadocs.remarkSteps)
    .use(mdxPluginsFumadocs.remarkStructure)
    .use(remarkMarkAndUnravel)
    .use(remarkCodeToHtml)
    .use(remarkExtractFirstHeading)
    .use(() => {
        return (tree, file) => {
            file.data.ast = tree
        }
    })
export const processorMd = remark()
    // .use(remarkMdx)
    .use(remarkFrontmatter, ['yaml'])
    .use(mdxPluginsFumadocs.remarkGfm)
    // .use(remarkGitHubBlockquotes) // TODO remarkGitHubBlockquotes cannot be strigified later becaues the mdx ast nodes are not valid md
    .use(mdxPluginsFumadocs.remarkAdmonition)
    .use(mdxPluginsFumadocs.remarkCodeTab)
    .use(mdxPluginsFumadocs.remarkHeading)
    .use(mdxPluginsFumadocs.remarkImage)
    .use(mdxPluginsFumadocs.remarkSteps)
    .use(mdxPluginsFumadocs.remarkStructure)
    // .use(remarkMarkAndUnravel)
    .use(remarkCodeToHtml)

    .use(remarkExtractFirstHeading)
    .use(() => {
        return (tree, file) => {
            file.data.ast = tree
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
    extension?: 'mdx' | 'md'
}) {
    const processor = extension === 'mdx' ? processorMdx : processorMd
    const file = await processor.process(mdx)
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
