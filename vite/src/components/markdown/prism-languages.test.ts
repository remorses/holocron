/**
 * Verifies Holocron registers the full Prism language set.
 */

import { describe, expect, test } from 'vitest'
import * as PrismModule from 'prismjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CodeBlock } from './code-block.tsx'
import { prismLanguageIds } from '../../prism.ts'

const Prism = PrismModule.default ?? PrismModule

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

  test('highlights fenced code inside mdx snippets', () => {
    const snippet = '```ts\nconst greeting = "Hello"\n```'
    const highlighted = renderToStaticMarkup(createElement(CodeBlock, { lang: 'mdx', children: snippet }))

    expect(highlighted).toContain('token keyword')
    expect(highlighted).toContain('token string')
  })
})
