/**
 * Server-only syntax highlighting via refractor (Prism grammars, hast output).
 * Do not import from client components or the highlighter lands in the browser.
 */

import type { ComponentProps } from 'react'
import { refractor } from 'refractor/all'
import { toHtml } from 'hast-util-to-html'
import { CodeBlock } from '../components/markdown/code-block.tsx'

refractor.alias({ json: 'jsonc', markdown: 'mdx' })
refractor.languages.diagram = {
  'box-drawing': /[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷]+/,
  'line-char': /[-_|<>]+/,
  label: /[^\s┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷\-_|<>]+/,
}

/** Highlight code on the server. Unknown langs return undefined. */
export function highlightCode(code: string, lang?: string): string | undefined {
  const id = lang?.trim().toLowerCase()
  if (!id || !refractor.registered(id)) return undefined
  return toHtml(refractor.highlight(code, id))
}

export function HighlightedCodeBlock(props: ComponentProps<typeof CodeBlock>) {
  return <CodeBlock {...props} highlightedHtml={highlightCode(props.children, props.lang)} />
}
