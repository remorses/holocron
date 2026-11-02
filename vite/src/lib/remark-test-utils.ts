/** Test helpers for running Mintlify mdast transforms through the same mdx serializer. */

import { parse, stringify, type Root } from 'mdastic'
import { headingId } from 'mdastic/heading-id'
import { mdx } from 'mdastic/mdx'
import { MDX_SYNTAX } from './normalize-mdx.ts'

export function runRemarkPlugin(content: string, transform: (tree: Root) => void) {
  const parsed = parse(content, { syntax: [mdx(), headingId()] })
  if (parsed instanceof Error) throw parsed
  const parsedSnapshot: Root = structuredClone(parsed)
  transform(parsed)

  return {
    parsed: parsedSnapshot,
    transformed: parsed,
    markdown: stringify(parsed, { syntax: MDX_SYNTAX }),
  }
}
