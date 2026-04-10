/**
 * MDX component map + `renderNode` transformer for safe-mdx.
 * Maps MDX element names and mdast nodes to editorial components.
 */

import { Fragment, type ReactNode } from 'react'
import { SafeMdxRenderer } from 'safe-mdx'
import type { Root, RootContent, Image } from 'mdast'
import type { MyRootContent } from 'safe-mdx'
import {
  Aside,
  FullWidth,
  Hero,
  P,
  A,
  Code,
  Caption,
  CodeBlock,
  Heading,
  SectionHeading,
  ComparisonTable,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  PixelatedImage,
  Bleed,
  List,
  OL,
  Li,
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
  RequestExample,
  ResponseExample,
  Tree,
  TreeFolder,
  TreeFile,
  Color,
  ColorRow,
  ColorItem,
  Icon,
} from '../components/markdown/index.tsx'
import { slugify, extractText } from './toc-tree.ts'

import { SidebarAssistant } from '../components/sidebar-assistant.tsx'

function PixelatedImageWithProps(props: {
  src: string
  alt: string
  width?: string | number
  height?: string | number
  intrinsicWidth?: string | number
  intrinsicHeight?: string | number
  placeholder?: string
  className?: string
}) {
  return (
    <PixelatedImage
      src={props.src}
      alt={props.alt}
      width={props.width}
      height={props.height}
      intrinsicWidth={props.intrinsicWidth}
      intrinsicHeight={props.intrinsicHeight}
      placeholder={props.placeholder}
      className={props.className || ''}
    />
  )
}

export const mdxComponents = {
  p: P,
  Heading,
  a: A,
  code: Code,
  table: Table,
  thead: TableHeader,
  tbody: TableBody,
  tfoot: TableFooter,
  tr: TableRow,
  th: TableHead,
  td: TableCell,
  caption: TableCaption,
  ul: List,
  ol: OL,
  li: Li,
  Caption,
  ComparisonTable,
  PixelatedImage: PixelatedImageWithProps,
  Bleed,
  Aside,
  FullWidth,
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
  RequestExample,
  ResponseExample,
  Tree,
  'Tree.Folder': TreeFolder,
  'Tree.File': TreeFile,
  Color,
  'Color.Row': ColorRow,
  'Color.Item': ColorItem,
  Icon: Icon,
  // Reads currentHeadings from useHolocronData() when `headings` prop omitted.
  // No more per-page closure binding.
  TableOfContentsPanel,
  HolocronAIAssistantWidget: SidebarAssistant,
}

export function renderNode(
  node: MyRootContent,
  transform: (node: MyRootContent) => ReactNode,
): ReactNode | undefined {
  if (node.type === 'image') {
    const imgNode = node
    return <PixelatedImageWithProps src={imgNode.url} alt={imgNode.alt || ''} />
  }
  if (node.type === 'heading') {
    const heading = node
    const text = extractText(heading.children)
    const id = slugify(text)
    const level = Math.min(heading.depth - 1, 3)
    return (
      <SectionHeading key={id} id={id} level={level}>
        {heading.children.map((child, i) => {
          return <Fragment key={i}>{transform(child)}</Fragment>
        })}
      </SectionHeading>
    )
  }
  if (node.type === 'code') {
    const lang = node.lang || 'bash'
    const isDiagram = lang === 'diagram'
    return (
      <CodeBlock lang={lang} lineHeight={isDiagram ? '1.3' : '1.6'} showLineNumbers={!isDiagram}>
        {node.value}
      </CodeBlock>
    )
  }
  return undefined
}

/** Render an array of mdast nodes through safe-mdx with the editorial
 *  component map and `renderNode` transformer. Used to render content,
 *  aside, and hero nodes server-side. */
export function RenderNodes({ markdown, nodes }: { markdown: string; nodes: RootContent[] }) {
  const syntheticRoot: Root = { type: 'root', children: nodes }
  return (
    <SafeMdxRenderer
      markdown={markdown}
      mdast={syntheticRoot}
      components={mdxComponents}
      renderNode={renderNode}
    />
  )
}
