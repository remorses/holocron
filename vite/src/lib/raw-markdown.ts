/**
 * AI agent detection and markdown transforms for raw markdown serving.
 *
 * Used by the agent redirect middleware in app-factory.tsx to
 * 302-redirect AI agents to `.md` URLs, and to transform MDX source
 * for agent consumption (e.g. stripping `<Visibility for="humans">` blocks).
 */

import { parse, stringify, type NodeOf, type RootContent } from 'mdastic'
import { MDX_SYNTAX } from './normalize-mdx.ts'

/** Check if the request explicitly asks for markdown via Accept header. */
export function isAgentRequest(request: Request): boolean {
  const accept = (request.headers.get('accept') ?? '').toLowerCase()
  return accept.startsWith('text/markdown')
}

/** Read the `for` attribute value from a Visibility JSX node.
 *  Handles both string literals (`for="agents"`) and simple JSX
 *  expressions (`for={"agents"}`). */
function getVisibilityAudience(node: NodeOf<'mdxJsxFlowElement' | 'mdxJsxTextElement'>): string | undefined {
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

  const tree = parse(mdx, { syntax: MDX_SYNTAX })
  if (tree instanceof Error) throw tree

  if (!stripVisibility(tree.children)) return mdx

  return stringify(tree, { syntax: MDX_SYNTAX })
}

/** Remove or unwrap Visibility elements in place. Returns true if anything changed. */
function stripVisibility(children: RootContent[]): boolean {
  let changed = false
  let index = 0
  while (index < children.length) {
    const node = children[index]!
    if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'Visibility') {
      // agents: unwrap, keeping the children. humans or no `for` prop: remove entirely.
      children.splice(index, 1, ...(getVisibilityAudience(node) === 'agents' ? node.children : []))
      changed = true
      continue // revisit the same index, the spliced children come next
    }
    const nested = Reflect.get(node, 'children')
    if (Array.isArray(nested) && stripVisibility(nested)) changed = true
    index++
  }
  return changed
}
