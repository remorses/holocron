/**
 * Public re-exports of all MDX components available in Holocron.
 *
 * Users can import these in their own `.tsx` / `.ts` component files:
 *
 * ```tsx
 * import { Card, CardGroup, Callout, Steps, Step } from '@holocron.so/vite/mdx'
 * ```
 *
 * These are the same components that Holocron auto-injects into MDX pages.
 * Importing them explicitly is useful when building custom components that
 * compose Holocron primitives.
 */
'use client'

// Callouts
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
} from './components/markdown/callout.tsx'

// Cards & layout
export { Card, CardGroup, Columns, Column } from './components/markdown/card.tsx'

// Accordion
export { Accordion, AccordionGroup } from './components/markdown/accordion.tsx'

// Tabs
export { Tabs, Tab } from './components/markdown/tabs.tsx'

// Steps
export { Steps, Step } from './components/markdown/steps.tsx'

// Code
export { CodeBlock } from './components/markdown/code-block.tsx'
export { CodeCard, RequestExample, ResponseExample } from './components/markdown/code-card.tsx'

// Fields
export { ParamField, ResponseField } from './components/markdown/fields.tsx'

// Media
export { Image } from './components/markdown/image.tsx'
export { Frame } from './components/markdown/frame.tsx'

// Content containers
export { Expandable } from './components/markdown/expandable.tsx'
export { Panel } from './components/markdown/panel.tsx'
export { Prompt } from './components/markdown/prompt.tsx'
export { Update } from './components/markdown/update.tsx'
export { View } from './components/markdown/view.tsx'
export { Tile } from './components/markdown/tile.tsx'

// Badges & tooltips
export { Badge } from './components/markdown/badge.tsx'
export { Tooltip } from './components/markdown/tooltip.tsx'

// Tree
export { Tree, TreeFolder, TreeFile } from './components/markdown/tree.tsx'

// Color
export { Color, ColorRow, ColorItem } from './components/markdown/color.tsx'

// Visibility
export { Visibility } from './components/markdown/visibility.tsx'

// Marquee
export { Marquee } from './components/markdown/marquee.tsx'

// Mermaid
export { Mermaid } from './components/markdown/mermaid.tsx'

// Icons
export { Icon } from './components/icon.tsx'

// Layout markers
export { Aside, FullWidth, Above, Hero } from './components/markdown/markers.tsx'

// Typography (useful for custom rendering)
export {
  Heading,
  SectionHeading,
  P,
  A,
  Code,
  type HeadingLevel,
} from './components/markdown/typography.tsx'

// Table
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './components/markdown/table.tsx'

// Block elements
export {
  Bleed,
  Blockquote,
  List,
  OL,
  Li,
} from './components/markdown/layout.tsx'
