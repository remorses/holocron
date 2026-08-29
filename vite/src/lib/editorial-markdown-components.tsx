/**
 * Shared component map for standard Markdown elements.
 *
 * Full MDX pages, AI chat, and generated provider descriptions extend this
 * map so native Markdown keeps one editorial rendering implementation.
 */

import { Children, isValidElement, type CSSProperties, type ReactNode } from 'react'
import {
  A,
  Blockquote,
  Code,
  Image,
  Li,
  List,
  OL,
  P,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/markdown/index.tsx'

export function EditorialImage(props: {
  src: string
  alt: string
  width?: string | number
  height?: string | number
  intrinsicWidth?: string | number
  intrinsicHeight?: string | number
  placeholder?: string
  className?: string
  style?: CSSProperties
  loading?: 'lazy' | 'eager'
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
      style={props.style}
      loading={props.loading}
    />
  )
}

// Native JSX headings can contain parser-generated P wrappers in multi-line
// form. Remove those wrappers so heading text stays inline.
function createJsxHeading(Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') {
  return function JsxHeading({ children, ...props }: Record<string, any>) {
    return <Tag {...props}>{unwrapPChildren(children)}</Tag>
  }
}

function unwrapPChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (isValidElement(child) && child.type === P) {
      return (child.props as { children?: ReactNode }).children
    }
    return child
  })
}

/** Standard Markdown and native HTML elements shared by every renderer. */
export const editorialMarkdownComponents = {
  p: P,
  h1: createJsxHeading('h1'),
  h2: createJsxHeading('h2'),
  h3: createJsxHeading('h3'),
  h4: createJsxHeading('h4'),
  h5: createJsxHeading('h5'),
  h6: createJsxHeading('h6'),
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
  Image: EditorialImage,
  img: EditorialImage,
}
