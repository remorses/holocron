/**
 * MDX processor — extracts frontmatter, headings, and image srcs.
 * Also provides AST-based image rewriting: mutates mdast image nodes
 * in place (converting markdown images to JSX, injecting dimensions),
 * then serializes back to MDX string.
 */

import { mdxParse } from 'safe-mdx/parse'
import { toMarkdown } from 'mdast-util-to-markdown'
import { mdxToMarkdown } from 'mdast-util-mdx'
import { frontmatterToMarkdown } from 'mdast-util-frontmatter'
import GithubSlugger from 'github-slugger'
import type { Root, Heading, PhrasingContent, RootContent } from 'mdast'
import type { NavHeading } from '../navigation.ts'
import type { ImageMeta } from './image-processor.ts'

export type ProcessedMdx = {
  title: string
  description?: string
  frontmatter: Record<string, unknown>
  headings: NavHeading[]
  /** All non-external image srcs found in the MDX (relative + absolute) */
  imageSrcs: string[]
  /** The parsed mdast tree (reused for image rewriting without re-parsing) */
  mdast: Root
}

/**
 * Parse MDX content and extract metadata + image srcs.
 * Returns the mdast tree for reuse by rewriteMdxImages.
 */
export function processMdx(content: string): ProcessedMdx {
  const frontmatter = extractFrontmatter(content)
  const mdast = mdxParse(content) as Root

  // GithubSlugger handles dedup: "Usage", "Usage" → "usage", "usage-1"
  const slugger = new GithubSlugger()
  const headings: NavHeading[] = []
  for (const node of mdast.children) {
    if (node.type === 'heading') {
      const heading = node as Heading
      const text = extractText(heading.children)
      headings.push({
        depth: heading.depth,
        text,
        slug: slugger.slug(text),
      })
    }
  }

  const imageSrcs = collectImageSrcs(mdast)

  return {
    title: (frontmatter.title as string) || headings[0]?.text || 'Untitled',
    description: frontmatter.description as string | undefined,
    frontmatter,
    headings,
    imageSrcs,
    mdast,
  }
}

/* ── Image src collection ────────────────────────────────────────────── */

function isExternal(src: string): boolean {
  return src.startsWith('http://') || src.startsWith('https://')
}

function collectImageSrcs(root: Root): string[] {
  const srcs: string[] = []

  function walk(nodes: RootContent[]) {
    for (const node of nodes) {
      if (node.type === 'image' && node.url && !isExternal(node.url)) {
        srcs.push(node.url)
      }
      if (isJsxImageElement(node)) {
        const src = getJsxAttrValue(node, 'src')
        if (src && !isExternal(src)) {
          srcs.push(src)
        }
      }
      if ('children' in node && Array.isArray(node.children)) {
        walk(node.children as RootContent[])
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
 * - JSX PixelatedImage/img → src updated, width/height/placeholder attrs added
 *
 * Then serializes the mutated tree back to MDX string.
 */
export function rewriteMdxImages(mdast: Root, images: Map<string, ResolvedImage>): string {
  // Walk and mutate the tree. Process root.children and also nested children.
  mdast.children = mdast.children.flatMap((node) => {
    return rewriteNode(node, images)
  })

  // Serialize back to MDX
  return toMarkdown(mdast, {
    extensions: [
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
function rewriteNode(node: RootContent, images: Map<string, ResolvedImage>): RootContent[] {
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
      setJsxAttr(node, 'src', resolved.publicSrc)
      setJsxAttr(node, 'width', String(resolved.meta.width))
      setJsxAttr(node, 'height', String(resolved.meta.height))
      setJsxAttr(node, 'placeholder', resolved.meta.placeholder)
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
  if ('children' in node && Array.isArray(node.children)) {
    const children = node.children as RootContent[]
    ;(node as { children: RootContent[] }).children = children.flatMap((child) => {
      return rewriteNode(child, images)
    })
  }

  return [node]
}

/** Create an mdxJsxFlowElement node for PixelatedImage with all attributes */
function createPixelatedImageNode({ src, alt, meta }: { src: string; alt: string; meta: ImageMeta }): RootContent {
  return {
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
  } as unknown as RootContent
}

/* ── JSX node helpers ────────────────────────────────────────────────── */

type JsxNode = RootContent & {
  name?: string
  attributes: Array<{ type: string; name?: string; value?: unknown }>
}

function isJsxImageElement(node: RootContent): node is JsxNode {
  if (node.type !== 'mdxJsxFlowElement' || !('name' in node)) {
    return false
  }
  const name = (node as JsxNode).name
  return name === 'PixelatedImage' || name === 'img'
}

function getJsxAttrValue(node: JsxNode, attrName: string): string | undefined {
  const attr = node.attributes.find((a) => {
    return a.type === 'mdxJsxAttribute' && a.name === attrName
  })
  if (!attr) {
    return undefined
  }
  if (typeof attr.value === 'string') {
    return attr.value
  }
  if (attr.value && typeof attr.value === 'object' && 'value' in attr.value) {
    const v = (attr.value as { value: string }).value
    if (typeof v === 'string') {
      return v.replace(/^['"]|['"]$/g, '')
    }
  }
  return undefined
}

function setJsxAttr(node: JsxNode, attrName: string, value: string): void {
  const existing = node.attributes.find((a) => {
    return a.type === 'mdxJsxAttribute' && a.name === attrName
  })
  if (existing) {
    existing.value = value
  } else {
    node.attributes.push({ type: 'mdxJsxAttribute', name: attrName, value })
  }
}

/* ── Frontmatter extraction ─────────────────────────────────────────── */

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/

function extractFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(FRONTMATTER_RE)
  if (!match) {
    return {}
  }
  const result: Record<string, unknown> = {}
  const yamlBlock = match[1] ?? ''
  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) {
      continue
    }
    const key = line.slice(0, colonIdx).trim()
    let value: string | boolean = line.slice(colonIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (value === 'true') {
      value = true
    } else if (value === 'false') {
      value = false
    }
    if (key) {
      result[key] = value
    }
  }
  return result
}

/* ── Heading text extraction ────────────────────────────────────────── */

function extractText(children: PhrasingContent[]): string {
  return children
    .map((child) => {
      if (child.type === 'text') {
        return child.value
      }
      if ('children' in child) {
        return extractText(child.children as PhrasingContent[])
      }
      return ''
    })
    .join('')
}


