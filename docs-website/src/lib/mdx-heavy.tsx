import remarkFrontmatter from 'remark-frontmatter'
import { Parser } from 'acorn'
import { LooseParser } from 'acorn-loose'
import acornJsx from 'acorn-jsx'

import { TOCItemType } from 'fumadocs-core/server'

import { trySync } from './utils'
import {
    remarkCodeGroup,
    remarkMermaidCode,
    remarkSingleAccordionItems,
} from './remark-plugins'
import remarkStringify from 'remark-stringify'

import { remarkInstall } from 'fumadocs-docgen'

import YAML from 'js-yaml'
import { RenderNode } from 'safe-mdx'
import { remarkMarkAndUnravel } from 'safe-mdx/parse'

import {
    transformerNotationDiff,
    transformerNotationHighlight,
    transformerNotationWordHighlight,
} from '@shikijs/transformers'
import { remarkAdmonition } from 'fumadocs-core/mdx-plugins/remark-admonition'
import { remarkCodeTab } from 'fumadocs-core/mdx-plugins/remark-code-tab'
import { remarkHeading } from 'fumadocs-core/mdx-plugins/remark-heading'
import { remarkSteps } from 'fumadocs-core/mdx-plugins/remark-steps'
import { StructureOptions } from 'fumadocs-core/mdx-plugins/remark-structure'
import {} from 'js-yaml'
import { Heading, Root } from 'mdast'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import { Highlighter } from 'shiki'

import { visit } from 'unist-util-visit'
import { remarkGitHubBlockquotes } from './github-blockquotes'

import { DocumentRecord } from 'fumadocs-core/search/algolia'
import { remarkStructure, StructuredData } from './remark-structure'

export type { DocumentRecord, StructuredData }

export type OnMissingLanguage = (h: Highlighter, lang: string) => any

const remarkCodeToHtml =
    ({
        highlighter,
        onMissingLanguage,
    }: {
        highlighter?: Highlighter
        onMissingLanguage?: OnMissingLanguage
    }) =>
    () => {
        return (tree: Root) => {
            visit(tree, 'code', (node) => {
                const language = node.lang || 'text'

                if (!highlighter) {
                    return
                }
                if (!onMissingLanguage) {
                    return
                }

                if (!trySync(() => highlighter.getLanguage(language))?.data) {
                    onMissingLanguage(highlighter, language)
                }

                let html = '\n'
                try {
                    html = highlighter.codeToHtml(node.value, {
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
                } catch (e: any) {
                    if (
                        e.messages?.includes(
                            `not found, you may need to load it first`,
                        )
                    ) {
                        onMissingLanguage(highlighter, language)
                    }
                    html = highlighter.codeToHtml(node.value, {
                        lang: 'plaintext',
                        themes: {
                            light: 'github-light',
                            dark: 'github-dark',
                        },
                        defaultColor: false,
                    })
                }

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

const injectData = () => {
    return (tree, file) => {
        if (!file.data) file.data = {}
        const data: ProcessorData = file.data
        data.ast = tree
        const frontmatterYaml = data.ast?.children.find(
            (node) => node.type === 'yaml',
        )?.value
        let frontmatter: Record<string, any> = {}
        if (frontmatterYaml) {
            frontmatter = YAML.load(frontmatterYaml) as any
        }
        data.frontmatter = frontmatter
        if (!frontmatter.title && data.title) {
            frontmatter.title = data.title
        }
        if (!data.title && frontmatter.title) {
            data.title = frontmatter.title
        }
    }
}

function looseAcorn() {
    const real = Parser.extend(acornJsx())

    // dummy nodes you’re OK with:
    const DUMMY_PROGRAM = { type: 'Program', body: [], sourceType: 'module' }
    const DUMMY_EXPR = { type: 'Identifier', name: '__invalid__' }

    const tolerantAcorn = {
        parse(source, opts) {
            try {
                return real.parse(source, opts)
            } catch (_) {
                return DUMMY_PROGRAM // ← swallow ESM errors
            }
        },
        parseExpressionAt(source, pos, opts) {
            try {
                return real.parseExpressionAt(source, pos, opts)
            } catch (_) {
                return DUMMY_EXPR // ← swallow inline/attr errors
            }
        },
    }
    return tolerantAcorn
}

export const getProcessor = function getProcessor({
    extension,
    onMissingLanguage,
    highlighter,
}: {
    extension: string | undefined
    highlighter?: Highlighter
    onMissingLanguage?: OnMissingLanguage
}) {
    const structureOptions: StructureOptions = {
        types(node) {
            if (node.type === 'yaml') return false
            // Ignore additional MDX nodes that shouldn't be treated as structure content
            if (
                node.type === 'mdxFlowExpression' ||
                node.type === 'mdxTextExpression' ||
                node.type === 'mdxjsEsm'
            )
                return false
            return true
        },
        allowedMdxAttributes(node, attribute) {
            let attrValue = attribute.value?.toString() || ''
            return attrValue.length > 10
        },
    }

    if (typeof extension === 'string' && extension.endsWith('md')) {
        return remark()
            .use(remarkFrontmatter, ['yaml'])
            .use(remarkGfm)
            .use(remarkCodeTab)
            .use(remarkHeading)
            .use(remarkCodeToHtml({ highlighter, onMissingLanguage }))
            .use(remarkExtractFirstHeading)
            .use(injectData)
            .use(remarkStringify)
            .use(remarkStructure, structureOptions)
    } else {
        return (
            remark()
                .use(remarkAdmonition)
                .use(remarkMdx)
                .use(remarkFrontmatter, ['yaml'])
                .use(remarkGfm)
                .use(remarkGitHubBlockquotes)
                .use(remarkCodeTab)
                .use(remarkHeading)
                // .use(mdxPluginsFumadocs.remarkImage)
                .use(remarkSteps)
                .use(remarkInstall)
                .use(remarkMarkAndUnravel)
                .use(remarkCodeToHtml({ highlighter, onMissingLanguage }))
                .use(remarkExtractFirstHeading)
                .use(injectData)
                .use(remarkCodeGroup)
                .use(remarkMermaidCode)
                .use(remarkSingleAccordionItems)
                .use(remarkStringify)
                .use(remarkStructure, structureOptions)
        )
    }
}

export interface ProcessorDataFrontmatter {
    title?: string
    description?: string
    icon?: string
    // full?: boolean // hides the table of contents
    badge?: {
        content?: string
        color?: string
    }
    [key: string]: any
}

export type ProcessorData = {
    title?: string
    // description?: string
    ast: Root
    toc: TOCItemType[]
    frontmatter: ProcessorDataFrontmatter
    frontmatterYaml?: string
    structuredData: StructuredData
}
