/**
 * MDX processor — extracts frontmatter, headings, and relative images.
 *
 * Uses safe-mdx/parse to get an mdast tree, then walks it to extract:
 * - Frontmatter (YAML between --- delimiters)
 * - Headings with depth, text, and slugified anchor ID
 * - Relative image paths for resolution + copying to public
 *
 * Does NOT render the MDX — that happens at request time in the page handler.
 */

import { mdxParse } from 'safe-mdx/parse'
import type { Root, Heading, PhrasingContent, RootContent } from 'mdast'
import type { NavHeading } from '../navigation.ts'

export type ProcessedMdx = {
  title: string
  description?: string
  frontmatter: Record<string, unknown>
  headings: NavHeading[]
  /** Relative image paths found in the MDX (e.g. "./images/screenshot.png") */
  relativeImages: string[]
}

/**
 * Parse MDX content and extract metadata.
 * Frontmatter is extracted via regex (YAML between --- delimiters).
 * Headings are extracted by walking the mdast tree.
 */
export function processMdx(content: string): ProcessedMdx {
  const frontmatter = extractFrontmatter(content)
  const mdast = mdxParse(content) as Root

  const headings: NavHeading[] = []
  for (const node of mdast.children) {
    if (node.type === 'heading') {
      const heading = node as Heading
      const text = extractText(heading.children)
      headings.push({
        depth: heading.depth,
        text,
        slug: slugify(text),
      })
    }
  }

  const relativeImages = collectRelativeImages(mdast)

  return {
    title: (frontmatter.title as string) || headings[0]?.text || 'Untitled',
    description: frontmatter.description as string | undefined,
    frontmatter,
    headings,
    relativeImages,
  }
}

/* ── Relative image collection ──────────────────────────────────────── */

/** Check if a path is relative (not absolute, not external URL) */
function isRelativePath(src: string): boolean {
  return !src.startsWith('/') && !src.startsWith('http://') && !src.startsWith('https://')
}

/** Walk mdast and collect all relative image src paths */
function collectRelativeImages(root: Root): string[] {
  const srcs: string[] = []

  function walk(nodes: RootContent[]) {
    for (const node of nodes) {
      if (node.type === 'image' && node.url && isRelativePath(node.url)) {
        srcs.push(node.url)
      }
      // MDX JSX elements: <PixelatedImage src="..." /> or <img src="..." />
      if (
        node.type === 'mdxJsxFlowElement' &&
        'name' in node &&
        'attributes' in node
      ) {
        const name = (node as { name?: string }).name
        if (name === 'PixelatedImage' || name === 'img') {
          const attrs = (node as { attributes: Array<{ type: string; name?: string; value?: unknown }> }).attributes
          const srcAttr = attrs.find((a) => {
            return a.type === 'mdxJsxAttribute' && a.name === 'src'
          })
          if (srcAttr) {
            const val = getAttrStringValue(srcAttr.value)
            if (val && isRelativePath(val)) {
              srcs.push(val)
            }
          }
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

/**
 * Rewrite relative image paths in raw MDX content.
 * Replaces each relative src with its new public path.
 *
 * Handles both markdown images ![alt](./path) and JSX src="./path".
 */
export function rewriteImagePaths(content: string, rewrites: Record<string, string>): string {
  let result = content
  for (const [original, replacement] of Object.entries(rewrites)) {
    // Escape special regex chars in the original path
    const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Replace in markdown image syntax: ![...](original) and JSX src="original"
    result = result.replace(new RegExp(escaped, 'g'), replacement)
  }
  return result
}

/** Extract string value from an mdxJsxAttribute value (string or expression). */
function getAttrStringValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object' && 'value' in value) {
    const v = (value as { value: string }).value
    if (typeof v === 'string') {
      return v.replace(/^['"]|['"]$/g, '')
    }
  }
  return undefined
}

/* ── Frontmatter extraction ─────────────────────────────────────────── */

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/

function extractFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(FRONTMATTER_RE)
  if (!match) {
    return {}
  }
  // Simple YAML-like parser for key: value pairs
  // Handles: title: My Title, description: Some text
  const result: Record<string, unknown> = {}
  const yamlBlock = match[1] ?? ''
  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) {
      continue
    }
    const key = line.slice(0, colonIdx).trim()
    let value: string | boolean = line.slice(colonIdx + 1).trim()
    // Strip surrounding quotes
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
