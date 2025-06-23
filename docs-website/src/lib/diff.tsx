/* diffHighlight.ts ---------------------------------------------------- */
import { visit } from 'unist-util-visit'
import { diff_match_patch, DIFF_INSERT } from 'diff-match-patch'
import type { Root, Parent, Literal, Text, Content as MdContent } from 'mdast'

declare module 'mdast' {
    export interface Data {
        hProperties?: {
            id?: string
            'data-added'?: boolean | string
        }
    }
}

/* -------------------------------------------------------------------- *
 * 1.  MARK ADDITIONS (adds data-added attr to new or edited nodes)
 * -------------------------------------------------------------------- */

export function markRemarkAstAdditions(oldTree: Root, newTree: Root): void {
    /* pass 1 - fingerprint every node that already existed */
    const previous = new Set<string>()
    visit(oldTree, (n) => {
        previous.add(fp(n))
    })

    /* pass 2 - walk new tree, tag additions + diff text */
    visit(newTree, (node: MdContent | Parent) => {
        if (!previous.has(fp(node))) setAdded(node)
        else if (node.type === 'text') diffText(node as Text, oldTree)
    })
}

/* ---------- helpers ------------------------------------------------- */

// stable  fingerprint: ignore layout data + actual text content
function fp(n: MdContent | Parent): string {
    const { type } = n
    const base: Record<string, unknown> = { type }

    switch (type) {
        case 'text':
            /* same position = same identity for a text node */
            base.pos = n.position?.start?.offset
            break
        case 'link':
            base.url = n['url']
            break
        default:
            break
    }
    return JSON.stringify(base)
}

function setAdded(n: MdContent | Parent): void {
    ;(n.data ??= {}).hProperties ??= {}
    ;(n.data.hProperties as Record<string, unknown>)['data-added'] = true
}

function diffText(newText: Text, oldTree: Root): void {
    const oldNode = findSameSpotText(newText, oldTree)
    if (!oldNode || oldNode.value === newText.value) return

    const dmp = new diff_match_patch()
    const diffs = dmp.diff_main(oldNode.value, newText.value)
    dmp.diff_cleanupSemantic(diffs)

    const pieces: Text[] = diffs.flatMap(([op, data]): Text[] => {
        if (op === DIFF_INSERT) {
            return [
                {
                    type: 'text',
                    value: data,
                    data: { hProperties: { 'data-added': true } },
                },
            ]
        }
        if (op === 0) return [{ type: 'text', value: data }]
        return []
    })

    // swap text node for an inline paragraph of pieces
    Object.assign(newText, {
        type: 'paragraph',
        children: pieces,
        value: undefined,
    })
}

function findSameSpotText(target: Text, tree: Root): Text | null {
    let result: Text | null = null
    visit(tree, (n: MdContent | Parent) => {
        if (
            !result &&
            n.type === 'text' &&
            n.position?.start?.offset === target.position?.start?.offset
        ) {
            result = n as Text
        }
    })
    return result
}

/* -------------------------------------------------------------------- *
 * 2.  REACT HOOK ⇒ APPLY CSS CUSTOM HIGHLIGHTS
 * -------------------------------------------------------------------- */

import { useLayoutEffect, useRef, RefObject } from 'react'
export const useAddedHighlighter = ({
    root,
    enabled = true,
}: {
    root: RefObject<HTMLElement | null>
    enabled?: boolean
}): void => {
    const hlRef = useRef<Highlight | null>(null)

    useLayoutEffect(() => {
        if (!enabled) return

        const host = root.current
        if (!host || !CSS.highlights) return

        /* collect all added nodes except opt-outs */
        const added: HTMLElement[] = Array.from(
            host.querySelectorAll<HTMLElement>(
                '[data-added]:not([data-no-highlight])',
            ),
        )

        if (!added.length) return

        const ranges = added.map((el) => {
            const r = document.createRange()
            r.selectNodeContents(el)
            return r
        })

        const hl = hlRef.current ?? new window.Highlight()
        ranges.forEach((r) => hl.add(r))
        CSS.highlights.set('md-add', hl)
        hlRef.current = hl

        return () => {
            /* optional cleanup on unmount */
            CSS.highlights.delete('md-add')
            hlRef.current = null
        }
    })
}
