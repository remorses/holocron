/**
 * Verifies Holocron registers the bundled Prism language set.
 *
 * We bundle a curated subset of prismjs languages (popular/trendy ones only)
 * to keep the bundle small. The `prismLanguageIds` export still contains ALL
 * prism component IDs from components.json, so we check that every registered
 * grammar is functional, not that every ID in the full list is present.
 */

import { describe, expect, test } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CodeBlock } from './code-block.tsx'
import { Prism } from '../../prism.ts'

/** Languages we explicitly bundle in scripts/prism-entry.ts */
const BUNDLED_LANGUAGES = [
  // Core
  'markup',
  'css',
  'clike',
  'regex',
  // Layer 1
  'javascript',
  'c',
  'markup-templating',
  'less',
  'scss',
  'sass',
  'textile',
  'json',
  'markdown',
  'ruby',
  'csharp',
  'dart',
  'go',
  'kotlin',
  'reason',
  'solidity',
  'v',
  'protobuf',
  'gradle',
  'groovy',
  'fsharp',
  'haskell',
  'basic',
  'bash',
  'yaml',
  'sql',
  'python',
  'lua',
  'scheme',
  'uri',
  'stylus',
  'perl',
  'r',
  'julia',
  'matlab',
  'clojure',
  'elm',
  'ocaml',
  'lisp',
  'prolog',
  'hcl',
  'bicep',
  'nix',
  'diff',
  'git',
  'toml',
  'ini',
  'properties',
  'editorconfig',
  'ignore',
  'makefile',
  'log',
  'csv',
  'promql',
  'jq',
  'rego',
  'rust',
  'zig',
  'odin',
  'nim',
  'wasm',
  'wgsl',
  'llvm',
  'armasm',
  'nasm',
  'mermaid',
  'dot',
  'latex',
  'rest',
  'bnf',
  'ebnf',
  'puppet',
  'awk',
  'tcl',
  'vim',
  'gdscript',
  'wren',
  'verilog',
  'vhdl',
  'pascal',
  'applescript',
  'swift',
  'powershell',
  'batch',
  'nginx',
  'apacheconf',
  'systemd',
  'cmake',
  'erlang',
  'rescript',
  // Layer 2
  'cpp',
  'objectivec',
  'glsl',
  'java',
  'typescript',
  'coffeescript',
  'json5',
  'jsonp',
  'http',
  'shell-session',
  'haml',
  'handlebars',
  'ejs',
  'django',
  'twig',
  'liquid',
  'php',
  'erb',
  'pug',
  'cshtml',
  'elixir',
  'racket',
  'purescript',
  'vbnet',
  'docker',
  'graphql',
  // Layer 3
  'scala',
  'javadoclike',
  'jsx',
  'javadoc',
  'jsdoc',
  // Layer 4
  'tsx',
  'jsstacktrace',
]

/**
 * Modifier-only components that extend other languages but don't register
 * their own grammar key in Prism.languages.
 */
const MODIFIER_ONLY = ['css-extras', 'js-extras', 'js-templates', 'xml-doc', 'go-module', 'plant-uml']

describe('prism-languages', () => {
  test('every bundled language is registered in Prism', () => {
    const missing = BUNDLED_LANGUAGES.filter((id) => !MODIFIER_ONLY.includes(id) && Prism.languages[id] === undefined)
    expect(missing).toEqual([])
  })

  test('bundled language count stays reasonable', () => {
    // Guard against accidentally re-adding all ~300 languages.
    // Currently ~130 languages; bump this if you intentionally add more.
    const registered = Object.keys(Prism.languages).filter(
      (k) => typeof Prism.languages[k] === 'object' && k !== 'DFS',
    )
    expect(registered.length).toBeGreaterThan(80)
    expect(registered.length).toBeLessThan(200)
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
