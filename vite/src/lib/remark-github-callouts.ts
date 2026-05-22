/** Remark plugin converting GitHub quote callouts into Holocron callout MDX. */

import type { Blockquote, Paragraph, Root, RootContent, Text } from 'mdast'
import { visit } from 'unist-util-visit'

const CALLOUTS = {
  NOTE: { component: 'Note', title: 'Note' },
  TIP: { component: 'Tip', title: 'Tip' },
  IMPORTANT: { component: 'Info', title: 'Important' },
  WARNING: { component: 'Warning', title: 'Warning' },
  CAUTION: { component: 'Danger', title: 'Caution' },
} as const

type GitHubCalloutKind = keyof typeof CALLOUTS

const calloutMarker = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][\t ]*(?:\n)?/i

function firstParagraph(blockquote: Blockquote): Paragraph | undefined {
  const first = blockquote.children[0]
  if (first?.type === 'paragraph') return first
}

function firstText(paragraph: Paragraph): Text | undefined {
  const first = paragraph.children[0]
  if (first?.type === 'text') return first
}

function readCalloutKind(blockquote: Blockquote): GitHubCalloutKind | undefined {
  const paragraph = firstParagraph(blockquote)
  const text = paragraph && firstText(paragraph)
  const match = text?.value.match(calloutMarker)
  switch (match?.[1]?.toUpperCase()) {
    case 'NOTE': return 'NOTE'
    case 'TIP': return 'TIP'
    case 'IMPORTANT': return 'IMPORTANT'
    case 'WARNING': return 'WARNING'
    case 'CAUTION': return 'CAUTION'
  }
}

function stripMarker(blockquote: Blockquote): Blockquote['children'] {
  const children = [...blockquote.children]
  const paragraph = firstParagraph(blockquote)
  const text = paragraph && firstText(paragraph)
  if (!paragraph || !text) return children

  const nextText = text.value.replace(calloutMarker, '')
  if (nextText.length > 0) {
    children[0] = {
      ...paragraph,
      children: [{ ...text, value: nextText }, ...paragraph.children.slice(1)],
    }
    return children
  }

  if (paragraph.children.length > 1) {
    children[0] = { ...paragraph, children: paragraph.children.slice(1) }
    return children
  }

  return children.slice(1)
}

function createCallout(
  kind: GitHubCalloutKind,
  children: Blockquote['children'],
): Extract<RootContent, { type: 'mdxJsxFlowElement' }> {
  const callout = CALLOUTS[kind]
  return {
    type: 'mdxJsxFlowElement',
    name: callout.component,
    attributes: [{ type: 'mdxJsxAttribute', name: 'title', value: callout.title }],
    children,
  }
}

export function remarkGithubCallouts() {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node, index, parent) => {
      if (!parent || index === undefined) return
      const kind = readCalloutKind(node)
      if (!kind) return

      parent.children[index] = createCallout(kind, stripMarker(node))
    })
  }
}
