/**
 * Split an mdast tree into editorial sections.
 * Splits at every heading and handles `<Aside full>` row spans.
 */

import type { Root, RootContent } from 'mdast'

export type MdastSection = {
  contentNodes: RootContent[]
  asideNodes: RootContent[]
  /** How many section rows this section's aside spans on desktop.
   *  1 (default) for per-section asides; N for a shared `<Aside full>`
   *  range, where N is the number of sub-sections.
   *
   *  For a shared full aside, the aside is attached to the LAST sub-section
   *  of its range (so on mobile it stacks at the end of the content range).
   *  On desktop the renderer computes the starting grid row from the
   *  section's own index and the span: `start = thisRow - span + 1`. */
  asideRowSpan?: number
  fullWidth?: boolean
}

export function isAsideNode(node: RootContent): boolean {
  return node.type === 'mdxJsxFlowElement' && 'name' in node && (node as { name?: string }).name === 'Aside'
}

export function hasFullProp(node: RootContent): boolean {
  const attrs = (node as { attributes?: Array<{ name: string }> }).attributes
  return attrs?.some((a) => a.name === 'full') ?? false
}

export function isFullWidthNode(node: RootContent): boolean {
  return node.type === 'mdxJsxFlowElement' && 'name' in node && (node as { name?: string }).name === 'FullWidth'
}

export function isHeroNode(node: RootContent): boolean {
  return node.type === 'mdxJsxFlowElement' && 'name' in node && (node as { name?: string }).name === 'Hero'
}

function isHeadingNode(node: RootContent): boolean {
  return node.type === 'heading' || (node.type === 'mdxJsxFlowElement' && 'name' in node && (node as { name?: string }).name === 'Heading')
}

/** Filter out mdast node types that render to nothing so they don't create
 *  empty grid rows. Frontmatter (`yaml`/`toml`) and link reference definitions
 *  are the main culprits — they appear as top-level children but produce no
 *  visible output. Leaving them in would add an extra empty `slot-main` +
 *  `--section-gap` before the first real section. */
function isInvisibleNode(node: RootContent): boolean {
  const t = (node as { type: string }).type
  return t === 'yaml' || t === 'toml' || t === 'definition'
}

function groupBySections(root: Root): MdastSection[] {
  const sections: MdastSection[] = []
  let current: MdastSection = { contentNodes: [], asideNodes: [] }

  for (const node of root.children) {
    // Split on ANY heading depth (#, ##, ###, ####, #####, ######) so every
    // heading gets its own grid row with --section-gap above it. This keeps
    // vertical rhythm uniform regardless of heading hierarchy — headings
    // always stand out with 48px breathing room, and content under a
    // heading flows with the tighter --prose-gap inside each section.
    if (isHeadingNode(node)) {
      if (current.contentNodes.length > 0 || current.asideNodes.length > 0) {
        sections.push(current)
      }
      current = { contentNodes: [node], asideNodes: [] }
    } else if (isFullWidthNode(node)) {
      if (current.contentNodes.length > 0 || current.asideNodes.length > 0) {
        sections.push(current)
      }
      const children = 'children' in node ? (node as { children: RootContent[] }).children : []
      sections.push({ contentNodes: children, asideNodes: [], fullWidth: true })
      current = { contentNodes: [], asideNodes: [] }
    } else if (isAsideNode(node)) {
      current.asideNodes.push(node)
    } else {
      current.contentNodes.push(node)
    }
  }

  if (current.contentNodes.length > 0 || current.asideNodes.length > 0) {
    sections.push(current)
  }

  return sections
}

/**
 * Build sections with support for `<Aside full>`.
 *
 * A full aside spans every sub-section between itself and the next
 * `<Aside full>` (or EOF). Unlike the earlier "merged" approach, we STILL
 * split content at EVERY heading level inside a full-aside range — each
 * sub-section gets its own row in the page grid, separated by `--section-gap`.
 * The shared
 * aside is attached to the first sub-section with `asideRowSpan` set to the
 * number of sub-sections, so on desktop it lives in a CSS grid cell spanning
 * all those rows (`grid-row: N / span M`). Inside that tall cell a
 * `position: sticky` aside can scroll alongside the whole range.
 *
 * Sections BEFORE the first full aside still use normal per-section asides
 * (asideRowSpan = 1).
 */
export function buildSections(root: Root): MdastSection[] {
  // Strip invisible nodes (frontmatter, link definitions) from the top level
  // so they don't get swept into a leading empty section by groupBySections.
  const children = root.children.filter((n) => !isInvisibleNode(n))

  const ENABLE_ASSISTANT = true

  if (ENABLE_ASSISTANT) {
    const assistantNode: RootContent = {
      type: 'mdxJsxFlowElement',
      name: 'HolocronAIAssistantWidget',
      attributes: [],
      children: [],
    } as unknown as RootContent

    let firstSectionEnd = children.length
    for (let i = 0; i < children.length; i++) {
      if (isHeadingNode(children[i]!) || isFullWidthNode(children[i]!)) {
        firstSectionEnd = i
        break
      }
    }

    let firstAsideIdx = -1
    for (let i = 0; i < firstSectionEnd; i++) {
      if (isAsideNode(children[i]!)) {
        firstAsideIdx = i
        break
      }
    }

    if (firstAsideIdx !== -1) {
      const asideNode = children[firstAsideIdx] as { children?: RootContent[] }
      if (!asideNode.children) asideNode.children = []
      asideNode.children.unshift(assistantNode)
    } else {
      const fullAsideNode: RootContent = {
        type: 'mdxJsxFlowElement',
        name: 'Aside',
        attributes: [{ type: 'mdxJsxAttribute', name: 'full', value: null }] as any,
        children: [assistantNode],
      } as unknown as RootContent
      children.unshift(fullAsideNode)
    }
  }

  // Find indices of all <Aside full> nodes
  const fullAsideIndices: number[] = []
  for (let i = 0; i < children.length; i++) {
    const node = children[i]!
    if (isAsideNode(node) && hasFullProp(node)) {
      fullAsideIndices.push(i)
    }
  }

  // No full asides → split normally (existing behavior)
  if (fullAsideIndices.length === 0) {
    return groupBySections({ type: 'root', children } as Root)
  }

  const sections: MdastSection[] = []
  const firstIdx = fullAsideIndices[0]!

  // Range before first full aside → split normally at ## headings
  if (firstIdx > 0) {
    const before: Root = { type: 'root', children: children.slice(0, firstIdx) }
    sections.push(...groupBySections(before))
  }

  // Each full-aside range: split at ## into sub-sections; first sub-section
  // owns the shared aside with row-span = number of sub-sections.
  for (let r = 0; r < fullAsideIndices.length; r++) {
    const start = fullAsideIndices[r]!
    const end = fullAsideIndices[r + 1] ?? children.length

    const rangeNodes = children.slice(start + 1, end)
    const contentOnly = rangeNodes.filter((n) => !isAsideNode(n) && !isFullWidthNode(n))
    const asideNode = children[start]!

    const contentRoot: Root = { type: 'root', children: contentOnly }
    const subSections = groupBySections(contentRoot)

    if (subSections.length === 0) {
      sections.push({ contentNodes: [], asideNodes: [asideNode], asideRowSpan: 1 })
      continue
    }

    // Attach the shared aside to the LAST sub-section (for clean mobile stacking
    // at the end of its range). Desktop rendering uses asideRowSpan to compute
    // an explicit `grid-row: start / span N` that covers all sub-sections.
    const lastSub = subSections[subSections.length - 1]!
    lastSub.asideNodes = [asideNode]
    lastSub.asideRowSpan = subSections.length
    sections.push(...subSections)
  }

  return sections
}
