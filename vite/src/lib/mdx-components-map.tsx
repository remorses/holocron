/**
 * MDX component map + `renderNode` transformer for safe-mdx.
 * Maps MDX element names and mdast nodes to editorial components.
 */

import { Fragment, type ReactNode } from 'react'
import { SafeMdxRenderer } from 'safe-mdx'
import type { Root, Heading, RootContent, Image } from 'mdast'
import type { MyRootContent } from 'safe-mdx'
import { Aside, FullWidth, Hero } from '../components/markdown/markers.tsx'
import { P, A, Code, Caption, SectionHeading, type HeadingLevel } from '../components/markdown/typography.tsx'
import { CodeBlock } from '../components/markdown/code-block.tsx'
import { ComparisonTable } from '../components/markdown/table.tsx'
import { PixelatedImage } from '../components/markdown/image.tsx'
import { Bleed, List, OL, Li } from '../components/markdown/layout.tsx'
import { Callout, Note, Warning, Info, Tip, Check, Danger } from '../components/markdown/callout.tsx'
import { TableOfContentsPanel } from '../components/toc-panel.tsx'
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
