/**
 * Server highlight helper: token HTML, aliases, unknown langs, diagram grammar.
 */

import { describe, expect, test } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CodeBlock } from '../components/markdown/code-block.tsx'
import { highlightCode, HighlightedCodeBlock, registerExtraGrammars } from './highlight-code.tsx'

const DOCS_LANGS = [
  'markup', 'html', 'css', 'scss', 'sass', 'less', 'clike', 'javascript',
  'js', 'c', 'cpp', 'csharp', 'json', 'json5', 'jsonc', 'markdown', 'md',
  'ruby', 'go', 'kotlin', 'bash', 'sh', 'shell-session', 'yaml', 'yml',
  'sql', 'python', 'py', 'diff', 'toml', 'ini', 'rust', 'java',
  'typescript', 'ts', 'php', 'docker', 'dockerfile', 'graphql', 'jsx',
  'tsx', 'hcl', 'nginx', 'http', 'powershell', 'swift', 'lua', 'makefile',
  'dart', 'solidity', 'zig', 'wasm', 'nix', 'bicep', 'protobuf', 'git',
  'editorconfig', 'ignore', 'properties', 'mermaid', 'plant-uml', 'log',
  'csv', 'jq', 'elixir', 'scala', 'objectivec', 'r', 'batch', 'cmake',
  'apacheconf', 'gradle', 'groovy', 'glsl', 'latex', 'handlebars',
  'liquid', 'django', 'jsdoc', 'gdscript', 'cshtml', 'systemd',
]

const DROPPED_LANGS = ['vim', 'textile', 'pug', 'lisp', 'arduino', 'wren', 'prolog']

describe('highlightCode', () => {
  test('registers the docs language keep list', () => {
    const missing = DOCS_LANGS.filter((id) => highlightCode('x', id) === undefined)
    expect(missing).toEqual([])
  })

  test('does not register long-tail langs like vim', () => {
    for (const id of DROPPED_LANGS) {
      expect(highlightCode('x', id)).toBeUndefined()
    }
  })

  test('aliases mdx and jsonc', () => {
    expect(highlightCode('x', 'mdx')).toBeDefined()
    expect(highlightCode('{ "a": 1 }', 'jsonc')).toContain('token')
  })

  test('unknown lang returns undefined', () => {
    expect(highlightCode('x', 'not-a-lang')).toBeUndefined()
    expect(highlightCode('x', 'TS')).toBeDefined()
    expect(highlightCode('x')).toBeUndefined()
  })

  test('yaml keys use key atrule token classes', () => {
    const html = highlightCode('name: Deploy\n', 'yaml')
    expect(html).toContain('token key atrule')
  })

  test('highlights typescript with token classes', () => {
    const html = highlightCode('const greeting = "Hello"', 'typescript')
    expect(html).toContain('token keyword')
    expect(html).toContain('token string')
  })

  test('highlights fenced code inside mdx snippets', () => {
    const html = highlightCode('const greeting = "Hello"', 'mdx')
    expect(html).toBeDefined()
  })

  test('highlights diagram box drawing', () => {
    const html = highlightCode('┌─A─┐', 'diagram')
    expect(html).toContain('token box-drawing')
    expect(html).toContain('token label')
  })

  test('static CodeBlock markup includes server tokens', () => {
    const rendered = renderToStaticMarkup(createElement(HighlightedCodeBlock, {
      lang: 'ts',
      children: 'const greeting = "Hello"',
    }))
    expect(rendered).toContain('token keyword')
    expect(rendered).toContain('token string')
  })

  test('grammar registration is safe to re-run on RSC remount', () => {
    expect(() => registerExtraGrammars()).not.toThrow()
    expect(highlightCode('const greeting = "Hello"', 'javascript')).toContain('token')
  })

  test('does not full-bleed code blocks without line numbers', () => {
    const rendered = renderToStaticMarkup(createElement(CodeBlock, {
      lang: 'diagram',
      showLineNumbers: false,
      children: 'A --> B',
    }))
    expect(rendered).not.toContain('class="m-0 py-2 bleed"')
  })
})
