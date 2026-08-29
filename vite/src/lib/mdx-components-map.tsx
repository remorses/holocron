/**
 * MDX component map + `renderNode` transformer for safe-mdx.
 * Maps MDX element names and mdast nodes to editorial components.
 */

import { Children, Fragment, type ElementType, type ReactNode } from 'react'
import { SafeMdxRenderer } from 'safe-mdx'
import type { PhrasingContent, Root, RootContent } from 'mdast'
import type { MyRootContent } from 'safe-mdx'
import { mdxParse, type EagerModules } from 'safe-mdx/parse'
import {
  Aside,
  FullWidth,
  Above,
  Hero,
  Heading,
  SectionHeading,
  Bleed,
  Callout,
  Note,
  Warning,
  Info,
  Tip,
  Check,
  Danger,
  TableOfContentsPanel,
  Tabs,
  Tab,
  Accordion,
  AccordionGroup,
  Mermaid,
  Badge,
  Card,
  CardGroup,
  Columns,
  Column,
  Expandable,
  Frame,
  Prompt,
  ParamField,
  ResponseField,
  Steps,
  Step,
  Tile,
  Tooltip,
  Update,
  View,
  Panel,
  CodeCard,
  RequestExample,
  ResponseExample,
  Tree,
  TreeFolder,
  TreeFile,
  Color,
  ColorRow,
  ColorItem,
  Visibility,
  Icon,
  Logo,
  Marquee,
  VideoBackgroundShader,
  ImageboardGrid,
  ImageboardVideo,
} from '../components/markdown/index.tsx'
import { slug } from 'github-slugger'
import { extractText } from './toc-tree.ts'
import { logMdxError } from './logger.ts'
import { parseCodeMeta, metaBool, type BleedMode } from './code-meta.ts'
import type { SafeMdxComponentName } from './mdx-component-names.ts'
import { HighlightedCodeBlock } from './highlight-code.tsx'
import {
  EditorialImage,
  editorialMarkdownComponents,
} from './editorial-markdown-components.tsx'

import { SidebarAssistant, PageNavRow } from '../components/sidebar-assistant.tsx'
import { OpenAPIEndpoint } from './openapi/render-openapi.tsx'
import { MCPTool, MCPResource } from './mcp/render-mcp.tsx'

const Markdown = ({ children, inline = false }: { children: ReactNode, inline?: boolean }) => {
  const markdown = Children.toArray(children).join('')

  return (
    <SafeMdxRenderer
      markdown={markdown}
      mdast={mdxParse(markdown)}
      components={inline ? { ...mdxComponents, p: Fragment } : mdxComponents}
      renderNode={renderNode}
      onError={logMdxError}
    />
  )
}

function getAttributeString(node: Extract<MyRootContent, { type: 'mdxJsxFlowElement' | 'mdxJsxTextElement' }>, name: string): string | undefined {
  const attr = node.attributes.find((a) => a.type === 'mdxJsxAttribute' && a.name === name)
  if (!attr) return undefined
  if (typeof attr.value === 'string') return attr.value
  if (attr.value && typeof attr.value === 'object') return attr.value.value
  return undefined
}

function isPhrasingContent(node: MyRootContent): node is PhrasingContent {
  return node.type === 'break'
    || node.type === 'delete'
    || node.type === 'emphasis'
    || node.type === 'footnoteReference'
    || node.type === 'html'
    || node.type === 'image'
    || node.type === 'imageReference'
    || node.type === 'inlineCode'
    || node.type === 'link'
    || node.type === 'linkReference'
    || node.type === 'mdxJsxTextElement'
    || node.type === 'mdxTextExpression'
    || node.type === 'strong'
    || node.type === 'text'
}

export const mdxComponents = {
  ...editorialMarkdownComponents,
  Heading,
  Bleed,
  Aside,
  FullWidth,
  Above,
  Hero,
  Callout,
  Note,
  Warning,
  Info,
  Tip,
  Check,
  Danger,
  Tabs,
  Tab,
  Accordion,
  AccordionGroup,
  Mermaid,
  Badge,
  Card,
  CardGroup,
  Columns,
  Column,
  Expandable,
  Frame,
  Prompt,
  ParamField,
  ResponseField,
  Steps,
  Step,
  Tile,
  Tooltip,
  Update,
  View,
  Panel,
  CodeCard,
  RequestExample,
  ResponseExample,
  Tree,
  'Tree.Folder': TreeFolder,
  'Tree.File': TreeFile,
  Color,
  'Color.Row': ColorRow,
  'Color.Item': ColorItem,
  Icon: Icon,
  Logo,
  Markdown,
  Marquee,
  Visibility,
  VideoBackgroundShader,
  ImageboardGrid,
  ImageboardVideo,
  // Reads currentHeadings from useHolocronData() when `headings` prop omitted.
  // No more per-page closure binding.
  TableOfContentsPanel,
  HolocronAIAssistantWidget: SidebarAssistant,
  HolocronPageNavRow: PageNavRow,
  OpenAPIEndpoint,
  MCPTool,
  MCPResource,
} satisfies Record<SafeMdxComponentName | `${string}.${string}`, ElementType>


export interface RenderNodeOptions {
  /**
   * Force fenced code blocks to render without the line-number gutter,
   * ignoring the `lines` meta flag. Used by the AI chat panel, where the
   * narrow column makes numbers pure noise.
   */
  forceNoLineNumbers?: boolean
  /**
   * Default bleed mode for fenced code blocks when the `bleed` meta flag is
   * absent. Docs pages bleed right so code text lines up with the prose left
   * edge; narrow surfaces like the chat panel pass `'none'`.
   */
  defaultCodeBleed?: boolean | BleedMode
}

/**
 * Build a safe-mdx `renderNode` transformer. Options let non-docs surfaces
 * (currently the AI chat panel) tweak code block chrome without duplicating
 * the whole mdast → JSX mapping.
 */
export function createRenderNode(options: RenderNodeOptions) {
  return (node: MyRootContent, transform: (node: MyRootContent) => ReactNode) => {
    // Only fenced code blocks are configurable; everything else falls through
    // to the shared docs mapping.
    if (node.type === 'code') return renderCodeBlock(node, options)
    return renderNode(node, transform)
  }
}

/** Default transformer used by docs pages. */
export function renderNode(
  node: MyRootContent,
  transform: (node: MyRootContent) => ReactNode,
): ReactNode | undefined {
  if (node.type === 'image') {
    const imgNode = node
    return <EditorialImage src={imgNode.url} alt={imgNode.alt || ''} />
  }
  if (node.type === 'heading') {
    const heading = node
    const text = extractText(heading.children)
    const id = slug(text)
    const level = Math.max(2, heading.depth)
    return (
      <SectionHeading key={id} id={id} level={level}>
        {heading.children.map((child, i) => {
          return <Fragment key={i}>{transform(child)}</Fragment>
        })}
      </SectionHeading>
    )
  }
  // Intercept <Heading> JSX elements (emitted by remark-headings as
  // mdxJsxTextElement, promoted to flow by remarkMarkAndUnravel). Rendering
  // them here via SectionHeading avoids safe-mdx's default flow-element
  // handling which wraps bare text children in <p> → P component.
  //
  // The parser wraps bare text inside flow elements in paragraph nodes, so
  // the heading's children are [paragraph → [text]] not [text]. We unwrap
  // paragraphs to get the inline content directly.
  if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'Heading') {
    const level = Math.min(6, Math.max(2, Number(getAttributeString(node, 'level') ?? 1)))
    // Unwrap paragraph wrappers: flow element text gets wrapped in paragraphs by the parser
    const inlineChildren: PhrasingContent[] = []
    for (const child of node.children ?? []) {
      if (child.type === 'paragraph') {
        inlineChildren.push(...(child.children ?? []))
      } else if (isPhrasingContent(child)) {
        inlineChildren.push(child)
      }
    }
    const id = getAttributeString(node, 'id') ?? slug(extractText(inlineChildren))
    return (
      <SectionHeading key={id} id={id} level={level}>
        {inlineChildren.map((child, i) => {
          return <Fragment key={i}>{transform(child)}</Fragment>
        })}
      </SectionHeading>
    )
  }

  if (node.type === 'code') return renderCodeBlock(node, {})
  return undefined
}

function renderCodeBlock(
  node: Extract<MyRootContent, { type: 'code' }>,
  options: RenderNodeOptions,
): ReactNode {
  const lang = node.lang || 'bash'
  const isDiagram = lang === 'diagram'
  const meta = parseCodeMeta(node.meta)
  // Wrapped code has no stable line grid (one logical line can span many
  // visual lines), so line numbers and the highlight overlay are disabled:
  // both allocate exactly 1lh per logical line and would misalign.
  const wrap = metaBool(meta.attributes.wrap) ?? false
  const showLineNumbers = isDiagram || wrap || options.forceNoLineNumbers
    ? false
    : metaBool(meta.attributes.lines)
  // Fenced code blocks default to right-edge bleed so the code text lines up
  // with the prose left edge. `bleed=true` → both sides, `bleed=false`/`none`
  // → no bleed. The enum values (both/right/none) also pass through.
  const defaultBleed = options.defaultCodeBleed ?? 'right'
  const rawBleed = meta.attributes.bleed
  const bleed: boolean | BleedMode =
    rawBleed === 'both' || rawBleed === 'right' || rawBleed === 'none'
      ? rawBleed
      : rawBleed === undefined
        ? defaultBleed
        : (metaBool(rawBleed) ?? defaultBleed)
  const highlight = wrap ? undefined : meta.attributes.highlight
  return (
    <HighlightedCodeBlock lang={lang} lineHeight={isDiagram ? '1.4' : '1.6'} showLineNumbers={showLineNumbers} bleed={bleed} title={meta.title} highlight={highlight} wrap={wrap}>
      {node.value}
    </HighlightedCodeBlock>
  )
}

/** Render an array of mdast nodes through safe-mdx with the editorial
 *  component map and `renderNode` transformer. Used to render content,
 *  aside, and above nodes server-side. */
export function RenderNodes({ markdown, nodes, modules, baseUrl, source }: {
  markdown: string
  nodes: RootContent[]
  /** Pre-resolved modules for MDX import statements */
  modules?: EagerModules
  /** Directory of the current MDX file for resolving relative imports */
  baseUrl?: string
  source?: string
}) {
  const syntheticRoot: Root = { type: 'root', children: nodes }
  return (
    <SafeMdxRenderer
      markdown={markdown}
      mdast={syntheticRoot}
      components={mdxComponents}
      renderNode={renderNode}
      modules={modules}
      baseUrl={baseUrl}
      onError={(error) => logMdxError(error, source)}
    />
  )
}
