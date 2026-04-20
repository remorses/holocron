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

export { SideNav } from './side-nav.tsx'
export { BackButton } from './back-button.tsx'
export { ExpandableContainer } from './expandable-container.tsx'
export { ChevronIcon, SearchIcon } from './icons.tsx'

export {
  Heading,
  SectionHeading,
  P,
  Caption,
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
export { PixelatedImage, LazyVideo, ChartPlaceholder } from './image.tsx'
export {
  ComparisonTable,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table.tsx'
export {
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
} from './mintlify/compat.tsx'
export { Icon } from '../icon.tsx'
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

export { SidebarBanner } from './sidebar-banner.tsx'
export { TabLink } from './tab-link.tsx'

export {
  EditorialPage,
  type EditorialSection,
} from './editorial-page.tsx'

// `TableOfContentsPanel` lives in a sibling component file but is
// re-exported here for convenience so the MDX component map can import
// everything from one place.
export { TableOfContentsPanel } from '../toc-panel.tsx'
