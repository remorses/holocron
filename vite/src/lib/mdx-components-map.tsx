/**
 * MDX component map + `renderNode` transformer for safe-mdx.
 * Maps MDX element names and mdast nodes to editorial components.
 */

import { Fragment, type ReactNode } from 'react'
import { SafeMdxRenderer, type SafeMdxError } from 'safe-mdx'
import type { Root, RootContent } from 'mdast'
import type { MyRootContent } from 'safe-mdx'
import type { EagerModules } from 'safe-mdx/parse'
import {
  Aside,
  FullWidth,
  Above,
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
  Image,
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
  CodeCard,
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
import { OpenAPIEndpoint } from './openapi/render-openapi.tsx'

function ImageWithProps(props: {
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
    <Image
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
  Image: ImageWithProps,
  img: ImageWithProps,
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
  // Reads currentHeadings from useHolocronData() when `headings` prop omitted.
  // No more per-page closure binding.
  TableOfContentsPanel,
  HolocronAIAssistantWidget: SidebarAssistant,
  OpenAPIEndpoint,
}

export function renderNode(
  node: MyRootContent,
  transform: (node: MyRootContent) => ReactNode,
): ReactNode | undefined {
  if (node.type === 'image') {
    const imgNode = node
    return <ImageWithProps src={imgNode.url} alt={imgNode.alt || ''} />
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
  // Intercept <Heading> JSX elements (emitted by remark-headings as
  // mdxJsxTextElement, promoted to flow by remarkMarkAndUnravel). Rendering
  // them here via SectionHeading avoids safe-mdx's default flow-element
  // handling which wraps bare text children in <p> → P component.
  //
  // The parser wraps bare text inside flow elements in paragraph nodes, so
  // the heading's children are [paragraph → [text]] not [text]. We unwrap
  // paragraphs to get the inline content directly.
  if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'Heading') {
    const attrs = node.attributes ?? []
    const levelAttr = attrs.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === 'level')
    const idAttr = attrs.find((a: any) => a.type === 'mdxJsxAttribute' && a.name === 'id')
    const levelValue = levelAttr?.value
    const level = Number(typeof levelValue === 'object' && levelValue ? (levelValue as any).data?.estree?.body?.[0]?.expression?.value : 1)
    // Unwrap paragraph wrappers: flow element text gets wrapped in paragraphs by the parser
    const inlineChildren: any[] = []
    for (const child of (node.children ?? []) as any[]) {
      if (child.type === 'paragraph') {
        inlineChildren.push(...(child.children ?? []))
      } else {
        inlineChildren.push(child)
      }
    }
    const id = typeof idAttr?.value === 'string' ? idAttr.value : slugify(extractText(inlineChildren))
    return (
      <SectionHeading key={id} id={id} level={level}>
        {inlineChildren.map((child: any, i: number) => {
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

/** Log safe-mdx errors to stderr so missing components and expression
 *  failures surface in the Vite dev server terminal instead of being
 *  silently swallowed. */
export function logMdxError(error: SafeMdxError): void {
  const loc = error.line ? `:${error.line}` : ''
  const tag = error.type === 'missing-component' ? 'MISSING COMPONENT'
    : error.type === 'validation' ? 'VALIDATION'
    : error.type === 'expression' ? 'EXPRESSION'
    : error.type === 'esm-import' ? 'ESM IMPORT'
    : error.type
  console.warn(`[holocron] MDX ${tag}${loc}: ${error.message}`)
}

/** Render an array of mdast nodes through safe-mdx with the editorial
 *  component map and `renderNode` transformer. Used to render content,
 *  aside, and above nodes server-side. */
export function RenderNodes({ markdown, nodes, modules, baseUrl }: {
  markdown: string
  nodes: RootContent[]
  /** Pre-resolved modules for MDX import statements */
  modules?: EagerModules
  /** Directory of the current MDX file for resolving relative imports */
  baseUrl?: string
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
      onError={logMdxError}
    />
  )
}
