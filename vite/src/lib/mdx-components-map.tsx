/**
 * MDX component map + `renderNode` transformer for safe-mdx.
 * Maps MDX element names and mdast nodes to editorial components.
 */

import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { SafeMdxRenderer } from 'safe-mdx'
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
  Blockquote,
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

import { SidebarAssistant, PageNavRow } from '../components/sidebar-assistant.tsx'
import { OpenAPIEndpoint } from './openapi/render-openapi.tsx'
import { MCPTool, MCPResource } from './mcp/render-mcp.tsx'

function ImageWithProps(props: {
  src: string
  alt: string
  width?: string | number
  height?: string | number
  placeholder?: string
  className?: string
  loading?: 'lazy' | 'eager'
}) {
  return (
    <Image
      src={props.src}
      alt={props.alt}
      width={props.width}
      height={props.height}
      placeholder={props.placeholder}
      className={props.className || ''}
      loading={props.loading}
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

// Native JSX headings (<h1 className='...'>text</h1>) rendered through the
// component map. When written multi-line in MDX, the parser wraps text in
// paragraph nodes → P component → editorial-prose div. These overrides unwrap
// P children so heading text renders inline without the prose wrapper.
// Markdown # headings are intercepted by renderNode before reaching these.
function createJsxHeading(Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') {
  return function JsxHeading({ children, ...props }: Record<string, any>) {
    return <Tag {...props}>{unwrapPChildren(children)}</Tag>
  }
}

/** Strip P (editorial-prose) wrappers from React children. When the MDX parser
 *  wraps text inside a flow element in a paragraph node, safe-mdx renders it
 *  as <P> → <div class="editorial-prose">. This extracts the inner content. */
function unwrapPChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (isValidElement(child) && child.type === P) {
      return (child.props as { children?: ReactNode }).children
    }
    return child
  })
}

export const mdxComponents = {
  p: P,
  h1: createJsxHeading('h1'),
  h2: createJsxHeading('h2'),
  h3: createJsxHeading('h3'),
  h4: createJsxHeading('h4'),
  h5: createJsxHeading('h5'),
  h6: createJsxHeading('h6'),
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
  blockquote: Blockquote,
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
} satisfies Record<SafeMdxComponentName | `${string}.${string}`, unknown>


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
    const id = slug(text)
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
    const id = getAttributeString(node, 'id') ?? slug(extractText(inlineChildren))
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
    const meta = parseCodeMeta(node.meta)
    // Wrapped code has no stable line grid (one logical line can span many
    // visual lines), so line numbers and the highlight overlay are disabled:
    // both allocate exactly 1lh per logical line and would misalign.
    const wrap = metaBool(meta.attributes.wrap) ?? false
    const showLineNumbers = isDiagram || wrap ? false : metaBool(meta.attributes.lines)
    // Fenced code blocks default to right-edge bleed so the code text lines up
    // with the prose left edge. `bleed=true` → both sides, `bleed=false`/`none`
    // → no bleed. The enum values (both/right/none) also pass through.
    const rawBleed = meta.attributes.bleed
    const bleed: boolean | BleedMode =
      rawBleed === 'both' || rawBleed === 'right' || rawBleed === 'none'
        ? rawBleed
        : rawBleed === undefined
          ? 'right'
          : (metaBool(rawBleed) ?? 'right')
    const highlight = wrap ? undefined : meta.attributes.highlight
    return (
      <CodeBlock lang={lang} lineHeight={isDiagram ? '1.4' : '1.6'} showLineNumbers={showLineNumbers} bleed={bleed} title={meta.title} highlight={highlight} wrap={wrap}>
        {node.value}
      </CodeBlock>
    )
  }
  return undefined
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

/** Render MDX imported from another MDX file, e.g.
 *  `import Snippet from '/snippets/example.mdx'` followed by `<Snippet />`.
 *  Vite doesn't compile user MDX snippets as JSX, so the virtual modules map
 *  exposes raw markdown and this component renders it through the same safe-mdx
 *  component map used by pages. */
function RenderImportedMdx({ markdown, baseUrl, source }: {
  markdown: string
  baseUrl?: string
  source?: string
}) {
  return (
    <SafeMdxRenderer
      markdown={markdown}
      mdast={mdxParse(markdown)}
      components={mdxComponents}
      renderNode={renderNode}
      baseUrl={baseUrl}
      onError={(error) => logMdxError(error, source)}
    />
  )
}
