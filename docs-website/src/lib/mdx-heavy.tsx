import remarkFrontmatter from 'remark-frontmatter'
import { toHtml } from 'hast-util-to-html'

import { VFile } from 'vfile'

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
import { codeToHast, codeToHtml, createHighlighter, Highlighter } from 'shiki'

import { visit } from 'unist-util-visit'
import { remarkGitHubBlockquotes } from './github-blockquotes'

import { DocumentRecord } from 'fumadocs-core/search/algolia'
import { remarkStructure, StructuredData } from './remark-structure'

export type { DocumentRecord, StructuredData }

export type OnMissingLanguage = (h: Highlighter, lang: string) => any

const remarkCodeToHtml = () => async (tree: Root, file) => {
    const promises: Promise<void>[] = []
    visit(tree, 'code', (node) => {
        const p = (async () => {
            const language = node.lang || 'text'

            // if (!trySync(() => highlighter.getLanguage(language))?.data) {
            //     onMissingLanguage(highlighter, language)
            // }

            node.data ||= {}
            node.data.hProperties ||= {}
            const meta = parseMetaString(node.meta)
            node.data.hProperties = {
                ...node.data.hProperties,
                ...meta,
            }

            let html = '\n'
            try {
                const hast = await codeToHast(node.value, {
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

                console.log(node.data.hProperties)
                console.log(hast)
                // Apply node.data.hProperties to all <pre> elements in the hast tree
                if (hast && node.data && node.data.hProperties) {
                    visit(
                        hast,
                        (el: any) =>
                            typeof el === 'object' &&
                            el !== null &&
                            el.type === 'element' &&
                            el.tagName === 'pre',
                        (preNode: any) => {
                            preNode.properties = {
                                ...(preNode.properties || {}),
                                ...node.data!.hProperties,
                            }
                        },
                    )
                }
                html = toHtml(hast, {})
            } catch (e: any) {
                html = await codeToHtml(node.value, {
                    lang: 'plaintext',
                    themes: {
                        light: 'github-light',
                        dark: 'github-dark',
                    },
                    defaultColor: false,
                })
            }

            node.data.html = html
        })()
        promises.push(p)
    })
    await Promise.all(promises)
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

export function parseMetaString(
    meta: string | null | undefined,
): Record<string, string> {
    if (!meta) {
        return {}
    }

    const map: Record<string, string> = {}

    // If there is no '=', treat the whole meta as a trimmed title
    if (!meta.includes('=')) {
        map['title'] = meta.trim()
        return map
    }

    // Match: key="value", key='value', key=value (no quotes), key (standalone)
    // We'll use a robust regex that matches all patterns
    const metaRegex = /(\w+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g
    let match: RegExpExecArray | null

    while ((match = metaRegex.exec(meta)) !== null) {
        const name = match[1]
        const value = match[2] ?? match[3] ?? match[4]
        // If key is alone (no value at all), treat as boolean true string
        map[name] = value !== undefined ? value : 'true'
    }

    if (map.lineNumbers !== undefined) {
        map['data-line-numbers'] = map['lineNumbers']
        delete map['lineNumbers']
    }

    return map
}

export const getProcessor = function getProcessor({
    extension,
}: {
    extension: string | undefined
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
            .use(remarkCodeToHtml)
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
                .use(remarkCodeToHtml)
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

export function getTocFromMdast(ast) {
    const file = new VFile()
    remark().use(remarkMdx).use(remarkHeading).runSync(ast, file)

    return file.data?.toc as TOCItemType[]
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
