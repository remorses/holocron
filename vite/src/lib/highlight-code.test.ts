/**
 * Server highlight helper: token HTML, aliases, unknown langs, diagram grammar.
 */

import { describe, expect, test } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CodeBlock } from '../components/markdown/code-block.tsx'
import { highlightCode, HighlightedCodeBlock, registerExtraGrammars } from './highlight-code.tsx'

const FORMER_PRISM_LANGS = [
  'markup', 'css', 'clike', 'regex', 'javascript', 'c', 'markup-templating',
  'less', 'scss', 'sass', 'textile', 'json', 'markdown', 'ruby', 'csharp',
  'dart', 'go', 'kotlin', 'reason', 'solidity', 'v', 'protobuf', 'gradle',
  'groovy', 'fsharp', 'haskell', 'basic', 'bash', 'yaml', 'sql', 'python',
  'lua', 'scheme', 'uri', 'stylus', 'perl', 'r', 'julia', 'matlab',
  'clojure', 'elm', 'ocaml', 'lisp', 'prolog', 'hcl', 'bicep', 'nix',
  'diff', 'git', 'toml', 'ini', 'properties', 'editorconfig', 'ignore',
  'makefile', 'log', 'csv', 'promql', 'jq', 'rego', 'rust', 'zig', 'odin',
  'nim', 'wasm', 'wgsl', 'llvm', 'armasm', 'nasm', 'mermaid', 'dot',
  'latex', 'rest', 'bnf', 'ebnf', 'puppet', 'awk', 'tcl', 'vim',
  'gdscript', 'wren', 'verilog', 'vhdl', 'pascal', 'applescript', 'swift',
  'powershell', 'batch', 'nginx', 'apacheconf', 'systemd', 'cmake',
  'erlang', 'rescript', 'cpp', 'objectivec', 'glsl', 'java', 'typescript',
  'coffeescript', 'json5', 'jsonp', 'http', 'shell-session', 'haml',
  'handlebars', 'ejs', 'django', 'twig', 'liquid', 'php', 'erb', 'pug',
  'cshtml', 'elixir', 'racket', 'purescript', 'vbnet', 'docker', 'graphql',
  'scala', 'jsx', 'tsx', 'jsdoc', 'javadoc', 'plant-uml',
]

describe('highlightCode', () => {
  test('every former Prism lang is registered', () => {
    const missing = FORMER_PRISM_LANGS.filter((id) => highlightCode('x', id) === undefined)
    expect(missing).toEqual([])
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
