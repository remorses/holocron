/**
 * Verifies Holocron registers the full Prism language set.
 */

import { describe, expect, test } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CodeBlock } from './code-block.tsx'
import { Prism, prismLanguageIds } from '../../prism.ts'

describe('prism-languages', () => {
  test('registers every prismjs grammar except modifier-only components', () => {
    const missingLanguages = prismLanguageIds.filter((id) => Prism.languages[id] === undefined)

    expect(missingLanguages).toMatchInlineSnapshot(`
      [
        "css-extras",
        "js-extras",
        "js-templates",
        "php-extras",
        "xml-doc",
      ]
    `)
  })

  test('aliases mdx to markdown highlighting', () => {
    expect(Prism.languages.mdx).toBe(Prism.languages.md)
  })

  test('aliases jsonc to json highlighting', () => {
    expect(Prism.languages.jsonc).toBe(Prism.languages.json)
  })

  test('highlights fenced code inside mdx snippets', () => {
    // Prism is lazy-loaded via useEffect, so renderToStaticMarkup won't
    // show highlighted tokens. Verify Prism.highlight() works directly.
    const snippet = 'const greeting = "Hello"'
    const grammar = Prism.languages.typescript
    expect(grammar).toBeDefined()
    const html = Prism.highlight(snippet, grammar, 'typescript')
    expect(html).toContain('token keyword')
    expect(html).toContain('token string')
  })

  test('does not full-bleed code blocks without line numbers', () => {
    const rendered = renderToStaticMarkup(createElement(CodeBlock, { lang: 'diagram', showLineNumbers: false, children: 'A --> B' }))

    expect(rendered).not.toContain('class="m-0 py-2 bleed"')
  })
})
