import { diffWordsWithSpace } from 'diff'
import { processMdxInClient } from './markdown-runtime'

import remarkMdx from 'remark-mdx'
import { Root, Content } from 'mdast'

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

export type IncrementalParsingProps = {
    markdown: string
    extension: string
    cache: SegmentCache
    trailingNodes?: number
}
export const parseMarkdownIncremental = ({
    markdown: text,
    cache,
    trailingNodes = 2,
    extension,
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

        const { ast } = processMdxInClient({ extension, markdown: rest })

        ;(ast.children as PosNode[]).forEach((node) => {
            node.position.start.offset += offset
            node.position.end.offset += offset
            children.push(node)
            offset = node.position.end.offset // manual increment
        })
        break
    }

    /* ③ refresh cache (skip the live tail) --------------------------- */
    children
        .slice(0, trailingNodes ? -trailingNodes : undefined)
        .forEach((node) => {
            const start = node.position.start.offset
            const end = node.position.end.offset
            const slice = text.slice(start, end)
            cache.set(start, {
                len: slice.length,
                hash: quickHash(slice),
                end,
                nodes: [node],
            })
        })

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
