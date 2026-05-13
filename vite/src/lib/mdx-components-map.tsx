/**
 * MDX component map + `renderNode` transformer for safe-mdx.
 * Maps MDX element names and mdast nodes to editorial components.
 */

import { Children, Fragment, type ReactNode } from 'react'
import { SafeMdxRenderer, type SafeMdxError } from 'safe-mdx'
import type { PhrasingContent, Root, RootContent } from 'mdast'
import type { MyRootContent } from 'safe-mdx'
import { mdxParse, type EagerModules } from 'safe-mdx/parse'
import {
  Aside,
  FullWidth,
  Above,
  Hero,
  P,
  A,
  Code,
  CodeBlock,
  Heading,
  SectionHeading,
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
  Visibility,
  Icon,
} from '../components/markdown/index.tsx'
import { slugify, extractText } from './toc-tree.ts'
import { colors, formatHolocronWarning, logger } from './logger.ts'

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
  Markdown,
  Visibility,
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
    const level = Number(getAttributeString(node, 'level') ?? 1)
    // Unwrap paragraph wrappers: flow element text gets wrapped in paragraphs by the parser
    const inlineChildren: PhrasingContent[] = []
    for (const child of node.children ?? []) {
      if (child.type === 'paragraph') {
        inlineChildren.push(...(child.children ?? []))
      } else if (isPhrasingContent(child)) {
        inlineChildren.push(child)
      }
    }
    const id = getAttributeString(node, 'id') ?? slugify(extractText(inlineChildren))
    return (
      <SectionHeading key={id} id={id} level={level}>
        {inlineChildren.map((child, i) => {
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

function getMdxErrorTypeLabel(type: SafeMdxError['type']): string {
  switch (type) {
    case 'missing-component': return 'missing component'
    case 'validation': return 'validation'
    case 'expression': return 'expression'
    case 'esm-import': return 'ESM import'
    default: return type
  }
}

function formatMdxErrorMessage(message: string): string {
  const unsupportedComponent = /^Unsupported jsx component (.+)$/.exec(message)
  if (unsupportedComponent) {
    return `Unsupported JSX component ${colors.yellow(unsupportedComponent[1]!)}`
  }

  return message
}

export function formatMdxError(error: SafeMdxError, source?: string): string {
  const lines = [
    formatHolocronWarning(`${colors.yellow('MDX')} ${getMdxErrorTypeLabel(error.type)}`),
    `  ${colors.dim('reason')} ${formatMdxErrorMessage(error.message)}`,
  ]

  if (source) {
    lines.splice(1, 0, `  ${colors.dim('source')} ${colors.cyan(source)}`)
  } else if (error.line) {
    lines.splice(1, 0, `  ${colors.dim('line')} ${colors.yellow(String(error.line))}`)
  }

  if (source && error.line) {
    lines.splice(2, 0, `  ${colors.dim('line')} ${colors.yellow(String(error.line))}`)
  }

  if (error.type === 'missing-component') {
    lines.push(`  ${colors.dim('fix')} register the component or import it from this MDX file`)
  }

  return lines.join('\n')
}

/** Log safe-mdx errors to stderr so missing components and expression
 *  failures surface in the Vite dev server terminal instead of being
 *  silently swallowed. This must never throw: MDX validation warnings should
 *  not be able to kill the dev server if stderr is closed by a parent process. */
export function logMdxError(error: SafeMdxError, source?: string): void {
  try {
    logger.warn(formatMdxError(error, source))
  } catch {
    // Best-effort terminal output only. Rendering can continue with the
    // placeholder/null node that safe-mdx already returns for recoverable errors.
  }
}

export function createMdxErrorLogger(source?: string): (error: SafeMdxError) => void {
  return (error) => logMdxError(error, source)
}

/** Render an array of mdast nodes through safe-mdx with the editorial
 *  component map and `renderNode` transformer. Used to render content,
 *  aside, and above nodes server-side. */
export function RenderNodes({ markdown, nodes, modules, baseUrl, sourcePath }: {
  markdown: string
  nodes: RootContent[]
  /** Pre-resolved modules for MDX import statements */
  modules?: EagerModules
  /** Directory of the current MDX file for resolving relative imports */
  baseUrl?: string
  sourcePath?: string
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
      onError={createMdxErrorLogger(sourcePath)}
    />
  )
}

/** Render MDX imported from another MDX file, e.g.
 *  `import Snippet from '/snippets/example.mdx'` followed by `<Snippet />`.
 *  Vite doesn't compile user MDX snippets as JSX, so the virtual modules map
 *  exposes raw markdown and this component renders it through the same safe-mdx
 *  component map used by pages. */
export function RenderImportedMdx({ markdown, baseUrl, sourcePath }: {
  markdown: string
  baseUrl?: string
  sourcePath?: string
}) {
  return (
    <SafeMdxRenderer
      markdown={markdown}
      mdast={mdxParse(markdown)}
      components={mdxComponents}
      renderNode={renderNode}
      baseUrl={baseUrl}
      onError={createMdxErrorLogger(sourcePath)}
    />
  )
}
