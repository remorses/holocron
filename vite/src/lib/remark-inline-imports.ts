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

import type { Root, RootContent } from 'mdast'
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

/**
 * Context for resolving link URLs to slug paths when the imported file
 * lives outside pagesDir. Without this, links that traverse above pagesDir
 * and back (e.g. `../../website/src/openapi`) produce bogus paths.
 */
export type SplicedNodesContext = {
  /** Absolute directory of the imported file */
  importDir: string
  /** Absolute pagesDir path */
  pagesDir: string
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
    // Cycle prevention: only mark bindings as processed AFTER their JSX
    // usage was actually replaced. This ensures that if a page declares
    // `import Inner from './inner.md'` but has no `<Inner />` usage yet
    // (it appears later via spliced outer.mdx), the binding stays eligible
    // for replacement in subsequent rounds.
    const processedBindings = new Set<string>()
    const MAX_DEPTH = 10

    for (let round = 0; round < MAX_DEPTH; round++) {
      const allImports = extractImports(tree)
      const inlineable = new Map<string, { entry: InlineImportEntry; bindingKey: string }>()

      for (const imp of allImports) {
        const entry = resolvedImports.get(imp.source)
        if (!entry) continue
        for (const spec of imp.specifiers) {
          if (spec.type === 'default') {
            const bindingKey = `${imp.source}:${spec.local}`
            if (!processedBindings.has(bindingKey)) {
              inlineable.set(spec.local, { entry, bindingKey })
            }
          }
        }
      }

      if (inlineable.size === 0) break

      const parsedImports = new Map<string, RootContent[]>()
      for (const [localName, { entry }] of inlineable) {
        const nodes = entry.parsedNodes ?? parseAndRewriteImportedContent(entry)
        parsedImports.set(localName, nodes)
      }

      // Replace <X /> usages with inlined nodes. Returns which local names
      // had actual JSX replacements. Only mark those as processed so
      // unreplaced bindings stay eligible for future rounds.
      const replacedLocals = replaceJsxUsages(tree, parsedImports)
      if (replacedLocals.size === 0) break

      for (const localName of replacedLocals) {
        const info = inlineable.get(localName)
        if (info) processedBindings.add(info.bindingKey)
      }
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
export function buildSplicedNodes(
  mdast: Root,
  relativeDir: string,
  context?: SplicedNodesContext,
): RootContent[] {
  // Strip frontmatter — it belongs to the imported file, not the parent
  mdast.children = mdast.children.filter((node) => node.type !== 'yaml')

  // Rewrite relative URLs in images, links, JSX src/href, and import sources
  if (relativeDir !== '' && relativeDir !== './') {
    rewriteRelativeUrls(mdast, relativeDir, context)
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
function rewriteRelativeUrls(tree: Root, relativeDir: string, context?: SplicedNodesContext) {
  visit(tree, (node) => {
    // Markdown image: ![alt](./img.png)
    if (node.type === 'image') {
      node.url = resolveRelativeUrl(node.url, relativeDir)
      return
    }

    // Markdown link: [text](./other.md)
    // When the imported file is outside pagesDir, try converting to an
    // absolute slug path so the link checker and browser both resolve correctly.
    if (node.type === 'link') {
      if (context) {
        const slugPath = resolveToSlugPath(node.url, context.importDir, context.pagesDir)
        if (slugPath !== undefined) {
          node.url = slugPath
          return
        }
      }
      node.url = resolveRelativeUrl(node.url, relativeDir)
      return
    }

    // JSX elements: <Image src="./img.png" />, <a href="./page" />
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      const jsxNode = node as JsxNode
      for (const attr of jsxNode.attributes ?? []) {
        if (attr.type !== 'mdxJsxAttribute') continue
        if (attr.name !== 'src' && attr.name !== 'href') continue
        if (typeof attr.value === 'string') {
          if (attr.name === 'href' && context) {
            const slugPath = resolveToSlugPath(attr.value, context.importDir, context.pagesDir)
            if (slugPath !== undefined) {
              attr.value = slugPath
              continue
            }
          }
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
 * Resolve a relative URL to an absolute slug path if the target file lives
 * inside pagesDir. Returns undefined when the URL is not relative, or when the
 * resolved target is outside pagesDir (caller should fall back to the standard
 * `resolveRelativeUrl` in that case).
 *
 * This fixes the "imported README links back into pagesDir" bug: when a file
 * outside pagesDir (e.g. repo-root README.md) has a relative link like
 * `./website/src/openapi.md`, the standard `resolveRelativeUrl` joins it with
 * the relativeDir (`../../`) producing `../../website/src/openapi.md`. That
 * path is technically correct on the filesystem but wrong from the slug/URL
 * perspective. This function instead resolves to `/openapi` directly.
 */
function resolveToSlugPath(
  url: string,
  importDir: string,
  pagesDir: string,
): string | undefined {
  if (!url) return undefined
  if (!url.startsWith('./') && !url.startsWith('../')) return undefined

  // Split off hash/query before resolving filesystem path
  const fragIdx = url.search(/[#?]/)
  const pathPart = fragIdx === -1 ? url : url.slice(0, fragIdx)
  const fragment = fragIdx === -1 ? '' : url.slice(fragIdx)

  // Resolve to absolute filesystem path from the imported file's directory
  const absTarget = path.resolve(importDir, pathPart)
  const rel = path.relative(pagesDir, absTarget).replace(/\\/g, '/')

  // Only handle targets that land inside pagesDir
  if (rel.startsWith('..') || path.isAbsolute(rel)) return undefined

  // Strip .md/.mdx extension to get the slug
  let slug = rel.replace(/\.mdx?$/, '')
  // Normalize index pages
  if (slug.endsWith('/index')) slug = slug.slice(0, -6)
  if (slug === 'index') slug = ''

  return '/' + slug + fragment
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

    let valueChanged = false
    for (const stmt of estree.body ?? []) {
      if (stmt.type !== 'ImportDeclaration') continue
      const source = stmt.source
      if (!source || typeof source.value !== 'string') continue
      if (!source.value.startsWith('./') && !source.value.startsWith('../')) continue

      const rewritten = resolveRelativeUrl(source.value, relativeDir)
      if (rewritten === source.value) continue

      // Update the estree AST node
      const oldValue = source.value
      source.value = rewritten
      if (source.raw) {
        source.raw = JSON.stringify(rewritten)
      }

      // Update the raw text via string replacement. Avoids range-based
      // editing which can produce corrupted output when estree ranges
      // don't match the esmNode.value coordinate system.
      if (typeof esmNode.value === 'string') {
        // Match the old source as a quoted string literal (single or double quotes)
        const escaped = oldValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        esmNode.value = esmNode.value.replace(
          new RegExp(`(['"])${escaped}\\1`),
          (match: string) => {
            const quote = match[0]
            return `${quote}${rewritten}${quote}`
          },
        )
        valueChanged = true
      }
    }
  }
}

/**
 * Walk the AST and replace JSX usages of inlined imports with their parsed nodes.
 * Handles both flow and text elements: `<Guide />` and inline `<Guide />`.
 * Returns the set of local names that had at least one JSX usage replaced.
 */
function replaceJsxUsages(
  tree: Root,
  parsedImports: Map<string, RootContent[]>,
): Set<string> {
  const replacedLocals = new Set<string>()

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
          replacedLocals.add(name)
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
  return replacedLocals
}
