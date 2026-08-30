/**
 * Server-only syntax highlighting via refractor (Prism grammars, hast output).
 * Do not import from client components or the highlighter lands in the browser.
 *
 * Uses `refractor/core` plus langs that show up in real product docs.
 * Do not import `refractor` (36 langs) or `refractor/all` (~297 langs).
 * Unknown langs render as plain text.
 *
 * Grammars stay statically imported (wrangler evaluates `import()` at boot today)
 * but `refractor.register` runs only when highlightCode needs that lang.
 * First highlight installs a small core set in Prism order (markup, css+extras,
 * javascript+extras, json) so html/http/ts keep embedded and extras tokens.
 * TODO: switch each `refractor/<lang>` import to `import()` when Cloudflare
 * Workers can leave those chunks unevaluated until first use.
 */

import type { ComponentProps } from 'react'
import type { Syntax } from 'refractor/core'
import { refractor } from 'refractor/core'
import { toHtml } from 'hast-util-to-html'
import { CodeBlock } from '../components/markdown/code-block.tsx'

import apacheconf from 'refractor/apacheconf'
import bash from 'refractor/bash'
import batch from 'refractor/batch'
import bicep from 'refractor/bicep'
import c from 'refractor/c'
import clike from 'refractor/clike'
import cmake from 'refractor/cmake'
import cpp from 'refractor/cpp'
import csharp from 'refractor/csharp'
import cshtml from 'refractor/cshtml'
import css from 'refractor/css'
import cssExtras from 'refractor/css-extras'
import csv from 'refractor/csv'
import dart from 'refractor/dart'
import diff from 'refractor/diff'
import django from 'refractor/django'
import docker from 'refractor/docker'
import editorconfig from 'refractor/editorconfig'
import elixir from 'refractor/elixir'
import gdscript from 'refractor/gdscript'
import git from 'refractor/git'
import glsl from 'refractor/glsl'
import go from 'refractor/go'
import gradle from 'refractor/gradle'
import graphql from 'refractor/graphql'
import groovy from 'refractor/groovy'
import handlebars from 'refractor/handlebars'
import hcl from 'refractor/hcl'
import http from 'refractor/http'
import ignore from 'refractor/ignore'
import ini from 'refractor/ini'
import java from 'refractor/java'
import javascript from 'refractor/javascript'
import jq from 'refractor/jq'
import jsExtras from 'refractor/js-extras'
import jsTemplates from 'refractor/js-templates'
import jsdoc from 'refractor/jsdoc'
import json from 'refractor/json'
import json5 from 'refractor/json5'
import jsx from 'refractor/jsx'
import kotlin from 'refractor/kotlin'
import latex from 'refractor/latex'
import less from 'refractor/less'
import liquid from 'refractor/liquid'
import log from 'refractor/log'
import lua from 'refractor/lua'
import makefile from 'refractor/makefile'
import markdown from 'refractor/markdown'
import markup from 'refractor/markup'
import markupTemplating from 'refractor/markup-templating'
import mermaid from 'refractor/mermaid'
import nginx from 'refractor/nginx'
import nix from 'refractor/nix'
import objectivec from 'refractor/objectivec'
import php from 'refractor/php'
import plantUml from 'refractor/plant-uml'
import powershell from 'refractor/powershell'
import properties from 'refractor/properties'
import protobuf from 'refractor/protobuf'
import python from 'refractor/python'
import r from 'refractor/r'
import regex from 'refractor/regex'
import ruby from 'refractor/ruby'
import rust from 'refractor/rust'
import sass from 'refractor/sass'
import scala from 'refractor/scala'
import scss from 'refractor/scss'
import shellSession from 'refractor/shell-session'
import solidity from 'refractor/solidity'
import sql from 'refractor/sql'
import swift from 'refractor/swift'
import systemd from 'refractor/systemd'
import toml from 'refractor/toml'
import tsx from 'refractor/tsx'
import typescript from 'refractor/typescript'
import wasm from 'refractor/wasm'
import yaml from 'refractor/yaml'
import zig from 'refractor/zig'

const docsGrammars: Syntax[] = [
  markup,
  clike,
  regex,
  css,
  cssExtras,
  javascript,
  jsExtras,
  jsTemplates,
  jsdoc,
  markupTemplating,
  c,
  cpp,
  csharp,
  objectivec,
  json,
  json5,
  markdown,
  yaml,
  bash,
  shellSession,
  python,
  go,
  rust,
  java,
  sql,
  diff,
  toml,
  ini,
  ruby,
  kotlin,
  swift,
  php,
  typescript,
  jsx,
  tsx,
  docker,
  graphql,
  hcl,
  nginx,
  http,
  powershell,
  scss,
  sass,
  less,
  lua,
  makefile,
  dart,
  solidity,
  zig,
  wasm,
  nix,
  bicep,
  protobuf,
  git,
  editorconfig,
  ignore,
  properties,
  mermaid,
  plantUml,
  log,
  csv,
  jq,
  elixir,
  scala,
  r,
  batch,
  cmake,
  apacheconf,
  gradle,
  groovy,
  glsl,
  latex,
  handlebars,
  liquid,
  django,
  gdscript,
  cshtml,
  systemd,
]

const MODIFIER_GRAMMARS = new Set([
  'css-extras',
  'js-extras',
  'js-templates',
  'markup-templating',
])

const CORE_GRAMMARS: Syntax[] = [
  markup,
  css,
  cssExtras,
  javascript,
  jsExtras,
  jsTemplates,
  json,
]

const coreRegistered = Symbol.for('@holocron.so/vite/refractor-core-grammars-v1')

const grammarById = new Map<string, Syntax>()
for (const grammar of docsGrammars) {
  if (MODIFIER_GRAMMARS.has(grammar.displayName)) continue
  grammarById.set(grammar.displayName, grammar)
  for (const alias of grammar.aliases ?? []) grammarById.set(alias, grammar)
}
grammarById.set('jsonc', json)

function ensureCore() {
  if (Reflect.get(refractor.languages, coreRegistered)) return
  for (const grammar of CORE_GRAMMARS) refractor.register(grammar)
  refractor.alias({ json: 'jsonc' })
  Reflect.set(refractor.languages, coreRegistered, true)
}

function installDiagramGrammar() {
  refractor.languages.diagram = {
    'box-drawing': /[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷]+/,
    'line-char': /[-_|<>^►◄▼▲→←↑↓+/\\]+/,
    label: /[^\s┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷\-_|<>^►◄▼▲→←↑↓+/\\]+/,
  }
}

// Prism bash colors a Unix allowlist (npx missing; `file` as an arg still hits).
// Color the first word of each statement instead, like VS Code shellscript.
function installRicherBashGrammar() {
  const prism: any = refractor
  const bash: any = prism.languages.bash
  if (!bash?.function || prism._holocronRicherCommands) return
  prism._holocronRicherCommands = true

  // greedy + lookbehind against the full string. Non-greedy `^` is per remaining
  // chunk, so every word would match. `m` makes `^` a real line start.
  const command = {
    greedy: true,
    lookbehind: true,
    pattern:
      /((?:^|[;|&]|[<>]\(|\b(?:then|do|else|elif))\s*)(?!(?:if|then|else|elif|fi|for|while|until|do|done|case|esac|function|select)\b)(?:(?:sudo|doas|nohup|time|exec|command|builtin|env)\s+)?[a-zA-Z_./~][^\s;|&<>()]*/m,
  }
  bash.function = command
  const subst = bash.variable?.[1]?.inside
  if (subst) subst.function = command

  prism.languages.insertBefore('bash', 'function', {
    package: {
      pattern: /(?:npm:)?@[a-zA-Z0-9._-]+\/[a-zA-Z0-9._/-]+/,
      alias: 'property',
    },
  })
  const bashAfter = prism.languages.bash
  const substAfter = bashAfter.variable?.[1]?.inside
  if (substAfter && bashAfter.package && !substAfter.package) {
    substAfter.package = bashAfter.package
  }
}

// Prism markdown has YAML frontmatter, but only if yaml is registered first
// (`inside: Prism.languages.yaml` is captured at register time). There is no
// official Prism MDX grammar; the TextMate one is wooorm/markdown-tm-language.
function wireYamlFrontmatter(grammar) {
  const matter = grammar?.['front-matter-block']?.inside?.['front-matter']
  if (matter) matter.inside = refractor.languages.yaml
}

// First md/mdx fence registers every docs lang so nested ```ts blocks highlight.
function registerDocsGrammars() {
  const prism: any = refractor
  if (prism._holocronDocsGrammars) return
  prism._holocronDocsGrammars = true
  for (const grammar of docsGrammars) {
    if (MODIFIER_GRAMMARS.has(grammar.displayName)) continue
    if (!refractor.registered(grammar.displayName)) refractor.register(grammar)
  }
}

function ensureMarkdownWithFrontmatter() {
  if (!refractor.registered('yaml')) refractor.register(yaml)
  if (!refractor.registered('markdown')) refractor.register(markdown)
  wireYamlFrontmatter(refractor.languages.markdown)
  registerDocsGrammars()
  installNestedFenceHook()
}

function walkMarkdownCodeFences(tokens) {
  if (!tokens || typeof tokens === 'string' || !Array.isArray(tokens)) return
  for (const token of tokens) {
    if (!token || typeof token === 'string') continue
    if (token.type !== 'code') {
      walkMarkdownCodeFences(token.content)
      continue
    }
    const codeLang = token.content?.[1]
    const codeBlock = token.content?.[3]
    if (
      !codeLang ||
      !codeBlock ||
      codeLang.type !== 'code-language' ||
      codeBlock.type !== 'code-block' ||
      typeof codeLang.content !== 'string'
    ) continue
    let lang = codeLang.content.replace(/\b#/g, 'sharp').replace(/\b\+\+/g, 'pp')
    lang = (/[a-z][\w-]*/i.exec(lang) || [''])[0].toLowerCase()
    if (!lang) continue
    ensureLang(lang)
    const alias = 'language-' + lang
    if (!codeBlock.alias) codeBlock.alias = [alias]
    else if (typeof codeBlock.alias === 'string') {
      codeBlock.alias = codeBlock.alias === alias ? [alias] : [codeBlock.alias, alias]
    } else if (!codeBlock.alias.includes(alias)) {
      codeBlock.alias.push(alias)
    }
  }
}

function installNestedFenceHook() {
  const prism: any = refractor
  prism._holocronWalkMarkdownCodeFences = walkMarkdownCodeFences
  if (prism._holocronNestedFenceHook) return
  prism._holocronNestedFenceHook = true
  prism.hooks.add('after-tokenize', (env) => {
    if (env.language !== 'mdx' && env.language !== 'markdown' && env.language !== 'md') return
    prism._holocronWalkMarkdownCodeFences(env.tokens)
  })
}

function installMdxGrammar() {
  ensureMarkdownWithFrontmatter()
  if (!refractor.registered('jsx')) refractor.register(jsx)
  const prism: any = refractor
  if (prism.languages.mdx && prism.languages.mdx !== prism.languages.markdown) {
    installNestedFenceHook()
    return
  }
  const mdx = prism.languages.extend('markdown', {})
  mdx.tag = prism.languages.jsx.tag
  wireYamlFrontmatter(mdx)
  prism.languages.mdx = mdx
  prism.languages.insertBefore('mdx', 'blockquote', {
    'mdx-esm': {
      // Until the next blank line. MDX requires a blank line before markdown.
      pattern: /^(?:import|export)\b[^\r\n]*(?:(?:\r\n?|\n)(?![ \t]*$)[^\r\n]*)*/m,
      greedy: true,
      alias: 'language-javascript',
      inside: prism.languages.javascript,
    },
  })
  installNestedFenceHook()
}

/** Refractor's registry is process-global. RSC remount re-runs this module. */
function ensureLang(id: string): boolean {
  if (id === 'diagram') {
    installDiagramGrammar()
    return true
  }
  if (id === 'mdx') {
    ensureCore()
    installMdxGrammar()
    return Boolean(refractor.languages.mdx)
  }
  if (id === 'markdown' || id === 'md') {
    ensureCore()
    ensureMarkdownWithFrontmatter()
    return true
  }
  const grammar = grammarById.get(id)
  if (!grammar && !refractor.registered(id)) return false
  ensureCore()
  if (refractor.registered(id)) return true
  if (!grammar) return false
  if (!refractor.registered(grammar.displayName)) refractor.register(grammar)
  return refractor.registered(id)
}

/** Highlight code on the server. Unknown langs return undefined. */
export function highlightCode(code: string, lang?: string): string | undefined {
  const id = lang?.trim().toLowerCase()
  if (!id || !ensureLang(id)) return undefined
  if (refractor.registered('bash')) installRicherBashGrammar()
  return toHtml(refractor.highlight(code, id))
}

export function HighlightedCodeBlock(props: ComponentProps<typeof CodeBlock>) {
  const highlightedHtml = highlightCode(props.children, props.lang)
  return <CodeBlock {...props} title={props.title ?? props.lang} highlightedHtml={highlightedHtml} />
}
