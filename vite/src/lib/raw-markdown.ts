/**
 * AI agent detection and markdown transforms for raw markdown serving.
 *
 * Used by the agent redirect middleware in app-factory.tsx to
 * 302-redirect AI agents to `.md` URLs, and to transform MDX source
 * for agent consumption (e.g. stripping `<Visibility for="humans">` blocks).
 */

import type { Root, RootContent } from 'mdast'
import { visit, SKIP } from 'unist-util-visit'
import remarkMdx from 'remark-mdx'
import remarkFrontmatter from 'remark-frontmatter'
import { remark } from 'remark'
import { gfmToMarkdown } from 'mdast-util-gfm'
import { mdxToMarkdown } from 'mdast-util-mdx'
import { frontmatterToMarkdown } from 'mdast-util-frontmatter'
import { toMarkdown } from 'mdast-util-to-markdown'
import remarkGfm from 'remark-gfm'

/** Check if the request explicitly asks for markdown via Accept header. */
export function isAgentRequest(request: Request): boolean {
  const accept = (request.headers.get('accept') ?? '').toLowerCase()
  return accept.startsWith('text/markdown')
}

type JsxNode = Extract<RootContent, { type: 'mdxJsxFlowElement' | 'mdxJsxTextElement' }>

/** Read the `for` attribute value from a Visibility JSX node.
 *  Handles both string literals (`for="agents"`) and simple JSX
 *  expressions (`for={"agents"}`). */
function getVisibilityAudience(node: JsxNode): string | undefined {
  for (const attr of node.attributes) {
    if (attr.type !== 'mdxJsxAttribute' || attr.name !== 'for') continue

    // String literal: for="agents"
    if (typeof attr.value === 'string') return attr.value

    // Expression: for={"agents"} — value is an mdxJsxAttributeValueExpression
    if (attr.value && typeof attr.value === 'object') {
      const raw = attr.value.value.trim()
      // Strip surrounding quotes: "agents" or 'agents' or `agents`
      const match = raw.match(/^["'`](\w+)["'`]$/)
      if (match) return match[1]
    }
  }
  return undefined
}

/**
 * Transform MDX source for agent markdown output using mdast traversal.
 *
 * - Strips `<Visibility for="humans">` blocks entirely
 * - Unwraps `<Visibility for="agents">` keeping inner content
 * - Strips `<Visibility>` with no `for` prop (defaults to humans)
 */
export function stripVisibilityForAgents(mdx: string): string {
  // Fast path: skip parsing when no Visibility blocks exist
  if (!mdx.includes('<Visibility')) return mdx

  const processor = remark().use(remarkFrontmatter, ['yaml']).use(remarkMdx).use(remarkGfm)
  const tree: Root = processor.parse(mdx)
  processor.runSync(tree)

  let changed = false

  visit(tree, (node, index, parent) => {
    if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') return
    const jsxNode = node as JsxNode
    if (jsxNode.name !== 'Visibility') return
    if (typeof index !== 'number' || !parent?.children) return

    const audience = getVisibilityAudience(jsxNode)

    if (audience === 'agents') {
      // Unwrap: replace <Visibility for="agents"> with its children
      parent.children.splice(index, 1, ...(jsxNode.children as RootContent[]))
      changed = true
      return [SKIP, index] // revisit at same index (new children spliced in)
    }

    // audience === 'humans' or no `for` prop → remove entirely
    parent.children.splice(index, 1)
    changed = true
    return [SKIP, index]
  })

  if (!changed) return mdx

  return toMarkdown(tree, {
    extensions: [gfmToMarkdown(), mdxToMarkdown(), frontmatterToMarkdown(['yaml'])],
  })
}
