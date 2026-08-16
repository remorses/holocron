---
'@holocron.so/vite': patch
---

Ship a docs-focused language set for server code highlighting instead of every Prism extra.

Common product-docs languages still highlight: `ts`, `js`, `python`, `go`, `rust`, `bash`, `json`, `yaml`, `php`, `docker`, `scss`, `dart`, `elixir`, `scala`, `lua`, `nix`, `solidity`, `mermaid`, and the rest of the keep list.

These languages now render as **plain text**:

- editors and templates: `vim`, `textile`, `pug`, `haml`, `stylus`, `twig`, `ejs`, `erb`, `rest`
- functional and academic: `lisp`, `scheme`, `racket`, `haskell`, `ocaml`, `elm`, `purescript`, `reason`, `prolog`, `clojure`, `julia`, `matlab`
- systems and hardware: `llvm`, `nasm`, `armasm`, `wgsl`, `verilog`, `vhdl`, `wren`, `nim`, `odin`, `v`, `pascal`
- other long-tail: `applescript`, `arduino`, `awk`, `basic`, `bnf`, `coffeescript`, `dot`, `ebnf`, `erlang`, `fsharp`, `javadoc`, `jsonp`, `perl`, `promql`, `puppet`, `rego`, `rescript`, `tcl`, `uri`, `vbnet`

Unknown languages already rendered as plain text. That behavior is unchanged.
