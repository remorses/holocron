import { Root } from 'mdast'
import { processorWithAst } from './simple-processor.js'

/* ─────────── types ─────────── */
interface Offset {
    offset: number
}
interface PosNode {
    position: { start: Offset; end: Offset }
}
export interface SegmentEntry {
    len: number
    hash: number
    end: number
    nodes: any[]
}
export type SegmentCache = Map<number, SegmentEntry>

const quickHash = (s: string): number => {
    let h = 0x811c9dc5
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = (h * 0x01000193) >>> 0
    }
    return h
}

// Recursively adjust positions in AST nodes
const adjustNodePositions = (node: any, offset: number): any => {
    if (!node) return node

    // Adjust position if it exists
    if (
        node.position?.start?.offset !== undefined &&
        node.position?.end?.offset !== undefined
    ) {
        node.position.start.offset += offset
        node.position.end.offset += offset
    }

    // Recursively adjust children
    if (node.children && Array.isArray(node.children)) {
        node.children = node.children.map((child: any) =>
            adjustNodePositions(child, offset),
        )
    }

    return node
}

export type IncrementalParsingProps = {
    markdown: string
    cache: SegmentCache
    trailingNodes?: number
    processor?: any
}
export const parseMarkdownIncremental = async ({
    markdown: text,
    cache,
    trailingNodes = 2,

    processor,
}: IncrementalParsingProps) => {
    const children: PosNode[] = []

    /* single-header for loop replaces the old while ------------------- */
    for (let offset = 0; offset < text.length; ) {
        /* ① try cache -------------------------------------------------- */
        const entry = cache.get(offset)
        if (entry) {
            const slice = text.slice(offset, entry.end)
            if (slice.length === entry.len && quickHash(slice) === entry.hash) {
                children.push(...(entry.nodes as PosNode[]))
                offset = entry.end // manual increment
                continue
            }
        }

        /* ② miss → parse ---------------------------------------------- */
        const rest = text.slice(offset)
        if (!rest) break

        const file = await processorWithAst(
            processor
        ).process(rest)
        const ast = file.data.ast as Root
        if (!ast) {
            console.warn(`file has no ast`, file)
        }

        // Process nodes and recursively adjust all positions
        const adjustedNodes = ast.children.map((node) =>
            adjustNodePositions(node, offset),
        )
        children.push(...adjustedNodes)
        break
    }

    /* ③ refresh cache (skip the live tail) --------------------------- */
    if (children.length > trailingNodes) {
        children
            .slice(0, trailingNodes ? -trailingNodes : undefined)
            .forEach((node) => {
                const start = node.position?.start.offset
                const end = node.position?.end.offset
                const slice = text.slice(start, end)
                cache.set(start, {
                    len: slice.length,
                    hash: quickHash(slice),
                    end,
                    nodes: [node],
                })
            })
    }
    // If cache is too big, remove some items (simple LRU: delete lowest keys first)
    const MAX_CACHE_SIZE = 300
    if (cache.size > MAX_CACHE_SIZE) {
        const keys = Array.from(cache.keys()).sort((a, b) => a - b)
        const toRemove = cache.size - MAX_CACHE_SIZE
        console.log(`Removing ${toRemove} items from markdown runtime cache`)
        for (let i = 0; i < toRemove; i++) {
            cache.delete(keys[i])
        }
    }

    // Instead of returning just children, return an AST root node.
    const root = {
        type: 'root',
        children: children,
        position: {
            start: { offset: 0 },
            end: { offset: text.length },
        },
    }

    return root as any
}
