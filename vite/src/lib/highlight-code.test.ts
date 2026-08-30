/**
 * Server highlight helper: token HTML, aliases, unknown langs, custom grammars.
 * Isolation tests must stay first. Refractor state is process-global.
 * Custom langs (mdx, md frontmatter, diagram, extras) use inline HTML snapshots.
 */

import { describe, expect, test, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { refractor } from 'refractor/core'
import dedent from 'string-dedent'
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

  test('html keeps inline style and script grammars', () => {
    const html = highlightCode('<style>.a{color:red}</style><script>var a=1</script>', 'html')
    expect(html).toContain('token language-css')
    expect(html).toContain('token language-javascript')
  })

  test('http bodies keep the content-type grammar', () => {
    const html = highlightCode('HTTP/1.1 200 OK\nContent-Type: application/json\n\n{ "id": 1 }\n', 'http')
    expect(html).toContain('token application-json')
    expect(html).toContain('token property')
  })

  test('css extras tokens survive', () => {
    const html = highlightCode(':root { --brand: #ff0000; margin: 10px }', 'css')
    expect(html).toContain('token variable')
    expect(html).toContain('token hexcode')
    expect(html).toContain('token unit')
  })

  test('js extras tokens survive on typescript', () => {
    expect(highlightCode('const x = Math.PI', 'ts')).toContain('token known-class-name')
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

  test('markdown nested zig fence inner-highlights before keep-list', () => {
    expect(refractor.registered('zig')).toBe(false)
    const html = highlightCode('```zig\nconst x = 1;\n```\n', 'markdown')
    expect(html).toContain('token keyword')
    expect(html).toContain('token number')
    expect(html).not.toMatch(/language-zig">const x/)
  })

  test('mdx nested mermaid fence inner-highlights before keep-list', () => {
    const html = highlightCode('```mermaid\ngraph TD\n  A-->B\n```\n', 'mdx')
    expect(html).toContain('token keyword')
    expect(html).toContain('token arrow')
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

  test('highlights multiline mdx import through the from line', () => {
    const html = highlightCode("import {\n  Foo,\n} from './foo'\n", 'mdx')
    expect(html).toContain('token keyword')
    expect(html).toContain('token string')
    expect(html).not.toMatch(/<\/span>\s*\} from/)
  })

  test('highlights import type and side-effect import in mdx', () => {
    const html = highlightCode("import type { Foo } from './foo'\nimport './bar'\n", 'mdx')
    expect(html).toContain('token keyword')
    expect(html).toContain('token string')
  })

  test('does not eat indented markdown after a blank line after import', () => {
    const html = highlightCode("import Foo from './foo'\n\n  indented\n", 'mdx')
    expect(html).toContain('token keyword')
    expect(html).toMatch(/<\/span>\n\n  indented/)
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
    expect(rendered).toContain('>ts</div>')
    expect(rendered).toContain('aria-label="Copy code"')
  })

  test('unknown fence languages keep the frame, language label, and copy action', () => {
    const rendered = renderToStaticMarkup(createElement(HighlightedCodeBlock, {
      lang: 'magento',
      children: 'bin/magento cache:flush',
    }))

    expect(rendered).toContain('<figure')
    expect(rendered).toContain('>magento</div>')
    expect(rendered).toContain('aria-label="Copy code"')
    expect(rendered).toContain('bin/magento cache:flush')
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

  test('mdx frontmatter colors yaml keys including $schema', () => {
    expect(highlightCode(dedent`
      ---
      $schema: https://holocron.so/frontmatter.json
      title: Authentication
      description: How to set up auth.
      icon: lucide:lock
      ---
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token front-matter-block"><span class="token punctuation">---</span>
      <span class="token front-matter yaml language-yaml"><span class="token key atrule">$schema</span><span class="token punctuation">:</span> https<span class="token punctuation">:</span>//holocron.so/frontmatter.json
      <span class="token key atrule">title</span><span class="token punctuation">:</span> Authentication
      <span class="token key atrule">description</span><span class="token punctuation">:</span> How to set up auth.
      <span class="token key atrule">icon</span><span class="token punctuation">:</span> lucide<span class="token punctuation">:</span>lock</span>
      <span class="token punctuation">---</span></span>"
    `)
  })

  test('mdx frontmatter then heading and body', () => {
    expect(highlightCode(dedent`
      ---
      title: Hello
      ---

      # Hi

      Body text.
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token front-matter-block"><span class="token punctuation">---</span>
      <span class="token front-matter yaml language-yaml"><span class="token key atrule">title</span><span class="token punctuation">:</span> Hello</span>
      <span class="token punctuation">---</span></span>

      <span class="token title important"><span class="token punctuation">#</span> Hi</span>

      Body text."
    `)
  })

  test('md alias frontmatter uses the same yaml tokens', () => {
    expect(highlightCode(dedent`
      ---
      title: Hello
      ---

      # Hi
    `, 'md')).toMatchInlineSnapshot(`
      "<span class="token front-matter-block"><span class="token punctuation">---</span>
      <span class="token front-matter yaml language-yaml"><span class="token key atrule">title</span><span class="token punctuation">:</span> Hello</span>
      <span class="token punctuation">---</span></span>

      <span class="token title important"><span class="token punctuation">#</span> Hi</span>"
    `)
  })

  test('markdown nested ts fence inner-highlights', () => {
    expect(highlightCode(dedent`
      \`\`\`ts
      const greeting = "Hello"
      \`\`\`
    `, 'markdown')).toMatchInlineSnapshot(`
      "<span class="token code"><span class="token punctuation">\`\`\`</span><span class="token code-language">ts</span>
      <span class="token code-block language-ts"><span class="token keyword">const</span> greeting <span class="token operator">=</span> <span class="token string">"Hello"</span></span>
      <span class="token punctuation">\`\`\`</span></span>"
    `)
  })

  test('mdx Note component uses jsx class-name tokens', () => {
    expect(highlightCode(dedent`
      <Note>
      This is a note.
      </Note>
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;</span><span class="token class-name">Note</span></span><span class="token punctuation">></span></span>
      This is a note.
      <span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;/</span><span class="token class-name">Note</span></span><span class="token punctuation">></span></span>"
    `)
  })

  test('mdx nested Step attributes', () => {
    expect(highlightCode(dedent`
      <Steps>
        <Step title="First step">
          Do this first.
        </Step>
      </Steps>
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;</span><span class="token class-name">Steps</span></span><span class="token punctuation">></span></span>
        <span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;</span><span class="token class-name">Step</span></span> <span class="token attr-name">title</span><span class="token attr-value"><span class="token punctuation attr-equals">=</span><span class="token punctuation">"</span>First step<span class="token punctuation">"</span></span><span class="token punctuation">></span></span>
          Do this first.
        <span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;/</span><span class="token class-name">Step</span></span><span class="token punctuation">></span></span>
      <span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;/</span><span class="token class-name">Steps</span></span><span class="token punctuation">></span></span>"
    `)
  })

  test('mdx self-closing component', () => {
    expect(highlightCode('<Icon name="star" />\n', 'mdx')).toMatchInlineSnapshot(`
      "<span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;</span><span class="token class-name">Icon</span></span> <span class="token attr-name">name</span><span class="token attr-value"><span class="token punctuation attr-equals">=</span><span class="token punctuation">"</span>star<span class="token punctuation">"</span></span> <span class="token punctuation">/></span></span>
      "
    `)
  })

  test('mdx className attribute', () => {
    expect(highlightCode("<MyBanner className='text-xl'>Short text</MyBanner>\n", 'mdx')).toMatchInlineSnapshot(`
      "<span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;</span><span class="token class-name">MyBanner</span></span> <span class="token attr-name">className</span><span class="token attr-value"><span class="token punctuation attr-equals">=</span><span class="token punctuation">'</span>text-xl<span class="token punctuation">'</span></span><span class="token punctuation">></span></span>Short text<span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;/</span><span class="token class-name">MyBanner</span></span><span class="token punctuation">></span></span>
      "
    `)
  })

  test('mdx jsx expression attributes', () => {
    expect(highlightCode('<Card href={url} icon={Star} />\n', 'mdx')).toMatchInlineSnapshot(`
      "<span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;</span><span class="token class-name">Card</span></span> <span class="token attr-name">href</span><span class="token script language-javascript"><span class="token script-punctuation punctuation">=</span><span class="token punctuation">{</span>url<span class="token punctuation">}</span></span> <span class="token attr-name">icon</span><span class="token script language-javascript"><span class="token script-punctuation punctuation">=</span><span class="token punctuation">{</span><span class="token maybe-class-name">Star</span><span class="token punctuation">}</span></span> <span class="token punctuation">/></span></span>
      "
    `)
  })

  test('mdx multiline named import includes the from line', () => {
    expect(highlightCode(dedent`
      import {
        Foo,
        Bar,
      } from './foo'
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token mdx-esm language-javascript"><span class="token keyword module">import</span> <span class="token imports"><span class="token punctuation">{</span>
        <span class="token maybe-class-name">Foo</span><span class="token punctuation">,</span>
        <span class="token maybe-class-name">Bar</span><span class="token punctuation">,</span>
      <span class="token punctuation">}</span></span> <span class="token keyword module">from</span> <span class="token string">'./foo'</span></span>"
    `)
  })

  test('mdx export from', () => {
    expect(highlightCode("export { Foo } from './foo'\n", 'mdx')).toMatchInlineSnapshot(`
      "<span class="token mdx-esm language-javascript"><span class="token keyword module">export</span> <span class="token exports"><span class="token punctuation">{</span> <span class="token maybe-class-name">Foo</span> <span class="token punctuation">}</span></span> <span class="token keyword module">from</span> <span class="token string">'./foo'</span></span>
      "
    `)
  })

  test('mdx multiline export from', () => {
    expect(highlightCode(dedent`
      export {
        Foo,
      } from './foo'
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token mdx-esm language-javascript"><span class="token keyword module">export</span> <span class="token exports"><span class="token punctuation">{</span>
        <span class="token maybe-class-name">Foo</span><span class="token punctuation">,</span>
      <span class="token punctuation">}</span></span> <span class="token keyword module">from</span> <span class="token string">'./foo'</span></span>"
    `)
  })

  test('mdx import type', () => {
    expect(highlightCode("import type { Foo } from './foo'\n", 'mdx')).toMatchInlineSnapshot(`
      "<span class="token mdx-esm language-javascript"><span class="token keyword module">import</span> type <span class="token punctuation">{</span> <span class="token maybe-class-name">Foo</span> <span class="token punctuation">}</span> <span class="token keyword module">from</span> <span class="token string">'./foo'</span></span>
      "
    `)
  })

  test('mdx side-effect import', () => {
    expect(highlightCode("import './bar'\n", 'mdx')).toMatchInlineSnapshot(`
      "<span class="token mdx-esm language-javascript"><span class="token keyword module">import</span> <span class="token string">'./bar'</span></span>
      "
    `)
  })

  test('mdx export default function', () => {
    expect(highlightCode(dedent`
      export default function Foo() {
        return 1
      }
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token mdx-esm language-javascript"><span class="token keyword module">export</span> <span class="token keyword module">default</span> <span class="token keyword">function</span> <span class="token function"><span class="token maybe-class-name">Foo</span></span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token punctuation">{</span>
        <span class="token keyword control-flow">return</span> <span class="token number">1</span>
      <span class="token punctuation">}</span></span>"
    `)
  })

  test('mdx nested ts fence inner-highlights', () => {
    expect(highlightCode(dedent`
      \`\`\`ts
      const greeting = "Hello"
      \`\`\`
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token code"><span class="token punctuation">\`\`\`</span><span class="token code-language">ts</span>
      <span class="token code-block language-ts"><span class="token keyword">const</span> greeting <span class="token operator">=</span> <span class="token string">"Hello"</span></span>
      <span class="token punctuation">\`\`\`</span></span>"
    `)
  })

  test('mdx nested json fence inner-highlights', () => {
    expect(highlightCode(dedent`
      \`\`\`json
      { "a": 1 }
      \`\`\`
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token code"><span class="token punctuation">\`\`\`</span><span class="token code-language">json</span>
      <span class="token code-block language-json"><span class="token punctuation">{</span> <span class="token property">"a"</span><span class="token operator">:</span> <span class="token number">1</span> <span class="token punctuation">}</span></span>
      <span class="token punctuation">\`\`\`</span></span>"
    `)
  })

  test('mdx nested yaml fence inner-highlights', () => {
    expect(highlightCode(dedent`
      \`\`\`yaml
      name: Deploy
      \`\`\`
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token code"><span class="token punctuation">\`\`\`</span><span class="token code-language">yaml</span>
      <span class="token code-block language-yaml"><span class="token key atrule">name</span><span class="token punctuation">:</span> Deploy</span>
      <span class="token punctuation">\`\`\`</span></span>"
    `)
  })

  test('mdx nested mermaid fence inner-highlights', () => {
    expect(highlightCode(dedent`
      \`\`\`mermaid
      graph TD
        A-->B
      \`\`\`
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token code"><span class="token punctuation">\`\`\`</span><span class="token code-language">mermaid</span>
      <span class="token code-block language-mermaid"><span class="token keyword">graph</span> TD
        A<span class="token arrow operator">--></span>B</span>
      <span class="token punctuation">\`\`\`</span></span>"
    `)
  })

  test('mdx frontmatter import heading and jsx together', () => {
    expect(highlightCode(dedent`
      ---
      title: Auth
      ---

      import Foo from './foo'

      # Auth

      <Note>
      Use a key.
      </Note>
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token front-matter-block"><span class="token punctuation">---</span>
      <span class="token front-matter yaml language-yaml"><span class="token key atrule">title</span><span class="token punctuation">:</span> Auth</span>
      <span class="token punctuation">---</span></span>

      <span class="token mdx-esm language-javascript"><span class="token keyword module">import</span> <span class="token imports"><span class="token maybe-class-name">Foo</span></span> <span class="token keyword module">from</span> <span class="token string">'./foo'</span></span>

      <span class="token title important"><span class="token punctuation">#</span> Auth</span>

      <span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;</span><span class="token class-name">Note</span></span><span class="token punctuation">></span></span>
      Use a key.
      <span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;/</span><span class="token class-name">Note</span></span><span class="token punctuation">></span></span>"
    `)
  })

  test('mdx mid-page hr is not frontmatter', () => {
    expect(highlightCode(dedent`
      # Title

      ---

      After the rule.
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token title important"><span class="token punctuation">#</span> Title</span>

      <span class="token hr punctuation">---</span>

      After the rule."
    `)
  })

  test('mdx list bold code and link', () => {
    expect(highlightCode(dedent`
      - **bold** and \`code\`
      - [link](https://example.com)
    `, 'mdx')).toMatchInlineSnapshot(`
      "<span class="token list punctuation">-</span> <span class="token bold"><span class="token punctuation">**</span><span class="token content">bold</span><span class="token punctuation">**</span></span> and <span class="token code-snippet code keyword">\`code\`</span>
      <span class="token list punctuation">-</span> <span class="token url">[<span class="token content">link</span>](<span class="token url">https://example.com</span>)</span>"
    `)
  })

  test('mdx blockquote', () => {
    expect(highlightCode('> quoted text\n', 'mdx')).toMatchInlineSnapshot(`
      "<span class="token blockquote punctuation">></span> quoted text
      "
    `)
  })

  test('mdx crlf frontmatter', () => {
    expect(highlightCode('---\r\ntitle: Hello\r\n---\r\n\r\n# Hi\r\n', 'mdx')).toMatchInlineSnapshot(`
      "<span class="token front-matter-block"><span class="token punctuation">---</span>
      <span class="token front-matter yaml language-yaml"><span class="token key atrule">title</span><span class="token punctuation">:</span> Hello</span>
      <span class="token punctuation">---</span></span>

      <span class="token title important"><span class="token punctuation">#</span> Hi</span>
      "
    `)
  })

  test('diagram box drawing and labels', () => {
    expect(highlightCode('┌─A─┐\n│ B │\n└───┘', 'diagram')).toMatchInlineSnapshot(`
      "<span class="token box-drawing">┌─</span><span class="token label">A</span><span class="token box-drawing">─┐</span>
      <span class="token box-drawing">│</span> <span class="token label">B</span> <span class="token box-drawing">│</span>
      <span class="token box-drawing">└───┘</span>"
    `)
  })

  test('diagram arrows', () => {
    const html = highlightCode('docs.json ───► Vite Plugin', 'diagram')
    expect(html).toContain('token line-char')
    expect(html).not.toMatch(/token label">►/)
    expect(html).toMatchInlineSnapshot(`"<span class="token label">docs.json</span> <span class="token box-drawing">───</span><span class="token line-char">►</span> <span class="token label">Vite</span> <span class="token label">Plugin</span>"`)
  })

  test('diagram mixed boxes and arrows', () => {
    expect(highlightCode(dedent`
      ┌───────────────┐
      docs.jsonc ───►│  Vite Plugin  │──────► Build
                     └───────┬───────┘
    `, 'diagram')).toMatchInlineSnapshot(`
      "<span class="token box-drawing">┌───────────────┐</span>
      <span class="token label">docs.jsonc</span> <span class="token box-drawing">───</span><span class="token line-char">►</span><span class="token box-drawing">│</span>  <span class="token label">Vite</span> <span class="token label">Plugin</span>  <span class="token box-drawing">│──────</span><span class="token line-char">►</span> <span class="token label">Build</span>
                     <span class="token box-drawing">└───────┬───────┘</span>"
    `)
  })

  test('diagram ascii arrows use line-char', () => {
    expect(highlightCode('A --> B\nfoo | bar', 'diagram')).toMatchInlineSnapshot(`
      "<span class="token label">A</span> <span class="token line-char">--></span> <span class="token label">B</span>
      <span class="token label">foo</span> <span class="token line-char">|</span> <span class="token label">bar</span>"
    `)
  })

  test('diagram caret plus and slash are line-char', () => {
    const html = highlightCode('A --^ B\n+---+\n / \\\n', 'diagram')
    expect(html).not.toMatch(/token label">\^/)
    expect(html).not.toMatch(/token label">\+/)
    expect(html).toMatchInlineSnapshot(`
      "<span class="token label">A</span> <span class="token line-char">--^</span> <span class="token label">B</span>
      <span class="token line-char">+---+</span>
       <span class="token line-char">/</span> <span class="token line-char">\\</span>
      "
    `)
  })

  test('css extras variable hexcode unit', () => {
    expect(highlightCode(':root { --brand: #ff0000; margin: 10px }', 'css')).toMatchInlineSnapshot(`"<span class="token selector"><span class="token pseudo-class">:root</span></span> <span class="token punctuation">{</span> <span class="token variable">--brand</span><span class="token punctuation">:</span> <span class="token hexcode color">#ff0000</span><span class="token punctuation">;</span> <span class="token property">margin</span><span class="token punctuation">:</span> <span class="token number">10</span><span class="token unit">px</span> <span class="token punctuation">}</span>"`)
  })

  test('js extras known-class-name on typescript', () => {
    expect(highlightCode('const x = Math.PI', 'ts')).toMatchInlineSnapshot(`"<span class="token keyword">const</span> x <span class="token operator">=</span> <span class="token known-class-name class-name">Math</span><span class="token punctuation">.</span><span class="token constant">PI</span>"`)
  })

  test('js templates highlight nested html', () => {
    expect(highlightCode('html`<div>${x}</div>`', 'js')).toMatchInlineSnapshot(`"html<span class="token template-string"><span class="token template-punctuation string">\`</span><span class="token html language-html"><span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;</span>div</span><span class="token punctuation">></span></span><span class="token interpolation"><span class="token interpolation-punctuation punctuation">\${</span>x<span class="token interpolation-punctuation punctuation">}</span></span><span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;/</span>div</span><span class="token punctuation">></span></span></span><span class="token template-punctuation string">\`</span></span>"`)
  })

  test('html inline style and script grammars', () => {
    expect(highlightCode('<style>.a{color:red}</style><script>var a=1</script>', 'html')).toMatchInlineSnapshot(`"<span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;</span>style</span><span class="token punctuation">></span></span><span class="token style"><span class="token language-css"><span class="token selector"><span class="token class">.a</span></span><span class="token punctuation">{</span><span class="token property">color</span><span class="token punctuation">:</span><span class="token color">red</span><span class="token punctuation">}</span></span></span><span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;/</span>style</span><span class="token punctuation">></span></span><span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;</span>script</span><span class="token punctuation">></span></span><span class="token script"><span class="token language-javascript"><span class="token keyword">var</span> a<span class="token operator">=</span><span class="token number">1</span></span></span><span class="token tag"><span class="token tag"><span class="token punctuation">&#x3C;/</span>script</span><span class="token punctuation">></span></span>"`)
  })

  test('bash colors commands outside the unix allowlist', () => {
    expect(highlightCode('npx @subrouter/cli login anthropic', 'bash')).toMatchInlineSnapshot(
      `"<span class="token function">npx</span> <span class="token package property">@subrouter/cli</span> login anthropic"`,
    )
  })

  test('bash colors the first command on each pipeline segment', () => {
    expect(highlightCode('cat file | wrangler deploy', 'bash')).toMatchInlineSnapshot(
      `"<span class="token function">cat</span> file <span class="token operator">|</span> <span class="token function">wrangler</span> deploy"`,
    )
  })

  test('bash keeps flags, strings, and control keywords', () => {
    expect(highlightCode('git commit -m "x"\nif true; then echo hi; fi', 'bash')).toMatchInlineSnapshot(`
      "<span class="token function">git</span> commit <span class="token parameter variable">-m</span> <span class="token string">"x"</span>
      <span class="token keyword">if</span> <span class="token boolean">true</span><span class="token punctuation">;</span> <span class="token keyword">then</span> <span class="token function">echo</span> hi<span class="token punctuation">;</span> <span class="token keyword">fi</span>"
    `)
  })

  test('http json body uses content-type grammar', () => {
    expect(highlightCode('HTTP/1.1 200 OK\nContent-Type: application/json\n\n{ "id": 1 }\n', 'http')).toMatchInlineSnapshot(`
      "<span class="token response-status"><span class="token http-version property">HTTP/1.1</span> <span class="token status-code number">200</span> <span class="token reason-phrase string">OK</span></span>
      <span class="token header"><span class="token header-name keyword">Content-Type</span><span class="token punctuation">:</span> <span class="token header-value">application/json</span></span>
      <span class="token application-json">
      <span class="token punctuation">{</span> <span class="token property">"id"</span><span class="token operator">:</span> <span class="token number">1</span> <span class="token punctuation">}</span>
      </span>"
    `)
  })
})
