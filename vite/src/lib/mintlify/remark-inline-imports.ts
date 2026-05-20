/**
 * Remark plugin that inlines .md/.mdx file imports into the parent AST.
 *
 * When a page has `import Guide from './snippets/guide.md'` and uses `<Guide />`,
 * this plugin reads the imported file content, parses it into mdast nodes,
 * rewrites relative URLs (images, links) to be correct relative to the parent
 * file, and splices the nodes in place of the `<Guide />` usage.
 *
 * The import declaration is intentionally KEPT in the AST as dead code. This
 * means the .md/.mdx file stays in the virtual modules map and gets HMR
 * watching for free through Vite's normal module graph. It also preserves
 * line numbers (no lines are removed from the original source). The import
 * The virtual module for the .md/.mdx file exports a no-op component
 * that is never rendered since all `<X />` usages have been replaced.
 *
 * Inlined content goes through the same remark pipeline as the parent page:
 * code groups, callouts, headings, mermaid, etc. all apply. Images are also
 * picked up by the build-time image processor (dimensions, placeholders,
 * copy-to-public).
 *
 * Headings from inlined content naturally appear in the page's TOC because
 * they become part of the page's mdast tree. No separate heading merge step
 * is needed.
 *
 * Resolution happens BEFORE this plugin runs (in sync.ts) so the plugin
 * receives a pre-resolved map. This keeps the plugin synchronous and allows
 * using Vite's resolver or any async resolution strategy externally.
 */

import type { Root, RootContent, Image, Link } from 'mdast'
import { visit } from 'unist-util-visit'
import { extractImports } from 'safe-mdx/parse'
import remarkMdx from 'remark-mdx'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import { remark } from 'remark'
import path from 'node:path'

export type InlineImportEntry = {
  /** Raw markdown/MDX content of the imported file */
  content: string
  /** Absolute path of the imported file (for error messages) */
  absPath: string
  /**
   * Directory of the imported file, relative to the parent file's directory.
   * Used to rewrite relative URLs in the inlined content.
   * e.g. if parent is `pages/index.mdx` and import is `snippets/guide.md`,
   * this would be `../snippets/` (from pages/ to snippets/).
   */
  relativeDir: string
  /** Pre-built mdast nodes ready for splicing. When set, the remark plugin
   *  skips parsing and just clones these nodes. Built by resolveInlineImports
   *  in sync.ts to avoid double-parsing imported files. */
  parsedNodes?: RootContent[]
}

export type RemarkInlineImportsOptions = {
  /** Map from raw import source string to resolved import info.
   *  Only .md/.mdx imports should be included; .tsx/.ts are left alone. */
  resolvedImports: Map<string, InlineImportEntry>
}

type JsxNode = Extract<RootContent, { type: 'mdxJsxFlowElement' | 'mdxJsxTextElement' }>

/**
 * Create a remark plugin that inlines .md/.mdx imports into the parent AST.
 */
export function remarkInlineImports(options: RemarkInlineImportsOptions) {
  return (tree: Root) => {
    const { resolvedImports } = options
    if (resolvedImports.size === 0) return

    // Run to a fixed point: after inlining outer.mdx, it may contain
    // <Inner /> from a nested .md import. The resolvedImports map already
    // has all nested entries (computed recursively by resolveInlineImports
    // in sync.ts), so we just need to re-scan for new bindings and replace.
    //
    // Cycle prevention: track which (source, local) pairs have been processed.
    // The same file CAN be inlined in multiple rounds if it appears under
    // different local names (e.g. page imports Inner directly, AND outer.mdx
    // also imports Inner — both usages should be replaced).
    const processedBindings = new Set<string>()
    const MAX_DEPTH = 10

    for (let round = 0; round < MAX_DEPTH; round++) {
      const allImports = extractImports(tree)
      const inlineable = new Map<string, InlineImportEntry>()

      for (const imp of allImports) {
        const entry = resolvedImports.get(imp.source)
        if (!entry) continue
        for (const spec of imp.specifiers) {
          if (spec.type === 'default') {
            const bindingKey = `${imp.source}:${spec.local}`
            if (!processedBindings.has(bindingKey)) {
              processedBindings.add(bindingKey)
              inlineable.set(spec.local, entry)
            }
          }
        }
      }

      if (inlineable.size === 0) break

      const parsedImports = new Map<string, RootContent[]>()
      for (const [localName, entry] of inlineable) {
        // Use pre-built nodes from resolveInlineImports (sync.ts) when
        // available to avoid double-parsing. Falls back to parsing from
        // content string for unit tests and standalone usage.
        const nodes = entry.parsedNodes ?? parseAndRewriteImportedContent(entry)
        parsedImports.set(localName, nodes)
      }

      // Replace <X /> usages with inlined nodes.
      // Import declarations are intentionally kept as dead code so the
      // virtual module system tracks the .md/.mdx files for HMR watching.
      replaceJsxUsages(tree, parsedImports)
    }
  }
}

/**
 * Parse imported .md/.mdx content and rewrite relative URLs to be
 * correct when inlined into the parent file. Used as fallback when
 * pre-built parsedNodes aren't available (unit tests, standalone usage).
 */
function parseAndRewriteImportedContent(entry: InlineImportEntry): RootContent[] {
  const processor = remark()
    .use(remarkMdx)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)

  const parsed = processor.parse(entry.content)
  const mdast = processor.runSync(parsed) as Root
  return buildSplicedNodes(mdast, entry.relativeDir)
}

/**
 * Prepare mdast nodes for splicing into a parent page: strip frontmatter
 * and rewrite relative URLs/import sources. Works on an already-parsed
 * mdast tree (from quickMdxParser or remark). Called by:
 * - resolveInlineImports (sync.ts) to pre-build nodes during sync
 * - parseAndRewriteImportedContent (above) as fallback in the remark plugin
 */
export function buildSplicedNodes(mdast: Root, relativeDir: string): RootContent[] {
  // Strip frontmatter — it belongs to the imported file, not the parent
  mdast.children = mdast.children.filter((node) => node.type !== 'yaml')

  // Rewrite relative URLs in images, links, JSX src/href, and import sources
  if (relativeDir !== '' && relativeDir !== './') {
    rewriteRelativeUrls(mdast, relativeDir)
    rewriteRelativeImportSources(mdast, relativeDir)
  }

  return mdast.children
}

/**
 * Rewrite relative URLs in image and link nodes so they resolve correctly
 * when the content is inlined into a different directory.
 *
 * Only rewrites relative paths (starting with ./ or ../). Absolute paths
 * (starting with /) and external URLs (http://, https://) are left alone.
 */
function rewriteRelativeUrls(tree: Root, relativeDir: string) {
  visit(tree, (node) => {
    // Markdown image: ![alt](./img.png)
    if (node.type === 'image') {
      ;(node as Image).url = resolveRelativeUrl((node as Image).url, relativeDir)
      return
    }

    // Markdown link: [text](./other.md)
    if (node.type === 'link') {
      ;(node as Link).url = resolveRelativeUrl((node as Link).url, relativeDir)
      return
    }

    // JSX elements: <Image src="./img.png" />, <a href="./page" />
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      const jsxNode = node as JsxNode
      for (const attr of jsxNode.attributes ?? []) {
        if (attr.type !== 'mdxJsxAttribute') continue
        if (attr.name !== 'src' && attr.name !== 'href') continue
        if (typeof attr.value === 'string') {
          attr.value = resolveRelativeUrl(attr.value, relativeDir)
        }
      }
    }
  })
}

/**
 * If `url` is a relative path (./ or ../), join it with `relativeDir`.
 * Otherwise return as-is (absolute paths, external URLs, anchors, etc).
 */
function resolveRelativeUrl(url: string, relativeDir: string): string {
  if (!url) return url
  // Only rewrite relative paths
  if (!url.startsWith('./') && !url.startsWith('../')) return url
  // Use path.posix.join to normalize the result (handles ../ segments)
  const joined = path.posix.join(relativeDir, url)
  // Ensure it starts with ./ for consistency
  if (!joined.startsWith('../') && !joined.startsWith('./')) {
    return './' + joined
  }
  return joined
}

/**
 * Rewrite relative import source strings in mdxjsEsm nodes.
 * When an imported .mdx file has `import Badge from './badge'`, the source
 * must be rewritten relative to the parent file after inlining, otherwise
 * it resolves from the wrong directory.
 *
 * Uses ESTree `source.range` offsets for precise edits into node.value,
 * avoiding false positives when the same string appears elsewhere in the
 * ESM block (e.g. in an export constant).
 */
function rewriteRelativeImportSources(tree: Root, relativeDir: string) {
  for (const node of tree.children) {
    if (node.type !== 'mdxjsEsm') continue
    const esmNode = node as any
    const estree = esmNode.data?.estree
    if (!estree) continue

    // Collect edits with exact character ranges, then apply back-to-front
    // so earlier edits don't shift the offsets of later ones.
    const edits: Array<{ start: number; end: number; text: string }> = []

    for (const stmt of estree.body ?? []) {
      if (stmt.type !== 'ImportDeclaration') continue
      const source = stmt.source
      if (!source || typeof source.value !== 'string') continue
      if (!source.value.startsWith('./') && !source.value.startsWith('../')) continue

      const rewritten = resolveRelativeUrl(source.value, relativeDir)
      if (rewritten === source.value) continue

      // Use range if available (remark-mdx provides [start, end] offsets)
      if (Array.isArray(source.range) && source.range.length === 2) {
        edits.push({
          start: source.range[0],
          end: source.range[1],
          text: JSON.stringify(rewritten),
        })
      }

      source.value = rewritten
      if (source.raw) {
        source.raw = JSON.stringify(rewritten)
      }
    }

    // Apply edits to node.value from end to start so offsets stay valid
    if (edits.length > 0 && typeof esmNode.value === 'string') {
      let value = esmNode.value as string
      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        value = value.slice(0, edit.start) + edit.text + value.slice(edit.end)
      }
      esmNode.value = value
    }
  }
}

/**
 * Walk the AST and replace JSX usages of inlined imports with their parsed nodes.
 * Handles both flow and text elements: `<Guide />` and inline `<Guide />`.
 */
function replaceJsxUsages(
  tree: Root,
  parsedImports: Map<string, RootContent[]>,
) {
  function walkChildren(children: RootContent[]): RootContent[] {
    const result: RootContent[] = []
    for (const child of children) {
      if ((child.type === 'mdxJsxFlowElement' || child.type === 'mdxJsxTextElement') && child.name) {
        const jsxNode = child as JsxNode
        const name = jsxNode.name!
        const nodes = parsedImports.get(name)
        if (nodes) {
          // Splice in the parsed nodes (clone to allow multiple usages)
          result.push(...structuredClone(nodes))
          continue
        }
      }
      // Recurse into children
      const nodeChildren = Reflect.get(child, 'children')
      if (Array.isArray(nodeChildren)) {
        Reflect.set(child, 'children', walkChildren(nodeChildren))
      }
      result.push(child)
    }
    return result
  }

  tree.children = walkChildren(tree.children)
}
