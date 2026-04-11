/**
 * MDX processor — extracts frontmatter, headings, and image srcs.
 * Also provides AST-based image rewriting: mutates mdast image nodes
 * in place (converting markdown images to JSX, injecting dimensions),
 * then serializes back to MDX string.
 */

import { mdxParse } from 'safe-mdx/parse'
import { gfmToMarkdown } from 'mdast-util-gfm'
import { toMarkdown } from 'mdast-util-to-markdown'
import { mdxToMarkdown } from 'mdast-util-mdx'
import { frontmatterToMarkdown } from 'mdast-util-frontmatter'
import GithubSlugger from 'github-slugger'
import type { Root, PhrasingContent, RootContent } from 'mdast'
import type { NavHeading } from '../navigation.ts'
import type { ImageMeta } from './image-processor.ts'
import { normalizeMdx } from './mintlify/normalize-mdx.ts'
import { parsePageFrontmatter, type PageFrontmatter } from './page-frontmatter.ts'
import { stringIconToRefs, type IconLibrary, type IconRef } from './collect-icons.ts'

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
  /** The parsed mdast tree (reused for image rewriting without re-parsing) */
  mdast: Root
}

type JsxNode = Extract<RootContent, { type: 'mdxJsxFlowElement' | 'mdxJsxTextElement' }>
type FlowJsxNode = Extract<RootContent, { type: 'mdxJsxFlowElement' }>

/**
 * Parse MDX content and extract metadata + icon/image refs.
 * Returns the mdast tree for reuse by rewriteMdxImages.
 */
export function processMdx(content: string, defaultLibrary: IconLibrary = 'lucide'): ProcessedMdx {
  const normalizedContent = normalizeMdx(content)
  const frontmatter = parsePageFrontmatter(content)
  const mdast = mdxParse(normalizedContent)
  const iconRefs = collectIconRefsFromMdast({ mdast, frontmatter, defaultLibrary })

  // GithubSlugger handles dedup: "Usage", "Usage" → "usage", "usage-1"
  const slugger = new GithubSlugger()
  const headings: NavHeading[] = []
  for (const node of mdast.children) {
    const heading = extractHeading(node, slugger)
    if (heading) headings.push(heading)
  }

  const imageSrcs = collectImageSrcs(mdast)

  return {
    normalizedContent,
    title: frontmatter.title || headings[0]?.text || 'Untitled',
    description: frontmatter.description,
    icon: typeof frontmatter.icon === 'string' && frontmatter.icon !== '' ? frontmatter.icon : undefined,
    frontmatter,
    iconRefs,
    headings,
    imageSrcs,
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

/* ── AST-based image rewriting ───────────────────────────────────────── */

export type ResolvedImage = {
  /** New public src path */
  publicSrc: string
  /** Processed image metadata */
  meta: ImageMeta
}

/**
 * Mutate the mdast tree in place:
 * - Markdown images (![alt](src)) → converted to mdxJsxFlowElement PixelatedImage
 * - Root-level JSX img → converted to PixelatedImage while preserving authored attrs
 * - Existing JSX PixelatedImage → src updated, width/height/placeholder attrs added
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
      return [createPixelatedImageNode({
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

  // JSX element: PixelatedImage or img
  if (isJsxImageElement(node)) {
    const src = getJsxAttrValue(node, 'src')
    if (src && images.has(src)) {
      const resolved = images.get(src)!
      if (node.type === 'mdxJsxFlowElement' && node.name === 'img') {
        return [createPixelatedImageNodeFromJsxImage(node, resolved)]
      }
      setJsxAttr({ node, attrName: 'src', value: resolved.publicSrc })
      if (node.name === 'PixelatedImage') {
        setJsxAttr({ node, attrName: 'width', value: String(resolved.meta.width) })
        setJsxAttr({ node, attrName: 'height', value: String(resolved.meta.height) })
        setJsxAttr({ node, attrName: 'placeholder', value: resolved.meta.placeholder })
      }
    }
    return [node]
  }

  // Standalone image (not in paragraph — shouldn't happen but handle it)
  if (node.type === 'image' && images.has(node.url)) {
    const resolved = images.get(node.url)!
    return [createPixelatedImageNode({
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

/** Create an mdxJsxFlowElement node for PixelatedImage with all attributes */
function createPixelatedImageNode({ src, alt, meta }: { src: string; alt: string; meta: ImageMeta }): RootContent {
  const node: FlowJsxNode = {
    type: 'mdxJsxFlowElement',
    name: 'PixelatedImage',
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

function createPixelatedImageNodeFromJsxImage(node: JsxNode, resolved: ResolvedImage): RootContent {
  const attributes = copyJsxAttrsExcept(node, ['src', 'placeholder', 'intrinsicWidth', 'intrinsicHeight'])
  attributes.push({ type: 'mdxJsxAttribute', name: 'src', value: resolved.publicSrc })
  if (!attributes.some((attr) => attr.type === 'mdxJsxAttribute' && attr.name === 'alt')) {
    attributes.push({ type: 'mdxJsxAttribute', name: 'alt', value: '' })
  }
  attributes.push(
    { type: 'mdxJsxAttribute', name: 'intrinsicWidth', value: String(resolved.meta.width) },
    { type: 'mdxJsxAttribute', name: 'intrinsicHeight', value: String(resolved.meta.height) },
    { type: 'mdxJsxAttribute', name: 'placeholder', value: resolved.meta.placeholder },
  )
  const imageNode: FlowJsxNode = {
    type: 'mdxJsxFlowElement',
    name: 'PixelatedImage',
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
  return name === 'PixelatedImage' || name === 'img'
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
      if (child.type === 'text') {
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
