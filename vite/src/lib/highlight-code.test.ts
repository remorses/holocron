/**
 * Server highlight helper: token HTML, aliases, unknown langs, diagram grammar.
 * Isolation tests must stay first. Refractor state is process-global.
 */

import { describe, expect, test, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { refractor } from 'refractor/core'
import { CodeBlock } from '../components/markdown/code-block.tsx'
import { highlightCode, HighlightedCodeBlock } from './highlight-code.tsx'

const DOCS_LANGS = [
  'markup', 'html', 'css', 'scss', 'sass', 'less', 'clike', 'javascript',
  'js', 'c', 'cpp', 'csharp', 'json', 'json5', 'jsonc',   'markdown', 'md', 'mdx',
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
  test('import does not register grammars', () => {
    expect(refractor.registered('java')).toBe(false)
    expect(refractor.registered('nix')).toBe(false)
    expect(refractor.registered('csharp')).toBe(false)
  })

  test('first highlight of ts and bash still works', () => {
    const ts = highlightCode('const greeting = "Hello"', 'ts')
    expect(ts).toContain('token keyword')
    expect(ts).toContain('token string')
    const bash = highlightCode('echo hi', 'bash')
    expect(bash).toContain('token')
  })

  test('highlight of nix registers only that lang', () => {
    expect(refractor.registered('java')).toBe(false)
    expect(highlightCode('x', 'nix')).toBeDefined()
    expect(refractor.registered('nix')).toBe(true)
    expect(refractor.registered('java')).toBe(false)
    expect(refractor.registered('csharp')).toBe(false)
  })

  test('calling highlight twice does not double-register', () => {
    const spy = vi.spyOn(refractor, 'register')
    highlightCode('fmt.Println(1)', 'go')
    const calls = spy.mock.calls.length
    expect(calls).toBeGreaterThan(0)
    highlightCode('fmt.Println(2)', 'go')
    expect(spy.mock.calls.length).toBe(calls)
    spy.mockRestore()
  })

  test('registers the docs language keep list', () => {
    const missing = DOCS_LANGS.filter((id) => highlightCode('x', id) === undefined)
    expect(missing).toEqual([])
  })

  test('does not register long-tail langs like vim', () => {
    for (const id of DROPPED_LANGS) {
      expect(highlightCode('x', id)).toBeUndefined()
    }
  })

  test('aliases jsonc', () => {
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

  test('highlights yaml frontmatter in markdown', () => {
    const html = highlightCode('---\ntitle: Hello\n---\n\n# Hi\n', 'markdown')
    expect(html).toContain('front-matter-block')
    expect(html).toContain('token key atrule')
    expect(html).toContain('title')
  })

  test('highlights yaml frontmatter in md', () => {
    const html = highlightCode('---\ntitle: Hello\n---\n\n# Hi\n', 'md')
    expect(html).toContain('token key atrule')
  })

  test('highlights yaml frontmatter in mdx', () => {
    const html = highlightCode('---\ntitle: Hello\n---\n\n# Hi\n', 'mdx')
    expect(html).toContain('front-matter-block')
    expect(html).toContain('token key atrule')
    expect(html).toContain('title')
  })

  test('highlights jsx component tags in mdx', () => {
    const html = highlightCode('<Note>\nHello\n</Note>\n', 'mdx')
    expect(html).toContain('token tag')
    expect(html).toContain('token class-name')
  })

  test('highlights jsx attributes and import in mdx', () => {
    const html = highlightCode(
      "import Foo from './foo'\n\n<Step title=\"First\">\nDo this.\n</Step>\n",
      'mdx',
    )
    expect(html).toContain('token keyword')
    expect(html).toContain('token attr-name')
    expect(html).toContain('token attr-value')
  })

  test('highlights jsx expression attributes in mdx', () => {
    const html = highlightCode('<Card href={url} />\n', 'mdx')
    expect(html).toContain('token tag')
    expect(html).toContain('token script')
  })

  test('highlights nested fenced code inside mdx snippets', () => {
    const html = highlightCode('```ts\nconst greeting = "Hello"\n```\n', 'mdx')
    expect(html).toContain('token keyword')
    expect(html).toContain('token string')
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
    expect(() => highlightCode('const greeting = "Hello"', 'javascript')).not.toThrow()
    expect(() => highlightCode('const greeting = "Hello"', 'javascript')).not.toThrow()
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
