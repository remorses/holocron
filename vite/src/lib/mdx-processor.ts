/**
 * MDX processor — extracts frontmatter, headings, and image srcs.
 * Also provides AST-based image rewriting: mutates mdast image nodes
 * in place (converting markdown images to JSX, injecting dimensions),
 * then serializes back to MDX string.
 */

import { gfmToMarkdown } from 'mdast-util-gfm'
import { toMarkdown } from 'mdast-util-to-markdown'
import { mdxToMarkdown } from 'mdast-util-mdx'
import { frontmatterToMarkdown } from 'mdast-util-frontmatter'
import GithubSlugger from 'github-slugger'
import type { Root, PhrasingContent, RootContent } from 'mdast'
import type { NavHeading } from '../navigation.ts'
import type { ImageMeta } from './image-processor.ts'
import { normalizeMdx, type NormalizeMdxOptions } from './normalize-mdx.ts'
import { HolocronMdxParseError } from './logger.ts'
import { parsePageFrontmatter, type PageFrontmatter } from './page-frontmatter.ts'
import { stringIconToRefs, type IconLibrary, type IconRef } from './collect-icons.ts'
import { extractImports } from 'safe-mdx/parse'
import { stripMdExtFromPath, isExternalUrl } from './link-utils.ts'

/** A binding from an MDX import declaration — maps a local JSX name to its
 *  source specifier. For `import Foo from './bar'`, local='Foo' source='./bar'.
 *  For `import { X } from './bar'`, local='X' source='./bar'. */
export type ImportBinding = {
  local: string
  source: string
}

/** An internal link found in MDX content. Used for broken-link validation
 *  after the full navigation tree is built. */
export type InternalLink = {
  /** The raw href as written in MDX (e.g. '/getting-started', './other#section') */
  href: string
  /** 1-based line number in the MDX source, if available */
  line?: number
}

export type ProcessedMdx = {
  normalizedContent: string
  title: string
  description?: string
  /** Icon from frontmatter — Mintlify convention: `icon: rocket` in YAML.
   *  A string value is either a lucide icon name, an emoji, or a URL. */
  icon?: string
  frontmatter: PageFrontmatter
  /** Canonical icon refs found in frontmatter + JSX icon props. */
  iconRefs: IconRef[]
  headings: NavHeading[]
  /** All image srcs that need build-time processing */
  imageSrcs: string[]
  /** Internal links (relative/absolute paths within the site) for broken-link
   *  validation. External URLs, anchors-only, and protocol links are excluded. */
  internalLinks: InternalLink[]
  /** Raw import source strings from MDX import declarations (e.g. '/snippets/greeting',
   *  '../components/badge'). Bare specifiers (npm packages) are excluded. Used by
   *  sync.ts to resolve actual file paths at build time. */
  importSources: string[]
  /** Local-name → source bindings for all local imports. Used to map JSX
   *  element names back to their import source for merging imported MDX
   *  headings into the page's TOC. */
  importBindings: ImportBinding[]
  /** The parsed mdast tree (reused for image rewriting without re-parsing) */
  mdast: Root
}

type JsxNode = Extract<RootContent, { type: 'mdxJsxFlowElement' | 'mdxJsxTextElement' }>
type FlowJsxNode = Extract<RootContent, { type: 'mdxJsxFlowElement' }>

/**
 * Parse MDX content and extract metadata + icon/image refs.
 * Returns HolocronMdxParseError on syntax errors instead of throwing.
 *
 * normalizeMdx already parses the content into an mdast tree (to run
 * remark plugins), so we reuse that tree directly instead of
 * serializing → re-parsing — saving one full mdxParse per page.
 *
 * @param source - optional slug or file path for error messages (e.g. "/getting-started")
 */
export type ProcessMdxOptions = {
  /** Options for the normalizeMdx pipeline (e.g. prepend plugins). */
  normalizeMdxOptions?: NormalizeMdxOptions
}

export function processMdx(
  content: string,
  defaultLibrary: IconLibrary = 'fontawesome',
  source?: string,
  options?: ProcessMdxOptions,
): HolocronMdxParseError | ProcessedMdx {
  const normalized = normalizeMdx(content, source, options?.normalizeMdxOptions)
  if (normalized instanceof Error) return normalized
  const normalizedContent = normalized.content
  const frontmatter = parsePageFrontmatter(content)
  const mdast = normalized.mdast
  const iconRefs = collectIconRefsFromMdast({ mdast, frontmatter, defaultLibrary })

  // GithubSlugger handles dedup: "Usage", "Usage" → "usage", "usage-1"
  const slugger = new GithubSlugger()
  const headings: NavHeading[] = []
  for (const node of mdast.children) {
    const heading = extractHeading(node, slugger)
    if (heading) headings.push(heading)
  }

  const imageSrcs = collectImageSrcs(mdast)
  const internalLinks = collectInternalLinks(mdast)

  // Extract local import sources (relative/absolute paths) from MDX import
  // declarations. Bare specifiers (npm packages) are excluded — they start
  // with neither '/' nor './' nor '../'.
  const rawImports = extractImports(mdast)
  const isLocalSource = (src: string) => src.startsWith('/') || src.startsWith('./') || src.startsWith('../')
  const importSources = rawImports
    .map((imp) => imp.source)
    .filter(isLocalSource)

  // Build binding map: local JSX name → import source (only for local imports)
  const importBindings: ImportBinding[] = []
  for (const imp of rawImports) {
    if (!isLocalSource(imp.source)) continue
    for (const spec of imp.specifiers) {
      importBindings.push({ local: spec.local, source: imp.source })
    }
  }

  return {
    normalizedContent,
    title: frontmatter.title || headings[0]?.text || 'Untitled',
    description: frontmatter.description,
    icon: typeof frontmatter.icon === 'string' && frontmatter.icon !== '' ? frontmatter.icon : undefined,
    frontmatter,
    iconRefs,
    headings,
    imageSrcs,
    internalLinks,
    importSources,
    importBindings,
    mdast,
  }
}

function collectIconRefsFromMdast({
  mdast,
  frontmatter,
  defaultLibrary,
}: {
  mdast: Root
  frontmatter: PageFrontmatter
  defaultLibrary: IconLibrary
}): IconRef[] {
  const refs: IconRef[] = []

  if (typeof frontmatter.icon === 'string' && frontmatter.icon !== '') {
    refs.push(...stringIconToRefs(frontmatter.icon, { defaultLibrary }))
  }

  function walk(nodes: RootContent[]) {
    for (const node of nodes) {
      if (isJsxElement(node)) {
        const icon = getJsxAttrValue(node, 'icon')
        const iconType = getJsxAttrValue(node, 'iconType')
        if (icon) {
          refs.push(...stringIconToRefs(icon, { defaultLibrary, iconType }))
        }
      }
      const children = Reflect.get(node, 'children')
      if (Array.isArray(children)) {
        walk(children)
      }
    }
  }

  walk(mdast.children)
  return Array.from(new Set(refs))
}

function extractHeading(node: RootContent, slugger: GithubSlugger): NavHeading | undefined {
  if (node.type === 'heading') {
    const text = extractText(node.children)
    if (!text) return undefined
    return {
      depth: node.depth,
      text,
      slug: slugger.slug(text),
    }
  }

  if (!isJsxElement(node)) {
    return undefined
  }

  if (node.name === 'Heading') {
    if (hasJsxBooleanAttr(node, 'noAnchor')) {
      return undefined
    }

    const text = extractText(node.children ?? [])
    if (!text) return undefined
    const explicitId = getJsxAttrValue(node, 'id')
    return {
      depth: getHeadingLevel(node),
      text,
      slug: explicitId || slugger.slug(text),
    }
  }

  if (!/^h[1-6]$/.test(node.name ?? '') || hasJsxBooleanAttr(node, 'noAnchor')) {
    return undefined
  }

  const text = extractText(node.children ?? [])
  if (!text) return undefined
  const explicitId = getJsxAttrValue(node, 'id')
  return {
    depth: getNativeHeadingLevel(node),
    text,
    slug: explicitId || slugger.slug(text),
  }

  function getHeadingLevel(node: JsxNode): 1 | 2 | 3 | 4 | 5 | 6 {
    const rawLevel = Number(getJsxAttrValue(node, 'level'))
    switch (rawLevel) {
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
        return rawLevel
      default:
        return 1
    }
  }
}

function getNativeHeadingLevel(node: JsxNode): 1 | 2 | 3 | 4 | 5 | 6 {
  const rawLevel = Number(node.name?.slice(1) ?? '1')
  switch (rawLevel) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      return rawLevel
    default:
      return 1
  }
}

function hasJsxBooleanAttr(node: JsxNode, attrName: string): boolean {
  return (node.attributes ?? []).some((attribute) => {
    return attribute.type === 'mdxJsxAttribute' && attribute.name === attrName
  })
}

/* ── Image src collection ────────────────────────────────────────────── */

function collectImageSrcs(root: Root): string[] {
  const srcs: string[] = []

  function walk(nodes: RootContent[]) {
    for (const node of nodes) {
      if (node.type === 'image' && node.url && !node.url.startsWith('http://') && !node.url.startsWith('https://')) {
        srcs.push(node.url)
      }
      if (isJsxImageElement(node)) {
        const src = getJsxAttrValue(node, 'src')
        if (src) {
          srcs.push(src)
        }
      }
      const children = Reflect.get(node, 'children')
      if (Array.isArray(children)) {
        walk(children)
      }
    }
  }

  walk(root.children)
  return [...new Set(srcs)]
}

/* ── Internal link collection ────────────────────────────────────────── */

/** Hrefs that are clearly not internal page links. */
function isExternalOrSpecialHref(href: string): boolean {
  if (href.startsWith('#') || isExternalUrl(href)) return true
  // Skip links to static files (e.g. /openapi.json, /docs/guide.pdf).
  // These are public assets, not pages. Strip query/hash before checking.
  // .md/.mdx links are page links, not static files — they get their
  // extension stripped during collection and resolve to page slugs.
  const clean = href.replace(/[?#].*$/, '')
  const lastSegment = clean.split('/').pop() ?? ''
  if (/\.[a-z0-9]+$/i.test(lastSegment) && !/\.mdx?$/i.test(lastSegment)) return true
  return false
}

/** JSX element names that commonly carry an `href` attribute pointing to pages. */
const JSX_HREF_ELEMENTS = new Set([
  'a', 'Card', 'card', 'Tile', 'tile', 'Tooltip', 'tooltip', 'Badge', 'badge',
])

/**
 * Walk the mdast tree and collect internal links (relative or absolute paths
 * within the site). External URLs, anchor-only links, and special protocols
 * are excluded.
 *
 * Collects from:
 * - Markdown links: `[text](/path)` or `[text](./relative)`
 * - JSX elements with `href` attribute: `<a href="...">`, `<Card href="...">`
 */
function collectInternalLinks(root: Root): InternalLink[] {
  const links: InternalLink[] = []
  const seen = new Set<string>()

  function add(href: string, line?: number) {
    if (!href || isExternalOrSpecialHref(href)) return
    // Strip .md/.mdx extension from the path portion only, preserving
    // hash/query that may themselves contain ".md" strings.
    href = stripMdExtFromPath(href)
    // Deduplicate by href (keep first occurrence for line number)
    if (seen.has(href)) return
    seen.add(href)
    links.push({ href, line })
  }

  function walk(nodes: RootContent[]) {
    for (const node of nodes) {
      if (node.type === 'link' && node.url) {
        add(node.url, node.position?.start?.line)
      }
      // Reference-style links: [text][id] with [id]: /path.md
      if (node.type === 'definition' && node.url) {
        add(node.url, node.position?.start?.line)
      }
      if (isJsxElement(node) && JSX_HREF_ELEMENTS.has(node.name ?? '')) {
        const href = getStaticJsxStringAttr(node, 'href')
        if (href) {
          add(href, node.position?.start?.line)
        }
      }
      const children = Reflect.get(node, 'children')
      if (Array.isArray(children)) {
        walk(children)
      }
    }
  }

  walk(root.children)
  return links
}

/* ── AST-based image rewriting ───────────────────────────────────────── */

export type ResolvedImage = {
  /** New public src path */
  publicSrc: string
  /** Processed image metadata */
  meta: ImageMeta
}

/**
 * Mutate the mdast tree in place:
 * - Markdown images (![alt](src)) → converted to mdxJsxFlowElement Image
 * - Root-level JSX img → converted to responsive Image while preserving non-sizing attrs
 * - Existing JSX Image → src updated, width/height/placeholder attrs added
 *
 * Then serializes the mutated tree back to MDX string.
 */
export function rewriteMdxImages(mdast: Root, images: Map<string, ResolvedImage>): string {
  // Walk and mutate the tree. Process root.children and also nested children.
  mdast.children = mdast.children.flatMap((node) => rewriteNode(node, images))

  // Serialize back to MDX
  return toMarkdown(mdast, {
    extensions: [
      gfmToMarkdown(),
      mdxToMarkdown(),
      frontmatterToMarkdown(['yaml']),
    ],
  })
}

/**
 * Rewrite a single node. Returns an array because a paragraph containing
 * only an image gets replaced by a JSX element (1:1), but a paragraph
 * with mixed content stays as-is (image inside converted to inline JSX).
 */
function rewriteNode(
  node: RootContent,
  images: Map<string, ResolvedImage>,
): RootContent[] {
  // Paragraph containing only a single image → replace with JSX block element
  if (node.type === 'paragraph' && node.children.length === 1) {
    const child = node.children[0]
    if (child && child.type === 'image' && images.has(child.url)) {
      const resolved = images.get(child.url)!
      return [createImageNode({
        src: resolved.publicSrc,
        alt: child.alt || '',
        meta: resolved.meta,
      })]
    }
  }

  // Paragraph with mixed content — rewrite inline image nodes
  if (node.type === 'paragraph') {
    node.children = node.children.map((child) => {
      if (child.type === 'image' && images.has(child.url)) {
        const resolved = images.get(child.url)!
        child.url = resolved.publicSrc
      }
      return child
    })
    return [node]
  }

  // JSX element: Image or img
  if (isJsxImageElement(node)) {
    const src = getJsxAttrValue(node, 'src')
    if (src && images.has(src)) {
      const resolved = images.get(src)!
      if (node.type === 'mdxJsxFlowElement' && node.name === 'img') {
        return [createImageNodeFromJsxImage(node, resolved)]
      }
      setJsxAttr({ node, attrName: 'src', value: resolved.publicSrc })
      if (node.name === 'Image') {
        // Preserve user-specified dimensions. When only one is set, compute
        // the other proportionally from the natural aspect ratio. Non-numeric
        // values like "100%" or expression attrs are preserved but not used
        // for proportional computation (would produce NaN).
        const userW = getJsxAttrValue(node, 'width')
        const userH = getJsxAttrValue(node, 'height')
        const userWNum = parseNumericDimension(userW)
        const userHNum = parseNumericDimension(userH)
        const { width: natW, height: natH } = resolved.meta
        if (!userW) {
          const w = userHNum ? Math.round(userHNum * natW / natH) : natW
          setJsxAttr({ node, attrName: 'width', value: String(w) })
        }
        if (!userH) {
          const h = userWNum ? Math.round(userWNum * natH / natW) : natH
          setJsxAttr({ node, attrName: 'height', value: String(h) })
        }
        setJsxAttr({ node, attrName: 'placeholder', value: resolved.meta.placeholder })
      }
    }
    return [node]
  }

  // Standalone image (not in paragraph — shouldn't happen but handle it)
  if (node.type === 'image' && images.has(node.url)) {
    const resolved = images.get(node.url)!
    return [createImageNode({
      src: resolved.publicSrc,
      alt: node.alt || '',
      meta: resolved.meta,
    })]
  }

  // Recurse into children (cast needed because node types have different children types)
  const children = Reflect.get(node, 'children')
  if (Array.isArray(children)) {
    Reflect.set(node, 'children', children.flatMap((child) => {
      return rewriteNode(child, images)
    }))
  }

  return [node]
}

/** Create an mdxJsxFlowElement node for Image with all attributes */
function createImageNode({ src, alt, meta }: { src: string; alt: string; meta: ImageMeta }): RootContent {
  const node: FlowJsxNode = {
    type: 'mdxJsxFlowElement',
    name: 'Image',
    attributes: [
      { type: 'mdxJsxAttribute', name: 'src', value: src },
      { type: 'mdxJsxAttribute', name: 'alt', value: alt },
      { type: 'mdxJsxAttribute', name: 'width', value: String(meta.width) },
      { type: 'mdxJsxAttribute', name: 'height', value: String(meta.height) },
      { type: 'mdxJsxAttribute', name: 'placeholder', value: meta.placeholder },
    ],
    children: [],
  }
  return node
}

function createImageNodeFromJsxImage(node: JsxNode, resolved: ResolvedImage): RootContent {
  // Preserve user-specified width/height if present (e.g. <img height="24"> for logos).
  // When only one dimension is specified, compute the other proportionally from the
  // natural aspect ratio so the image doesn't distort.
  const userWidth = getJsxAttrValue(node, 'width')
  const userHeight = getJsxAttrValue(node, 'height')
  const userWNum = parseNumericDimension(userWidth)
  const userHNum = parseNumericDimension(userHeight)
  const { width: natW, height: natH } = resolved.meta
  let finalWidth: string
  let finalHeight: string
  if (userWidth && userHeight) {
    finalWidth = userWidth
    finalHeight = userHeight
  } else if (userWNum) {
    finalWidth = userWidth!
    finalHeight = String(Math.round(userWNum * natH / natW))
  } else if (userHNum) {
    finalWidth = String(Math.round(userHNum * natW / natH))
    finalHeight = userHeight!
  } else {
    // Non-numeric user values (like "100%") or no values at all — use natural dims
    finalWidth = String(natW)
    finalHeight = String(natH)
  }

  const attributes = copyJsxAttrsExcept(node, ['src', 'width', 'height', 'placeholder', 'intrinsicWidth', 'intrinsicHeight'])
  attributes.push({ type: 'mdxJsxAttribute', name: 'src', value: resolved.publicSrc })
  if (!attributes.some((attr) => attr.type === 'mdxJsxAttribute' && attr.name === 'alt')) {
    attributes.push({ type: 'mdxJsxAttribute', name: 'alt', value: '' })
  }
  attributes.push(
    { type: 'mdxJsxAttribute', name: 'width', value: finalWidth },
    { type: 'mdxJsxAttribute', name: 'height', value: finalHeight },
    { type: 'mdxJsxAttribute', name: 'placeholder', value: resolved.meta.placeholder },
  )
  const imageNode: FlowJsxNode = {
    type: 'mdxJsxFlowElement',
    name: 'Image',
    attributes,
    children: [],
  }
  return imageNode
}

/* ── JSX node helpers ────────────────────────────────────────────────── */

function isJsxImageElement(node: RootContent): node is JsxNode {
  if (!isJsxElement(node)) {
    return false
  }
  const name = node.name
  return name === 'Image' || name === 'img'
}

function isJsxElement(node: RootContent): node is JsxNode {
  return node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement'
}

function getJsxAttrValue(node: JsxNode, attrName: string): string | undefined {
  const attr = node.attributes?.find((a) => {
    return a.type === 'mdxJsxAttribute' && a.name === attrName
  })
  if (!attr) {
    return undefined
  }
  if (typeof attr.value === 'string') {
    return attr.value
  }
  if (attr.value && typeof attr.value === 'object') {
    const v = Reflect.get(attr.value, 'value')
    if (typeof v === 'string') {
      return v.replace(/^['"]|['"]$/g, '')
    }
  }
  return undefined
}

/** Parse a JSX attr value as a finite number, returning undefined for non-numeric strings like "100%" or expression values. */
function parseNumericDimension(value: string | undefined): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function setJsxAttr({ node, attrName, value }: { node: JsxNode; attrName: string; value: string }): void {
  node.attributes ??= []
  const existing = node.attributes.find((a) => {
    return a.type === 'mdxJsxAttribute' && a.name === attrName
  })
  if (existing) {
    existing.value = value
  } else {
    node.attributes.push({ type: 'mdxJsxAttribute', name: attrName, value })
  }
}

/**
 * Extract a JSX attribute value only if it is a plain static string literal.
 * Returns undefined for expression attributes like `href={url}` or
 * `href={`/path/${id}`}`, avoiding false positives in link validation.
 */
function getStaticJsxStringAttr(node: JsxNode, attrName: string): string | undefined {
  const attr = node.attributes?.find((a) => a.type === 'mdxJsxAttribute' && a.name === attrName)
  if (!attr) return undefined
  // Plain string attribute: <Card href="/path">
  if (typeof attr.value === 'string') return attr.value
  // MDX expression attribute: <Card href={expr}> → skip (not a static string)
  return undefined
}

function copyJsxAttrsExcept(node: JsxNode, attrNames: string[]): NonNullable<JsxNode['attributes']> {
  const attrNameSet = new Set(attrNames)
  return (node.attributes ?? []).filter((attr) => {
    return !(attr.type === 'mdxJsxAttribute' && attr.name && attrNameSet.has(attr.name))
  })
}

/* ── Heading text extraction ────────────────────────────────────────── */

function extractText(children: readonly (PhrasingContent | RootContent)[]): string {
  return children
    .map((child) => {
      if (child.type === 'text' || child.type === 'inlineCode') {
        return child.value
      }
      const nestedChildren = Reflect.get(child, 'children')
      if (Array.isArray(nestedChildren)) {
        return extractText(nestedChildren)
      }
      return ''
    })
    .join('')
}
