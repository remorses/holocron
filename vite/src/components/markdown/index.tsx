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
  Blockquote,
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
export { Badge } from './badge.tsx'
export { Card, CardGroup, Columns, Column } from './card.tsx'
export { Expandable } from './expandable.tsx'
export { Frame } from './frame.tsx'
export { Prompt } from './prompt.tsx'
export { ParamField, ResponseField } from './fields.tsx'
export { Steps, Step } from './steps.tsx'
export { Tile } from './tile.tsx'
export { Tooltip } from './tooltip.tsx'
export { Update } from './update.tsx'
export { View } from './view.tsx'
export { Panel } from './panel.tsx'
export { CodeCard, RequestExample, ResponseExample } from './code-card.tsx'
export { Tree, TreeFolder, TreeFile } from './tree.tsx'
export { Color, ColorRow, ColorItem } from './color.tsx'
export { Visibility } from './visibility.tsx'
export { Marquee } from './marquee.tsx'
export { Icon } from '../icon.tsx'
export { Logo } from '../layout/footer.tsx'
export { Tabs, Tab } from './tabs.tsx'
export { Accordion, AccordionGroup } from './accordion.tsx'
export { Mermaid } from './mermaid.tsx'

export { Aside, FullWidth, Above, Hero } from './markers.tsx'
export { VideoBackgroundShader } from './video-background-shader.tsx'

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
