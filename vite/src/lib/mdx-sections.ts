/**
 * Split an mdast tree into editorial sections.
 * Splits at every heading and handles `<Aside full>` row spans.
 */

import type { Root, RootContent } from 'mdast'

type FlowJsxNode = Extract<RootContent, { type: 'mdxJsxFlowElement' }>

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

export function isAsideNode(node: RootContent): node is FlowJsxNode {
  return node.type === 'mdxJsxFlowElement' && node.name === 'Aside'
}

export function hasFullProp(node: RootContent): boolean {
  return node.type === 'mdxJsxFlowElement' && node.attributes.some((a) => a.type === 'mdxJsxAttribute' && a.name === 'full')
}

export function isFullWidthNode(node: RootContent): node is FlowJsxNode {
  return node.type === 'mdxJsxFlowElement' && node.name === 'FullWidth'
}

export function isAboveNode(node: RootContent): node is FlowJsxNode {
  return node.type === 'mdxJsxFlowElement' && (node.name === 'Above' || node.name === 'Hero')
}

function isHeadingNode(node: RootContent): boolean {
  return node.type === 'heading'
    || (node.type === 'mdxJsxFlowElement' && (node.name === 'Heading' || /^h[1-6]$/.test(node.name ?? '')))
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
      sections.push({ contentNodes: node.children, asideNodes: [], fullWidth: true })
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
 * The shared aside payload is attached to the last sub-section with
 * `asideRowSpan` set to the number of sub-sections, so on desktop it lives in
 * a CSS grid cell spanning
 * all those rows (`grid-row: N / span M`). Inside that tall cell a
 * `position: sticky` aside can scroll alongside the whole range.
 *
 * Sections BEFORE the first full aside still use normal per-section asides
 * (asideRowSpan = 1).
 */
export function buildSections(root: Root, { enableAssistant = true }: { enableAssistant?: boolean } = {}): MdastSection[] {
  // Strip invisible nodes (frontmatter, link definitions, ESM imports) from
  // the top level so they don't get swept into a leading empty section by
  // groupBySections. Import nodes are handled separately by app-factory.tsx
  // which prepends them to every section for component resolution.
  const children = root.children.filter((node) => {
    return node.type !== 'yaml' && node.type !== 'definition' && node.type !== 'mdxjsEsm'
  })

  // Build the list of nodes to inject into the first section's aside.
  // The page nav row (copy MD + prev/next) is always injected; the AI
  // assistant widget is only injected when enabled.
  const injectedNodes: FlowJsxNode[] = []
  if (enableAssistant) {
    injectedNodes.push({
      type: 'mdxJsxFlowElement',
      name: 'HolocronAIAssistantWidget',
      attributes: [],
      children: [],
    })
  }
  injectedNodes.push({
    type: 'mdxJsxFlowElement',
    name: 'HolocronPageNavRow',
    attributes: [],
    children: [],
  })

  {
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
      const asideNode = children[firstAsideIdx]
      if (asideNode && isAsideNode(asideNode)) {
        asideNode.children.unshift(...injectedNodes)
      }
    } else {
      const fullAsideNode: FlowJsxNode = {
        type: 'mdxJsxFlowElement',
        name: 'Aside',
        attributes: [{ type: 'mdxJsxAttribute', name: 'full', value: null }],
        children: [...injectedNodes],
      }
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
    return groupBySections({ type: 'root', children }).filter(sectionHasContent)
  }

  const sections: MdastSection[] = []
  const firstIdx = fullAsideIndices[0]!

  // Range before first full aside → split normally at ## headings
  if (firstIdx > 0) {
    const before: Root = { type: 'root', children: children.slice(0, firstIdx) }
    sections.push(...groupBySections(before))
  }

  // Each full-aside range: split at headings and collect every Aside in the
  // range into one shared sidebar payload.
  for (let r = 0; r < fullAsideIndices.length; r++) {
    const start = fullAsideIndices[r]!
    const end = fullAsideIndices[r + 1] ?? children.length

    const rangeNodes = children.slice(start + 1, end)
    const rangeAsideNodes = rangeNodes.filter(isAsideNode)
    const contentOnly = rangeNodes.filter((n) => !isAsideNode(n) && !isFullWidthNode(n))
    const sharedAsideNode = children[start]!
    const sharedAsideNodes = [sharedAsideNode, ...rangeAsideNodes]

    const contentRoot: Root = { type: 'root', children: contentOnly }
    const subSections = groupBySections(contentRoot)

    if (subSections.length === 0) {
      sections.push({ contentNodes: [], asideNodes: sharedAsideNodes, asideRowSpan: 1 })
      continue
    }

    // Attach the shared aside to the LAST sub-section (for clean mobile stacking
    // at the end of its range). Desktop rendering uses asideRowSpan to compute
    // an explicit `grid-row: start / span N` that covers all sub-sections.
    const lastSub = subSections[subSections.length - 1]!
    lastSub.asideNodes = sharedAsideNodes
    lastSub.asideRowSpan = subSections.length
    sections.push(...subSections)
  }

  return sections.filter(sectionHasContent)
}

/** A section is empty when it has no visible content and no aside nodes.
 *  Empty sections create phantom grid rows with --section-gap spacing.
 *  Import nodes (mdxjsEsm) are invisible and don't count as content. */
function sectionHasContent(s: MdastSection): boolean {
  if (s.asideNodes.length > 0) return true
  return s.contentNodes.some((n) => n.type !== 'mdxjsEsm')
}
