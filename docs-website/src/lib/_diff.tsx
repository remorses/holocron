'use client'

/* diffHighlight.ts ---------------------------------------------------- */
import { visit } from 'unist-util-visit'
import { diff_match_patch, DIFF_INSERT } from 'diff-match-patch'
import type { Root, Parent, Literal, Text, Content as MdContent } from 'mdast'

declare module 'mdast' {
  export interface HProperties {
    id?: string
    'data-added'?: boolean | string
  }
  export interface Data {
    hProperties?: HProperties
  }
}

/* -------------------------------------------------------------------- *
 * 1.  MARK ADDITIONS (adds data-added attr to new or edited nodes)
 * -------------------------------------------------------------------- */

export function markRemarkAstAdditions(oldTree: Root, newTree: Root): void {
  /* pass 1 - fingerprint every node and create lookup map */
  const previous = new Set<string>()
  const oldNodesByFingerprint = new Map<string, MdContent | Parent>()

  visit(oldTree, (n) => {
    const fingerprint = computeHashForAstNode(n)
    previous.add(fingerprint)
    oldNodesByFingerprint.set(fingerprint, n)
  })

  /* pass 2 - walk new tree, tag additions + diff text */
  visit(newTree, (node: MdContent | Parent, index, parent) => {
    if (!previous.has(computeHashForAstNode(node))) setAdded(node)
    else if (node.type === 'text') {
      const oldNode = findSameSpotText(node as Text, oldTree)
      if (oldNode && oldNode.value !== (node as Text).value) {
        // Text has changed - mark parent as changed and do inline diff
        if (parent) setAdded(parent)
        diffText(node as Text, oldTree)
      }
    }
  })

  /* pass 3 - swap unchanged top-level nodes to preserve React identity */
  // TODO: This logic replaces new nodes with old ones, losing changes.
  // Need to fix React identity preservation without overwriting diff results.
  // newTree.children = newTree.children.map((newChild) => {
  //     const newFingerprint = fp(newChild)
  //     const oldChild = oldNodesByFingerprint.get(newFingerprint)

  //     // If we have a matching old node and it's unchanged, use the old node
  //     if (oldChild && !hasAddedMarker(newChild) && 'children' in oldChild === 'children' in newChild) {
  //         return oldChild as typeof newChild
  //     }
  //     return newChild
  // })
}

/* ---------- helpers ------------------------------------------------- */

function hasAddedMarker(node: MdContent | Parent): boolean {
  return Boolean(node.data?.hProperties?.['data-added'])
}

// stable fingerprint: capture semantic properties that affect rendering
function computeHashForAstNode(n: MdContent | Parent): string {
  const { type } = n
  const base: Record<string, unknown> = { type }

  switch (type) {
    case 'text':
      // Position-based identity for text nodes (content changes will be diffed)
      base.pos = n.position?.start?.offset
      break
    case 'heading':
      base.depth = (n as any).depth
      break
    case 'link':
      base.url = (n as any).url
      base.title = (n as any).title
      break
    case 'image':
      base.url = (n as any).url
      base.alt = (n as any).alt
      base.title = (n as any).title
      break
    case 'code':
      base.lang = (n as any).lang
      base.meta = (n as any).meta
      break
    case 'inlineCode':
      // Position-based identity for inline code
      base.pos = n.position?.start?.offset
      break
    case 'list':
      base.ordered = (n as any).ordered
      base.start = (n as any).start
      base.spread = (n as any).spread
      break
    case 'listItem':
      base.checked = (n as any).checked
      base.spread = (n as any).spread
      break
    case 'table':
      base.align = (n as any).align
      break
    case 'tableRow':
      // Position-based for table rows
      base.pos = n.position?.start?.offset
      break
    case 'tableCell':
      // Position-based for table cells
      base.pos = n.position?.start?.offset
      break
    case 'emphasis':
    case 'strong':
    case 'delete':
      // Position-based for inline formatting
      base.pos = n.position?.start?.offset
      break
    case 'blockquote':
    case 'paragraph':
      // Position-based for block elements
      base.pos = n.position?.start?.offset
      break
    case 'thematicBreak':
      // Position-based for breaks
      base.pos = n.position?.start?.offset
      break
    // MDX nodes
    case 'mdxJsxFlowElement':
    case 'mdxJsxTextElement':
      base.name = (n as any).name
      base.attributes = JSON.stringify((n as any).attributes || [])
      break
    case 'mdxFlowExpression':
    case 'mdxTextExpression':
      base.value = (n as any).value
      break
    default:
      // Fallback to position for unknown node types
      base.pos = n.position?.start?.offset
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

  // If there's only one piece and it's not marked as added, just update the value
  if (pieces.length === 1 && !pieces[0].data?.hProperties?.['data-added']) {
    newText.value = pieces[0].value
    return
  }

  // Instead of converting to emphasis (which can cause nesting issues),
  // create a single text node with the concatenated diff and mark as added
  const combinedValue = pieces.map((p) => p.value).join('')
  newText.value = combinedValue

  // Mark the text node as changed
  setAdded(newText)
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
  root?: RefObject<HTMLElement | null>
  enabled?: boolean
}): void => {
  const hlRef = useRef<Highlight | null>(null)

  useLayoutEffect(() => {
    if (!enabled) return

    const host = root?.current || document
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
