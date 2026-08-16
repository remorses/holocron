/**
 * Server-only syntax highlighting via refractor (Prism grammars, hast output).
 * Do not import from client components or the highlighter lands in the browser.
 *
 * Uses `refractor/core` plus langs that show up in real product docs.
 * Do not import `refractor` (36 langs) or `refractor/all` (~297 langs).
 * Unknown langs render as plain text.
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

const grammarsRegistered = Symbol.for('@holocron.so/vite/refractor-docs-grammars-v2')

/** Refractor's registry is process-global. RSC remount re-runs this module. */
export function registerExtraGrammars() {
  if (!Reflect.get(refractor.languages, grammarsRegistered)) {
    for (const grammar of docsGrammars) {
      const name = grammar.displayName
      if (name && refractor.registered(name)) continue
      refractor.register(grammar)
    }
    Reflect.set(refractor.languages, grammarsRegistered, true)
  }
  refractor.alias({ json: 'jsonc', markdown: 'mdx' })
  refractor.languages.diagram = {
    'box-drawing': /[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷]+/,
    'line-char': /[-_|<>]+/,
    label: /[^\s┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷\-_|<>]+/,
  }
}

registerExtraGrammars()

/** Highlight code on the server. Unknown langs return undefined. */
export function highlightCode(code: string, lang?: string): string | undefined {
  const id = lang?.trim().toLowerCase()
  if (!id || !refractor.registered(id)) return undefined
  return toHtml(refractor.highlight(code, id))
}

export function HighlightedCodeBlock(props: ComponentProps<typeof CodeBlock>) {
  return <CodeBlock {...props} highlightedHtml={highlightCode(props.children, props.lang)} />
}
