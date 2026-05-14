'use client'

/**
 * Editorial markdown components — public barrel.
 *
 * All components use CSS variables from globals.css (no prefix).
 * Uses shadcn standard token names: --primary, --foreground,
 * --muted-foreground, --border, --accent.
 */

export type { TocNodeType, TocTreeNode } from '../../lib/toc-tree.ts'
export type { TabItem, HeaderLink } from '../../site-data.ts'

export { ExpandableContainer } from './expandable-container.tsx'
export { ChevronIcon, SearchIcon } from './icons.tsx'

export {
  Heading,
  SectionHeading,
  P,
  A,
  Code,
  type HeadingLevel,
} from './typography.tsx'

export {
  Bleed,
  Divider,
  Section,
  OL,
  List,
  Li,
} from './layout.tsx'

export { CodeBlock } from './code-block.tsx'
export { Image, LazyVideo, ChartPlaceholder } from './image.tsx'
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table.tsx'
export { Badge } from './mintlify/badge.tsx'
export { Card, CardGroup, Columns, Column } from './mintlify/card.tsx'
export { Expandable } from './mintlify/expandable.tsx'
export { Frame } from './mintlify/frame.tsx'
export { Prompt } from './mintlify/prompt.tsx'
export { ParamField, ResponseField } from './mintlify/fields.tsx'
export { Steps, Step } from './mintlify/steps.tsx'
export { Tile } from './mintlify/tile.tsx'
export { Tooltip } from './mintlify/tooltip.tsx'
export { Update } from './mintlify/update.tsx'
export { View } from './mintlify/view.tsx'
export { Panel } from './mintlify/panel.tsx'
export { CodeCard, RequestExample, ResponseExample } from './mintlify/code-card.tsx'
export { Tree, TreeFolder, TreeFile } from './mintlify/tree.tsx'
export { Color, ColorRow, ColorItem } from './mintlify/color.tsx'
export { Visibility } from './mintlify/visibility.tsx'
export { Icon } from '../icon.tsx'
export { Logo } from '../layout/footer.tsx'
export { Tabs, Tab } from './mintlify/tabs.tsx'
export { Accordion, AccordionGroup } from './mintlify/accordion.tsx'
export { Mermaid } from './mintlify/mermaid.tsx'

export { Aside, FullWidth, Above, Hero } from './markers.tsx'

export {
  Callout,
  Note,
  Warning,
  Info,
  Tip,
  Check,
  Danger,
  type CalloutType,
  type CalloutProps,
} from './callout.tsx'

// `TableOfContentsPanel` lives in a sibling component file but is
// re-exported here for convenience so the MDX component map can import
// everything from one place.
export { TableOfContentsPanel } from '../toc-panel.tsx'
