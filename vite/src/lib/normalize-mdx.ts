import { frontmatterToMarkdown } from 'mdast-util-frontmatter'
import { gfmToMarkdown } from 'mdast-util-gfm'
import { mdxToMarkdown } from 'mdast-util-mdx'
import { toMarkdown } from 'mdast-util-to-markdown'
import type { Root, RootContent } from 'mdast'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMdx from 'remark-mdx'
import { remark } from 'remark'
import { remarkMarkAndUnravel } from 'safe-mdx/parse'
import { remarkCodeGroup } from './remark-code-group.ts'
import { remarkDetailsToggle } from './remark-details-toggle.ts'
import { remarkGithubCallouts } from './remark-github-callouts.ts'
import { remarkHeadings } from './remark-headings.ts'
import { remarkMermaidCode } from './remark-mermaid.ts'
import { remarkSidebarComponents } from './remark-sidebar-components.ts'
import { remarkSingleAccordionItems } from './remark-single-accordion.ts'
import { HolocronMdxParseError, extractParseErrorInfo } from './logger.ts'
import { stripMdExtFromPath, isExternalUrl } from './link-utils.ts'

export type NormalizedMdx = {
  /** Serialized MDX string after all remark transforms */
  content: string
  /** The normalized mdast tree — reuse instead of re-parsing content */
  mdast: Root
}

export type NormalizeMdxOptions = {
  /** Remark plugins to run before the standard pipeline (e.g. remarkInlineImports).
   *  Each entry is [plugin, options] or just plugin. */
  prependPlugins?: Array<[any, any] | any>
  /** Page slug (e.g. "guides/setup/index"). When provided, relative links
   *  (./foo, ../bar) are resolved to absolute /paths at build time. This
   *  eliminates trailing-slash ambiguity for index.mdx pages. */
  slug?: string
}

/**
 * Parse MDX content and run all remark transform plugins.
 * Returns HolocronMdxParseError on syntax errors instead of throwing.
 * @param source - optional file path or slug for error messages (e.g. "/getting-started")
 */
export function normalizeMdx(content: string, source?: string, options?: NormalizeMdxOptions): HolocronMdxParseError | NormalizedMdx {
  // MDX does not support HTML comments (<!-- -->), but many markdown authors
  // use them. Strip them before parsing so they don't cause syntax errors.
  // remark-comment (the proper micromark extension approach) can't be used
  // because it depends on micromark-factory-space@1 while our pipeline uses
  // @2, causing "expected last token to be open" errors in vitest.
  content = stripHtmlComments(content)

  const processor = remark()
    .use(remarkMdx)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)

  // Prepend plugins run before the standard pipeline. This is where
  // remarkInlineImports goes: it must expand imported .md/.mdx content
  // before other remark plugins (headings, code groups, callouts, etc.)
  // process the combined tree.
  if (options?.prependPlugins) {
    for (const entry of options.prependPlugins) {
      if (Array.isArray(entry)) {
        processor.use(entry[0], entry[1])
      } else {
        processor.use(entry)
      }
    }
  }

  const slug = options?.slug?.replace(/^\/+/, '').replace(/\/+$/, '') // normalize leading/trailing /
  const slugDir = slug != null
    ? slug.includes('/') ? slug.slice(0, slug.lastIndexOf('/')) : ''
    : undefined

  processor
    .use(remarkRewriteLinks, { slugDir })
    .use(remarkHeadings as never)
    .use(remarkCodeGroup)
    .use(remarkDetailsToggle)
    .use(remarkGithubCallouts)
    .use(remarkMermaidCode)
    .use(remarkSingleAccordionItems)
    .use(remarkSidebarComponents)

  // Remark's parse() and runSync() throw VFileMessage on syntax errors.
  // Convert at the boundary to a returned error value.
  const parseResult = trySync(() => processor.parse(content), content, source)
  if (parseResult instanceof Error) return parseResult

  const runResult = trySync(() => processor.runSync(parseResult) as Root, content, source)
  if (runResult instanceof Error) return runResult

  const mdast = runResult

  // Serialize BEFORE unravel — mdxToMarkdown corrupts phrasing children
  // of flow elements by inserting blank lines between them, which creates
  // spurious paragraphs on re-parse. Keeping text elements inline in the
  // serialized output preserves the original paragraph structure.
  const serialized = toMarkdown(mdast, {
    extensions: [
      gfmToMarkdown(),
      mdxToMarkdown(),
      frontmatterToMarkdown(['yaml']),
    ],
  })

  // Apply unravel AFTER serialization — promotes lone text elements in
  // paragraphs to flow elements so the mdast tree has the correct block
  // structure for heading extraction, section splitting, etc.
  remarkMarkAndUnravel()(mdast)

  return { content: serialized, mdast }
}

/** Sync boundary: catch thrown errors from remark and convert to HolocronMdxParseError. */
function trySync<T>(fn: () => T, mdxSource: string, source?: string): HolocronMdxParseError | T {
  try {
    return fn()
  } catch (err) {
    if (err instanceof HolocronMdxParseError) return err
    const { line, column, reason } = extractParseErrorInfo(err)
    return new HolocronMdxParseError({ reason, line, column, source, mdxSource })
  }
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
function remarkRewriteLinks(_opts?: { slugDir?: string }) {
  const slugDir = _opts?.slugDir
  return (tree: Root) => {
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

/**
 * Strip HTML comments (<!-- ... -->) from MDX content, replacing comment
 * characters with spaces to preserve source positions for error reporting.
 *
 * Preserves comments inside:
 * - Fenced code blocks (``` or ~~~), with proper fence matching (char + length)
 * - Inline code spans (`...`)
 * - JSX string attributes (quotes inside JSX tags)
 *
 * Replaces non-newline comment characters with spaces so line numbers in
 * parse errors still point to the correct location in the original source.
 */
function stripHtmlComments(content: string): string {
  if (!content.includes('<!--')) return content

  const chars = [...content]
  const len = chars.length
  let i = 0

  // Code fence state: when set, we're inside a fenced code block
  let fence: { char: string; length: number } | null = null

  while (i < len) {
    // --- Fenced code block handling ---
    if (fence) {
      // Check for closing fence: must be at line start (after optional spaces),
      // same char, at least same length, nothing else on the line
      if (isLineStart(chars, i)) {
        const fenceMatch = matchFence(chars, i, len)
        if (fenceMatch && fenceMatch.char === fence.char && fenceMatch.length >= fence.length) {
          // Check rest of line is blank
          let afterFence = i + fenceMatch.length
          while (afterFence < len && chars[afterFence] === ' ') afterFence++
          if (afterFence >= len || chars[afterFence] === '\n') {
            fence = null
            i = afterFence
            continue
          }
        }
      }
      i = skipToNextLine(chars, i, len)
      continue
    }

    // --- Check for opening code fence at line start ---
    if (isLineStart(chars, i)) {
      const fenceMatch = matchFence(chars, i, len)
      if (fenceMatch) {
        fence = fenceMatch
        i = skipToNextLine(chars, i, len)
        continue
      }
    }

    // --- Inline code span: skip past closing backtick(s) ---
    if (chars[i] === '`') {
      // Count opening backticks
      let ticks = 0
      const tickStart = i
      while (i < len && chars[i] === '`') { ticks++; i++ }
      // Find matching closing backticks (same count)
      let found = false
      for (let j = i; j <= len - ticks; j++) {
        let match = true
        for (let k = 0; k < ticks; k++) {
          if (chars[j + k] !== '`') { match = false; break }
        }
        if (match) {
          // Make sure it's exactly `ticks` backticks (not more)
          if (j + ticks < len && chars[j + ticks] === '`') continue
          i = j + ticks
          found = true
          break
        }
      }
      if (!found) i = tickStart + 1 // unclosed, treat first backtick as literal
      continue
    }

    // --- JSX tag: skip string attributes to avoid stripping comments in props ---
    if (chars[i] === '<' && i + 1 < len && /[A-Z]/.test(chars[i + 1]!)) {
      i++ // skip <
      // Scan until > or />, skipping quoted strings
      while (i < len && chars[i] !== '>') {
        if (chars[i] === '"' || chars[i] === "'") {
          const quote = chars[i]
          i++ // skip opening quote
          while (i < len && chars[i] !== quote) i++
          if (i < len) i++ // skip closing quote
        } else {
          i++
        }
      }
      if (i < len) i++ // skip >
      continue
    }

    // --- HTML comment: blank it out ---
    if (chars[i] === '<' && chars[i + 1] === '!' && chars[i + 2] === '-' && chars[i + 3] === '-') {
      const commentStart = i
      i += 4 // skip <!--
      // Find -->
      while (i < len) {
        if (chars[i] === '-' && chars[i + 1] === '-' && chars[i + 2] === '>') {
          i += 3 // skip -->
          break
        }
        i++
      }
      // Blank out the comment, preserving newlines
      for (let j = commentStart; j < i; j++) {
        if (chars[j] !== '\n') chars[j] = ' '
      }
      continue
    }

    i++
  }

  return chars.join('')
}

/** Check if position i is at the start of a line (or start of string). */
function isLineStart(chars: string[], i: number): boolean {
  return i === 0 || chars[i - 1] === '\n'
}

/** Try to match a code fence at position i. Returns fence info or null. */
function matchFence(chars: string[], i: number, len: number): { char: string; length: number } | null {
  // Skip leading spaces (up to 3)
  let pos = i
  let spaces = 0
  while (pos < len && chars[pos] === ' ' && spaces < 3) { pos++; spaces++ }
  const char = chars[pos]
  if (char !== '`' && char !== '~') return null
  let count = 0
  while (pos < len && chars[pos] === char) { count++; pos++ }
  if (count < 3) return null
  return { char, length: count }
}

/** Advance past the current line (skip to char after next \n, or end). */
function skipToNextLine(chars: string[], i: number, len: number): number {
  while (i < len && chars[i] !== '\n') i++
  return i < len ? i + 1 : i
}
