import { type TableOfContents } from 'fumadocs-core/server'
import Slugger from 'github-slugger'
import type { Heading, Root } from 'mdast'
import { toString } from 'mdast-util-to-string'
import { visit } from 'unist-util-visit'

const slugs = new Slugger()

interface TocOptions {
    maxDepth?: number
    minDepth?: number
    skip?: string
}

/**
 * Generate a Table of Contents from a remark mdast tree.
 * @param {Nodes} tree - The mdast tree to process.
 * @param {TocOptions} options - Configuration options for TOC generation.
 * @returns {TableOfContents} - The generated table of contents.
 */
export function generateToc(
    tree: Root,
    options: TocOptions = {},
): TableOfContents {
    const { maxDepth = 6, minDepth = 1, skip } = options
    const skipRegex = skip ? new RegExp(`^(${skip})$`, 'i') : undefined
    const toc: TableOfContents = []

    slugs.reset()

    visit(tree, 'heading', (node: Heading) => {
        if (node.depth < minDepth || node.depth > maxDepth) {
            return
        }

        const title = toString(node, { includeImageAlt: false })
        if (skipRegex && skipRegex.test(title)) {
            return
        }

        // @ts-expect-error hProperties from mdast-util-to-hast
        const id = node.data?.hProperties?.id || title
        const url = `#${slugs.slug(id)}`

        toc.push({
            title,
            url,
            depth: node.depth,
        })
    })

    return toc
}
