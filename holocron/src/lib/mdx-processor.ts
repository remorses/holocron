/**
 * MDX processor — extracts frontmatter and headings from MDX content.
 *
 * Uses safe-mdx/parse to get an mdast tree, then walks it to extract:
 * - Frontmatter (YAML between --- delimiters)
 * - Headings with depth, text, and slugified anchor ID
 *
 * Does NOT render the MDX — that happens at request time in the page handler.
 */

import { mdxParse } from 'safe-mdx/parse'
import type { Root, Heading, PhrasingContent } from 'mdast'
import type { NavHeading } from '../navigation.ts'

export type ProcessedMdx = {
  title: string
  description?: string
  frontmatter: Record<string, unknown>
  headings: NavHeading[]
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

  return {
    title: (frontmatter.title as string) || headings[0]?.text || 'Untitled',
    description: frontmatter.description as string | undefined,
    frontmatter,
    headings,
  }
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
