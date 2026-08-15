/**
 * Server-only syntax highlighting via refractor (Prism grammars, hast output).
 * Do not import from client components or the highlighter lands in the browser.
 *
 * Uses `refractor` (36 common langs) plus the extra grammars Holocron used to
 * ship in the Prism bundle. Avoid `refractor/all` — that is ~297 langs and
 * adds ~900 KiB to the RSC worker.
 */

import type { ComponentProps } from 'react'
import type { Syntax } from 'refractor/core'
import { refractor } from 'refractor'
import { toHtml } from 'hast-util-to-html'
import { CodeBlock } from '../components/markdown/code-block.tsx'

import apacheconf from 'refractor/apacheconf'
import applescript from 'refractor/applescript'
import armasm from 'refractor/armasm'
import awk from 'refractor/awk'
import batch from 'refractor/batch'
import bicep from 'refractor/bicep'
import bnf from 'refractor/bnf'
import cmake from 'refractor/cmake'
import clojure from 'refractor/clojure'
import coffeescript from 'refractor/coffeescript'
import cshtml from 'refractor/cshtml'
import cssExtras from 'refractor/css-extras'
import csv from 'refractor/csv'
import dart from 'refractor/dart'
import django from 'refractor/django'
import docker from 'refractor/docker'
import dot from 'refractor/dot'
import ebnf from 'refractor/ebnf'
import editorconfig from 'refractor/editorconfig'
import ejs from 'refractor/ejs'
import elixir from 'refractor/elixir'
import elm from 'refractor/elm'
import erb from 'refractor/erb'
import erlang from 'refractor/erlang'
import fsharp from 'refractor/fsharp'
import gdscript from 'refractor/gdscript'
import git from 'refractor/git'
import glsl from 'refractor/glsl'
import gradle from 'refractor/gradle'
import graphql from 'refractor/graphql'
import groovy from 'refractor/groovy'
import haml from 'refractor/haml'
import handlebars from 'refractor/handlebars'
import haskell from 'refractor/haskell'
import hcl from 'refractor/hcl'
import http from 'refractor/http'
import ignore from 'refractor/ignore'
import javadoc from 'refractor/javadoc'
import javadoclike from 'refractor/javadoclike'
import jq from 'refractor/jq'
import jsExtras from 'refractor/js-extras'
import jsTemplates from 'refractor/js-templates'
import jsdoc from 'refractor/jsdoc'
import json5 from 'refractor/json5'
import jsonp from 'refractor/jsonp'
import jsx from 'refractor/jsx'
import julia from 'refractor/julia'
import latex from 'refractor/latex'
import liquid from 'refractor/liquid'
import lisp from 'refractor/lisp'
import llvm from 'refractor/llvm'
import log from 'refractor/log'
import matlab from 'refractor/matlab'
import mermaid from 'refractor/mermaid'
import nasm from 'refractor/nasm'
import nginx from 'refractor/nginx'
import nim from 'refractor/nim'
import nix from 'refractor/nix'
import ocaml from 'refractor/ocaml'
import odin from 'refractor/odin'
import pascal from 'refractor/pascal'
import plantUml from 'refractor/plant-uml'
import powershell from 'refractor/powershell'
import prolog from 'refractor/prolog'
import promql from 'refractor/promql'
import properties from 'refractor/properties'
import protobuf from 'refractor/protobuf'
import pug from 'refractor/pug'
import puppet from 'refractor/puppet'
import purescript from 'refractor/purescript'
import racket from 'refractor/racket'
import reason from 'refractor/reason'
import rego from 'refractor/rego'
import rescript from 'refractor/rescript'
import rest from 'refractor/rest'
import scala from 'refractor/scala'
import scheme from 'refractor/scheme'
import shellSession from 'refractor/shell-session'
import solidity from 'refractor/solidity'
import stylus from 'refractor/stylus'
import systemd from 'refractor/systemd'
import tcl from 'refractor/tcl'
import textile from 'refractor/textile'
import toml from 'refractor/toml'
import tsx from 'refractor/tsx'
import twig from 'refractor/twig'
import uri from 'refractor/uri'
import v from 'refractor/v'
import verilog from 'refractor/verilog'
import vhdl from 'refractor/vhdl'
import vim from 'refractor/vim'
import wasm from 'refractor/wasm'
import wgsl from 'refractor/wgsl'
import wren from 'refractor/wren'
import zig from 'refractor/zig'

const extraGrammars: Syntax[] = [
  uri,
  cssExtras,
  jsExtras,
  jsTemplates,
  javadoclike,
  scheme,
  haskell,
  apacheconf,
  applescript,
  armasm,
  awk,
  batch,
  bicep,
  bnf,
  cmake,
  clojure,
  coffeescript,
  csv,
  dart,
  django,
  docker,
  dot,
  ebnf,
  editorconfig,
  ejs,
  elixir,
  elm,
  erb,
  erlang,
  fsharp,
  gdscript,
  git,
  glsl,
  gradle,
  graphql,
  groovy,
  haml,
  handlebars,
  hcl,
  http,
  ignore,
  javadoc,
  jq,
  jsdoc,
  json5,
  jsonp,
  jsx,
  julia,
  latex,
  liquid,
  lisp,
  llvm,
  log,
  matlab,
  mermaid,
  nasm,
  nginx,
  nim,
  nix,
  ocaml,
  odin,
  pascal,
  plantUml,
  powershell,
  prolog,
  promql,
  properties,
  protobuf,
  pug,
  puppet,
  purescript,
  racket,
  reason,
  rego,
  rescript,
  rest,
  scala,
  shellSession,
  solidity,
  stylus,
  systemd,
  tcl,
  textile,
  toml,
  tsx,
  twig,
  v,
  verilog,
  vhdl,
  vim,
  wasm,
  wgsl,
  wren,
  zig,
  cshtml,
]

const extraGrammarsRegistered = Symbol.for('@holocron.so/vite/refractor-extra-grammars-v1')

/** Refractor's registry is process-global. RSC remount re-runs this module. */
export function registerExtraGrammars() {
  if (!Reflect.get(refractor.languages, extraGrammarsRegistered)) {
    for (const grammar of extraGrammars) {
      const name = grammar.displayName
      if (name && refractor.registered(name)) continue
      refractor.register(grammar)
    }
    Reflect.set(refractor.languages, extraGrammarsRegistered, true)
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
