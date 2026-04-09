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
  type HeadingLevel,
} from '../components/markdown/index.tsx'
import { slugify, extractText } from './toc-tree.ts'

function PixelatedImageWithProps(props: {
  src: string
  alt: string
  width?: number
  height?: number
  placeholder?: string
  className?: string
}) {
  return (
    <PixelatedImage
      src={props.src}
      alt={props.alt}
      width={props.width || 0}
      height={props.height || 0}
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
    const level = Math.min(heading.depth - 1, 3) as HeadingLevel
    return (
      <SectionHeading key={id} id={id} level={level}>
        {heading.children.map((child, i) => {
          return <Fragment key={i}>{transform(child as MyRootContent)}</Fragment>
        })}
      </SectionHeading>
    )
  }
  if (node.type === 'code') {
    const codeNode = node as { lang?: string; value: string }
    const lang = codeNode.lang || 'bash'
    const isDiagram = lang === 'diagram'
    return (
      <CodeBlock lang={lang} lineHeight={isDiagram ? '1.3' : '1.6'} showLineNumbers={!isDiagram}>
        {codeNode.value}
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
      mdast={syntheticRoot as MyRootContent}
      components={mdxComponents}
      renderNode={renderNode}
    />
  )
}
