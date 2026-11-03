import { parse, stringify, visit, type Root, type RootContent, type Syntax } from 'mdastic'
import { frontmatter } from 'mdastic/frontmatter'
import { gfm } from 'mdastic/gfm'
import { headingId } from 'mdastic/heading-id'
import { mdx, unravel } from 'mdastic/mdx'
import { remarkCodeGroup } from './remark-code-group.ts'
import { remarkDetailsToggle } from './remark-details-toggle.ts'
import { remarkGithubCallouts } from './remark-github-callouts.ts'
import { remarkHeadings } from './remark-headings.ts'
import { remarkMermaidCode } from './remark-mermaid.ts'
import { remarkSidebarComponents } from './remark-sidebar-components.ts'
import { remarkSingleAccordionItems } from './remark-single-accordion.ts'
import { HolocronMdxParseError, extractParseErrorInfo } from './logger.ts'
import { stripMdExtFromPath, isExternalUrl } from './link-utils.ts'

/** Syntax for every Holocron MDX parse and stringify. Same order as safe-mdx.
 *  MDX has no `<!-- -->` comments, but Markdown authors write them: parse them as html nodes. */
export const MDX_SYNTAX: Syntax[] = [mdx({ htmlComments: true }), frontmatter(['yaml']), gfm()]

/** Pages also accept Mintlify `{#custom-id}` heading ids. remarkHeadings consumes them. */
const PAGE_SYNTAX: Syntax[] = [...MDX_SYNTAX, headingId()]

/** A plain mdast transform. Mutates the tree in place. */
export type MdastTransform = (tree: Root) => void

export type NormalizedMdx = {
  /** Serialized MDX string after all transforms */
  content: string
  /** The normalized mdast tree — reuse instead of re-parsing content */
  mdast: Root
}

export type NormalizeMdxOptions = {
  /** Transforms to run before the standard pipeline (e.g. remarkInlineImports). */
  prependTransforms?: MdastTransform[]
  /** Page slug (e.g. "guides/setup/index"). When provided, relative links
   *  (./foo, ../bar) are resolved to absolute /paths at build time. This
   *  eliminates trailing-slash ambiguity for index.mdx pages. */
  slug?: string
}

/**
 * Parse MDX content and run all transforms.
 * Returns HolocronMdxParseError on syntax errors instead of throwing.
 * @param source - optional file path or slug for error messages (e.g. "/getting-started")
 */
export function normalizeMdx(content: string, source?: string, options?: NormalizeMdxOptions): HolocronMdxParseError | NormalizedMdx {
  const mdast = parse(content, { syntax: PAGE_SYNTAX })
  if (mdast instanceof Error) return toParseError({ err: mdast, mdxSource: content, source })

  const slug = options?.slug?.replace(/^\/+/, '').replace(/\/+$/, '') // normalize leading/trailing /
  const slugDir = slug != null
    ? slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/')) : ''
    : undefined

  // Prepend transforms run first. remarkInlineImports goes there: it must
  // expand imported .md/.mdx content before the other transforms (headings,
  // code groups, callouts, etc.) process the combined tree.
  const transforms: MdastTransform[] = [
    ...(options?.prependTransforms ?? []),
    removeHtmlComments,
    remarkRewriteLinks({ slugDir }),
    remarkHeadings,
    remarkCodeGroup,
    remarkDetailsToggle,
    remarkGithubCallouts,
    remarkMermaidCode,
    remarkSingleAccordionItems,
    remarkSidebarComponents,
    unravel,
  ]

  // Transforms throw on invalid input (e.g. two {#id} in one heading).
  // Convert at the boundary to a returned error value.
  try {
    for (const transform of transforms) transform(mdast)
  } catch (err) {
    return toParseError({ err, mdxSource: content, source })
  }

  const serialized = stringify(mdast, { syntax: MDX_SYNTAX })
  return { content: serialized, mdast }
}

function toParseError({ err, mdxSource, source }: { err: unknown; mdxSource: string; source?: string }): HolocronMdxParseError {
  if (err instanceof HolocronMdxParseError) return err
  const { line, column, reason } = extractParseErrorInfo(err)
  return new HolocronMdxParseError({ reason, line, column, source, mdxSource, cause: err })
}

/**
 * Rewrite internal links in the mdast tree:
 *
 * 1. Strip .md/.mdx extensions so links resolve to page slugs.
 * 2. When `slugDir` is provided, resolve relative paths (./foo, ../bar)
 *    to absolute /paths. This eliminates trailing-slash ambiguity for
 *    index.mdx pages where the browser might resolve ./foo differently
 *    depending on whether the URL has a trailing slash.
 *
 * Handles markdown links [text](url), reference-style definitions
 * [id]: /path.md, and JSX href attributes. External URLs, anchor-only
 * links, and import sources are left alone.
 */
function remarkRewriteLinks({ slugDir }: { slugDir?: string }): MdastTransform {
  return (tree) => {
    walkRewriteLinks(tree.children, slugDir)
  }
}

/** Check if a URL is a relative page href that should be resolved to absolute.
 *  Matches ./foo, ../bar, and bare relative paths like `foo` or `bar/baz`.
 *  Excludes absolute paths, anchors, external URLs, and protocol schemes. */
function isRelativePageHref(url: string): boolean {
  if (url.startsWith('./') || url.startsWith('../')) return true
  if (url.startsWith('/') || url.startsWith('#') || isExternalUrl(url)) return false
  // Exclude unknown protocol schemes (e.g. custom:foo)
  return !/^[a-z][a-z0-9+.-]*:/i.test(url)
}

function rewriteLinkUrl(url: string, slugDir: string | undefined): string {
  if (!url || isExternalUrl(url) || url.startsWith('#')) return url
  // Strip .md/.mdx extension first
  url = stripMdExtFromPath(url)
  // Resolve relative paths to absolute when slug context is available
  if (slugDir != null && isRelativePageHref(url)) {
    url = resolveRelativeToAbsolute(url, slugDir)
  }
  return url
}

/**
 * Resolve a relative URL (./foo or ../bar) to an absolute /path using
 * the page's slug directory as the base. Preserves hash fragments and
 * query strings.
 */
function resolveRelativeToAbsolute(url: string, slugDir: string): string {
  // Split off hash/query before resolving
  const fragIdx = url.search(/[?#]/)
  const pathPart = fragIdx === -1 ? url : url.slice(0, fragIdx)
  const suffix = fragIdx === -1 ? '' : url.slice(fragIdx)

  const base = slugDir ? `/${slugDir}` : ''
  const segments = (base + '/' + pathPart).split('/').filter(Boolean)
  const stack: string[] = []
  for (const seg of segments) {
    if (seg === '.') continue
    if (seg === '..') {
      stack.pop()
      continue
    }
    stack.push(seg)
  }
  const resolved = '/' + stack.join('/')
  return resolved + suffix
}

function walkRewriteLinks(nodes: RootContent[], slugDir: string | undefined) {
  for (const node of nodes) {
    if (node.type === 'link') {
      node.url = rewriteLinkUrl(node.url, slugDir)
    }
    // Reference-style link definitions: [id]: /path.md
    if (node.type === 'definition') {
      node.url = rewriteLinkUrl(node.url, slugDir)
    }
    // JSX elements with href attribute
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      const jsxNode = node as { attributes?: Array<{ type: string; name: string; value: unknown }> }
      for (const attr of jsxNode.attributes ?? []) {
        if (attr.type === 'mdxJsxAttribute' && attr.name === 'href' && typeof attr.value === 'string') {
          attr.value = rewriteLinkUrl(attr.value, slugDir)
        }
      }
    }
    const children = Reflect.get(node, 'children')
    if (Array.isArray(children)) {
      walkRewriteLinks(children, slugDir)
    }
  }
}

/** Comments parse as html nodes. safe-mdx renders nothing for them, so keep them out of served MDX. */
function removeHtmlComments(tree: Root): void {
  visit(tree, 'html', (_, index, parent) => {
    if (!parent || index === undefined) return
    parent.children.splice(index, 1)
    return index
  })
}

/** mdast nodes whose children are blocks, not inline text. */
const FLOW_PARENTS = new Set(['root', 'blockquote', 'listItem', 'footnoteDefinition'])

/**
 * Parse plain Markdown (CommonMark + GFM, no MDX). OpenAPI and MCP
 * descriptions are Markdown by spec, so `{lease}` or `<token>` in prose must
 * stay literal text instead of becoming MDX expressions or JSX. Raw HTML is
 * kept as text for the same reason: descriptions are rendered without HTML.
 */
export function parseCommonMark(markdown: string): Root {
  const mdast = parse(markdown, { syntax: [gfm()] })
  // Only MDX syntax can fail to parse.
  if (mdast instanceof Error) throw mdast
  const htmlToText = (node: Root | RootContent): void => {
    if (!('children' in node)) return
    // Block HTML needs a paragraph, or it is serialized unescaped and glued to its neighbors.
    const isFlow = FLOW_PARENTS.has(node.type)
    node.children = node.children.map((child) => {
      if (child.type !== 'html') return child
      const text = { type: 'text', value: child.value } as const
      return isFlow ? { type: 'paragraph', children: [text] } : text
    }) as typeof node.children
    node.children.forEach(htmlToText)
  }
  htmlToText(mdast)
  return mdast
}

/** Plain Markdown → MDX source with `{`, `<` and friends escaped, for virtual pages. */
export function commonMarkToMdx(markdown: string): string {
  return stringify(parseCommonMark(markdown), { syntax: [mdx(), gfm()] })
}
