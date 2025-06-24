import { diffWordsWithSpace } from "diff"
import { processMdxInClient } from "./markdown-runtime"

/**
 * Optimizes markdown AST generation by reusing unchanged nodes from previous AST.
 * Uses diffWords to identify changed sections and only re-parses those sections.
 *
 * @param options - Configuration object
 * @returns Array of AST nodes (children of root)
 */
export function getOptimizedMarkdownAst({
    markdown,
    previousMarkdown,
    previousAst,
    extension = 'mdx',
}: {
    markdown: string
    previousMarkdown?: string
    previousAst?: any
    extension?: string
}): any[] {
    // If we have previousAst and previous markdown, try to optimize
    if (
        previousAst &&
        previousMarkdown &&
        markdown &&
        markdown !== previousMarkdown
    ) {
        console.time('optimized AST generation')

        // Diff the markdown to find changed ranges

        const diffs = diffWordsWithSpace(previousMarkdown, markdown)
        const changedRanges: Array<{ start: number; end: number }> = []
        let currentOffset = 0

        for (const diff of diffs) {
            if (diff.added || diff.removed) {
                changedRanges.push({
                    start: currentOffset,
                    end: currentOffset + (diff.added ? diff.value.length : 0),
                })
            }
            if (!diff.removed) {
                currentOffset += diff.value.length
            }
        }

        // If no changes, reuse the entire previous AST
        if (changedRanges.length === 0) {
            console.timeEnd('optimized AST generation')
            return previousAst.children || []
        }

        // Check which root-level nodes can be reused
        const optimizedNodes: any[] = []
        const previousNodes = previousAst.children || []

        for (let i = 0; i < previousNodes.length; i++) {
            const node = previousNodes[i]

            // Check if this node's range overlaps with any changed ranges
            if (
                node.position?.start?.offset !== undefined &&
                node.position?.end?.offset !== undefined
            ) {
                const nodeStart = node.position.start.offset
                const nodeEnd = node.position.end.offset

                const hasChanges = changedRanges.some(
                    (range) =>
                        !(nodeEnd <= range.start || nodeStart >= range.end),
                )

                if (!hasChanges) {
                    // Node is unchanged, reuse it
                    optimizedNodes.push(node)
                } else {
                    // Node has changes, need to re-parse this section
                    const sectionStart = nodeStart
                    const sectionEnd = nodeEnd
                    const sectionMarkdown = markdown.slice(
                        sectionStart,
                        sectionEnd,
                    )

                    try {
                        const { ast: sectionAst } = processMdxInClient({
                            extension,
                            markdown: sectionMarkdown,
                        })
                        if (sectionAst?.children) {
                            optimizedNodes.push(...sectionAst.children)
                        }
                    } catch (sectionErr) {
                        // If section parsing fails, fall back to reusing the old node
                        console.warn(
                            'Section parsing failed, reusing old node:',
                            sectionErr,
                        )
                        optimizedNodes.push(node)
                    }
                }
            } else {
                // Node without position info, reuse it
                optimizedNodes.push(...node.children)
            }
        }

        console.timeEnd('optimized AST generation')
        return optimizedNodes
    }

    // Fallback to full parsing
    if (!markdown) return []
    const { ast } = processMdxInClient({ extension, markdown })
    return ast?.children || []
}
