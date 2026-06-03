/**
 * esbuild entrypoint for bundle-prism.ts.
 *
 * Contains the raw prismjs imports that get bundled into a single ESM file.
 * This is separate from src/prism.ts (which re-exports from the bundle)
 * to avoid a circular dependency during generation.
 *
 * Only popular/trendy languages are included to keep the bundle small (~470 KB
 * vs ~890 KB with all ~300 languages). If a user needs an obscure language,
 * they can open an issue.
 *
 * IMPORTANT: import order matters! Prism components are CJS IIFEs that mutate
 * a global `Prism` object. A component that `require`s another must come AFTER
 * its dependency. The ordering below follows the dependency graph from
 * prismjs/components.json.
 */

import prismComponents from 'prismjs/components.json' with { type: 'json' }
import 'prismjs'
import * as PrismModule from 'prismjs'

// ── Layer 0: core (no deps) ──
import 'prismjs/components/prism-markup.js'
import 'prismjs/components/prism-css.js'
import 'prismjs/components/prism-clike.js'
import 'prismjs/components/prism-regex.js'

// ── Layer 1: depends on core ──
import 'prismjs/components/prism-javascript.js' // requires: clike
import 'prismjs/components/prism-c.js' // requires: clike
import 'prismjs/components/prism-markup-templating.js' // requires: markup
import 'prismjs/components/prism-css-extras.js' // requires: css
import 'prismjs/components/prism-less.js' // requires: css
import 'prismjs/components/prism-scss.js' // requires: css
import 'prismjs/components/prism-sass.js' // requires: css
import 'prismjs/components/prism-textile.js' // requires: markup
import 'prismjs/components/prism-json.js'
import 'prismjs/components/prism-xml-doc.js' // requires: markup
import 'prismjs/components/prism-markdown.js' // requires: markup
import 'prismjs/components/prism-ruby.js' // requires: clike
import 'prismjs/components/prism-csharp.js' // requires: clike
import 'prismjs/components/prism-dart.js' // requires: clike
import 'prismjs/components/prism-go.js' // requires: clike
import 'prismjs/components/prism-kotlin.js' // requires: clike
import 'prismjs/components/prism-reason.js' // requires: clike
import 'prismjs/components/prism-solidity.js' // requires: clike
import 'prismjs/components/prism-v.js' // requires: clike
import 'prismjs/components/prism-protobuf.js' // requires: clike
import 'prismjs/components/prism-gradle.js' // requires: clike
import 'prismjs/components/prism-groovy.js' // requires: clike
import 'prismjs/components/prism-fsharp.js' // requires: clike
import 'prismjs/components/prism-haskell.js'
import 'prismjs/components/prism-basic.js'
import 'prismjs/components/prism-bash.js'
import 'prismjs/components/prism-yaml.js'
import 'prismjs/components/prism-sql.js'
import 'prismjs/components/prism-python.js'
import 'prismjs/components/prism-lua.js'
import 'prismjs/components/prism-scheme.js'
import 'prismjs/components/prism-uri.js'
import 'prismjs/components/prism-stylus.js'
import 'prismjs/components/prism-perl.js'
import 'prismjs/components/prism-r.js'
import 'prismjs/components/prism-julia.js'
import 'prismjs/components/prism-matlab.js'
import 'prismjs/components/prism-clojure.js'
import 'prismjs/components/prism-elm.js'
import 'prismjs/components/prism-ocaml.js'
import 'prismjs/components/prism-lisp.js'
import 'prismjs/components/prism-prolog.js'
import 'prismjs/components/prism-hcl.js'
import 'prismjs/components/prism-bicep.js'
import 'prismjs/components/prism-nix.js'
import 'prismjs/components/prism-diff.js'
import 'prismjs/components/prism-git.js'
import 'prismjs/components/prism-toml.js'
import 'prismjs/components/prism-ini.js'
import 'prismjs/components/prism-properties.js'
import 'prismjs/components/prism-editorconfig.js'
import 'prismjs/components/prism-ignore.js'
import 'prismjs/components/prism-makefile.js'
import 'prismjs/components/prism-log.js'
import 'prismjs/components/prism-csv.js'
import 'prismjs/components/prism-promql.js'
import 'prismjs/components/prism-jq.js'
import 'prismjs/components/prism-rego.js'
import 'prismjs/components/prism-rust.js'
import 'prismjs/components/prism-zig.js'
import 'prismjs/components/prism-odin.js'
import 'prismjs/components/prism-nim.js'
import 'prismjs/components/prism-wasm.js'
import 'prismjs/components/prism-wgsl.js'
import 'prismjs/components/prism-llvm.js'
import 'prismjs/components/prism-armasm.js'
import 'prismjs/components/prism-nasm.js'
import 'prismjs/components/prism-mermaid.js'
import 'prismjs/components/prism-dot.js'
import 'prismjs/components/prism-plant-uml.js'
import 'prismjs/components/prism-latex.js'
import 'prismjs/components/prism-rest.js'
import 'prismjs/components/prism-bnf.js'
import 'prismjs/components/prism-ebnf.js'
import 'prismjs/components/prism-puppet.js'
import 'prismjs/components/prism-awk.js'
import 'prismjs/components/prism-tcl.js'
import 'prismjs/components/prism-vim.js'
import 'prismjs/components/prism-gdscript.js'
import 'prismjs/components/prism-wren.js'
import 'prismjs/components/prism-verilog.js'
import 'prismjs/components/prism-vhdl.js'
import 'prismjs/components/prism-pascal.js'
import 'prismjs/components/prism-applescript.js'
import 'prismjs/components/prism-swift.js'
import 'prismjs/components/prism-powershell.js'
import 'prismjs/components/prism-batch.js'
import 'prismjs/components/prism-nginx.js'
import 'prismjs/components/prism-apacheconf.js'
import 'prismjs/components/prism-systemd.js'
import 'prismjs/components/prism-cmake.js'
import 'prismjs/components/prism-erlang.js'
import 'prismjs/components/prism-rescript.js'

// ── Layer 2: depends on layer 1 ──
import 'prismjs/components/prism-cpp.js' // requires: c
import 'prismjs/components/prism-objectivec.js' // requires: c
import 'prismjs/components/prism-glsl.js' // requires: c
import 'prismjs/components/prism-java.js' // requires: clike
import 'prismjs/components/prism-typescript.js' // requires: javascript
import 'prismjs/components/prism-coffeescript.js' // requires: javascript
import 'prismjs/components/prism-js-templates.js' // requires: javascript
import 'prismjs/components/prism-js-extras.js' // requires: javascript
import 'prismjs/components/prism-json5.js' // requires: json
import 'prismjs/components/prism-jsonp.js' // requires: json
import 'prismjs/components/prism-http.js' // requires: uri
import 'prismjs/components/prism-shell-session.js' // requires: bash
import 'prismjs/components/prism-haml.js' // requires: ruby
import 'prismjs/components/prism-handlebars.js' // requires: markup-templating
import 'prismjs/components/prism-ejs.js' // requires: javascript, markup-templating
import 'prismjs/components/prism-django.js' // requires: markup-templating
import 'prismjs/components/prism-twig.js' // requires: markup-templating
import 'prismjs/components/prism-liquid.js' // requires: markup-templating
import 'prismjs/components/prism-php.js' // requires: markup-templating
import 'prismjs/components/prism-erb.js' // requires: ruby, markup-templating
import 'prismjs/components/prism-pug.js' // requires: markup, javascript
import 'prismjs/components/prism-cshtml.js' // requires: markup, csharp
import 'prismjs/components/prism-elixir.js'
import 'prismjs/components/prism-racket.js' // requires: scheme
import 'prismjs/components/prism-purescript.js' // requires: haskell
import 'prismjs/components/prism-vbnet.js' // requires: basic
import 'prismjs/components/prism-docker.js'
import 'prismjs/components/prism-go-module.js'
import 'prismjs/components/prism-graphql.js'

// ── Layer 3: depends on layer 2 ──
import 'prismjs/components/prism-scala.js' // requires: java
import 'prismjs/components/prism-javadoclike.js'
import 'prismjs/components/prism-jsx.js' // requires: markup, javascript
import 'prismjs/components/prism-javadoc.js' // requires: markup, java, javadoclike
import 'prismjs/components/prism-jsdoc.js' // requires: javascript, javadoclike, typescript

// ── Layer 4: depends on layer 3 ──
import 'prismjs/components/prism-tsx.js' // requires: jsx, typescript
import 'prismjs/components/prism-jsstacktrace.js'

const Prism = PrismModule.default ?? PrismModule

const markdownGrammar = Prism.languages.md ?? Prism.languages.markdown
const jsonGrammar = Prism.languages.json

if (markdownGrammar) {
  Prism.languages.mdx = markdownGrammar
}

if (jsonGrammar) {
  Prism.languages.jsonc = jsonGrammar
}

/* Custom "diagram" language for ASCII/Unicode box-drawing diagrams.
   Tokenizes box-drawing chars as neutral structure, text as highlighted labels. */
Prism.languages.diagram = {
  'box-drawing': /[┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷]+/,
  'line-char': /[-_|<>]+/,
  label: /[^\s┌┐└┘├┤┬┴┼─│═║╔╗╚╝╠╣╦╩╬╭╮╯╰┊┈╌┄╶╴╵╷\-_|<>]+/,
}

export const prismLanguageIds = Object.keys(prismComponents.languages).filter((id) => id !== 'meta')

export { Prism }
