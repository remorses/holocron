import { diffWords, Change } from 'diff'
import type { Root, Node, Parent, Text as TextNode, Data } from 'mdast'

declare module 'mdast' {
    export interface HProperties {
        id?: string
        'data-added'?: string | boolean
    }
    export interface Data {
        hProperties?: HProperties
    }
}

/**
 * Interface for added ranges in the markdown text
 */
interface AddedRange {
    start: number
    end: number
}

/**
 * Diffs two markdown strings and marks nodes in a remark AST that were added.
 *
 * This function uses a string diffing library to find added portions of text,
 * then traverses the AST and marks nodes that fall within added ranges.
 *
 * Key behaviors:
 * - Uses diffWords from the 'diff' library to find added sequences of characters
 * - Traverses the new AST tree and inspects node position attributes
 * - Marks nodes with data.hProperties['data-added'] = true if they're in added portions
 * - For text nodes: splits them if only part of the text was added
 * - For other nodes: marks them as added only if the entire node is within an added range
 * - Parent nodes are marked as added if their entire content is added
 * - Only text nodes are split (not bold, emphasis, inline code, etc.)
 *
 * The hProperties field is used as it's the standard way to pass HTML properties
 * through the remark/rehype ecosystem, particularly useful for rendering.
 *
 * @param oldMarkdown - The previous markdown content as a string
 * @param newMarkdown - The new markdown content as a string
 * @param ast - The remark AST of the new content (Root node)
 * @returns The modified AST with added nodes marked
 */
export function markAddedNodes(diffs: Change[], ast: Root): Root {
    // Convert diffs to offset ranges for added portions
    // We need to track the character offsets in the new markdown
    const addedRanges: AddedRange[] = []
    let currentOffset = 0

    for (const diff of diffs) {
        if (diff.added) {
            // This portion was added, record its range
            addedRanges.push({
                start: currentOffset,
                end: currentOffset + diff.value.length,
            })
        }
        // Only increment offset for content that exists in the new markdown
        // (added content and unchanged content, not removed content)
        if (!diff.removed) {
            currentOffset += diff.value.length
        }
    }

    /**
     * Helper function to check if an entire range is within any added range.
     * This is used for non-text nodes to determine if they should be marked as added.
     */
    function isRangeFullyAdded(start: number, end: number): boolean {
        return addedRanges.some(
            (range) => start >= range.start && end <= range.end,
        )
    }

    /**
     * Helper function to find which portions of a range overlap with added ranges.
     * This is used for text nodes to determine which parts need to be split out.
     *
     * @returns Array of portions that overlap with added ranges
     */
    function getAddedPortions(
        start: number,
        end: number,
        text: string,
    ): Array<{
        start: number
        end: number
        text: string
    }> {
        const portions: Array<{ start: number; end: number; text: string }> = []

        for (const range of addedRanges) {
            // Check if this added range overlaps with our node's range
            if (range.start < end && range.end > start) {
                // Calculate the overlap
                const overlapStart = Math.max(range.start, start)
                const overlapEnd = Math.min(range.end, end)

                // Convert global offsets to text-relative positions
                const textStart = overlapStart - start
                const textEnd = overlapEnd - start

                portions.push({
                    start: textStart,
                    end: textEnd,
                    text: text.substring(textStart, textEnd),
                })
            }
        }

        return portions
    }

    /**
     * Helper function to split a text node based on added portions.
     *
     * This handles the edge case where only part of a text node is added.
     * For example, if we have "Hello world" and only "world" was added,
     * this will split it into two text nodes: "Hello " (not added) and "world" (added).
     *
     * Only applies to text nodes - other inline nodes like emphasis, strong,
     * and inlineCode are not split even if partially added.
     */
    function splitTextNode(node: TextNode & Node): (TextNode & Node)[] {
        const text = node.value
        const nodeStart = node.position!.start.offset!
        const nodeEnd = node.position!.end.offset!

        const addedPortions = getAddedPortions(nodeStart, nodeEnd, text)

        if (addedPortions.length === 0) {
            // No added portions, return the node as-is
            return [node]
        }

        // Check if entire node is added
        if (isRangeFullyAdded(nodeStart, nodeEnd)) {
            // Entire node is added, mark it and return
            node.data = node.data || {}
            node.data.hProperties = node.data.hProperties || {}
            node.data.hProperties['data-added'] = true
            return [node]
        }

        // Need to split the text node
        const nodes: (TextNode & Node)[] = []
        let lastEnd = 0

        // Sort portions by start position to process them in order
        addedPortions.sort((a, b) => a.start - b.start)

        for (const portion of addedPortions) {
            // Add non-added text before this portion
            if (portion.start > lastEnd) {
                const beforeText = text.substring(lastEnd, portion.start)
                const beforeNode: TextNode & Node = {
                    type: 'text',
                    value: beforeText,
                    position: {
                        start: {
                            line: node.position!.start.line,
                            column: node.position!.start.column + lastEnd,
                            offset: nodeStart + lastEnd,
                        },
                        end: {
                            line: node.position!.start.line,
                            column: node.position!.start.column + portion.start,
                            offset: nodeStart + portion.start,
                        },
                    },
                }
                nodes.push(beforeNode)
            }

            // Add the added portion with data-added marker
            const addedNode: TextNode & Node = {
                type: 'text',
                value: portion.text,
                data: {
                    hProperties: {
                        'data-added': true,
                    },
                },
                position: {
                    start: {
                        line: node.position!.start.line,
                        column: node.position!.start.column + portion.start,
                        offset: nodeStart + portion.start,
                    },
                    end: {
                        line: node.position!.start.line,
                        column: node.position!.start.column + portion.end,
                        offset: nodeStart + portion.end,
                    },
                },
            }
            nodes.push(addedNode)

            lastEnd = portion.end
        }

        // Add remaining non-added text after the last added portion
        if (lastEnd < text.length) {
            const remainingText = text.substring(lastEnd)
            const remainingNode: TextNode & Node = {
                type: 'text',
                value: remainingText,
                position: {
                    start: {
                        line: node.position!.start.line,
                        column: node.position!.start.column + lastEnd,
                        offset: nodeStart + lastEnd,
                    },
                    end: {
                        line: node.position!.end.line,
                        column: node.position!.end.column,
                        offset: nodeEnd,
                    },
                },
            }
            nodes.push(remainingNode)
        }

        return nodes
    }

    /**
     * Recursively walk the AST and mark added nodes.
     *
     * This function:
     * - Processes leaf nodes (text, code, etc.) to check if they're added
     * - Handles the special case of text nodes that may need splitting
     * - Marks parent nodes as added if their entire range is within an added range
     * - Works with MDX nodes as well as standard markdown nodes
     *
     * @param node - Current node being processed
     * @param parent - Parent node (used for replacing split text nodes)
     * @param index - Index of current node in parent's children
     * @returns Number of extra nodes added (for split text nodes)
     */
    function walk(
        node: Node,
        parent: Parent | null = null,
        index: number | null = null,
    ): number {
        // Skip nodes without position information
        if (
            !node ||
            !node.position ||
            typeof node.position.start.offset !== 'number' ||
            typeof node.position.end.offset !== 'number'
        ) {
            return 0
        }

        const nodeStart = node.position.start.offset
        const nodeEnd = node.position.end.offset

        // Special handling for text nodes - they can be split if partially added
        if (node.type === 'text' && parent && index !== null) {
            const textNode = node as TextNode & Node
            const splitNodes = splitTextNode(textNode)

            if (splitNodes.length > 1) {
                // Replace the single text node with split nodes
                parent.children.splice(index, 1, ...splitNodes)
                return splitNodes.length - 1 // Return how many extra nodes were added
            }
        }

        // For non-text nodes (including parent nodes and inline nodes like
        // emphasis, strong, inlineCode), mark as added only if the entire
        // node content falls within an added range
        if (node.type !== 'text') {
            if (isRangeFullyAdded(nodeStart, nodeEnd)) {
                node.data = node.data || {}
                node.data.hProperties = node.data.hProperties || {}
                node.data.hProperties['data-added'] = true
            }
        }

        // Recursively process children if this is a parent node
        if ('children' in node && Array.isArray(node.children)) {
            let i = 0
            while (i < node.children.length) {
                const child = node.children[i] as Node
                const extraNodes = walk(child, node as Parent, i)
                i += 1 + extraNodes // Skip past any newly added split nodes
            }
        }

        return 0
    }

    // Walk the AST starting from the root
    walk(ast as Node)

    // Second pass: Clone root-level nodes that contain added content
    // to avoid maintaining object identity
    function hasAddedContent(node: Node): boolean {
        // Check if this node itself is marked as added
        if (node.data?.hProperties?.['data-added']) {
            return true
        }
        
        // Check if any children have added content
        if ('children' in node && Array.isArray(node.children)) {
            return node.children.some(child => hasAddedContent(child as Node))
        }
        
        return false
    }

    // Clone root-level children that contain added content
    ast.children = ast.children.map(child => {
        if (hasAddedContent(child as Node)) {
            return structuredClone(child)
        }
        return child
    })

    return ast
}

// Example usage:
/*
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';

const processor = unified()
  .use(remarkParse)
  .use(remarkMdx); // If using MDX

const oldMarkdown = "# Hello\n\nSome text.";
const newMarkdown = "# Hello World\n\nSome new text.";

const ast = processor.parse(newMarkdown);
const markedAst = markAddedNodes(oldMarkdown, newMarkdown, ast);

// Now markedAst has nodes marked with data.hProperties['data-added'] = true
*/
