/**
 * Canonical list of top-level MDX component names supported by Holocron.
 *
 * This is the single source of truth shared between:
 * - sync.ts (build-time placeholder map for MDX validation)
 * - mdx-components-map.tsx (runtime component map for rendering)
 *
 * If you add a new MDX component, add its name here. TypeScript will error
 * in mdx-components-map.tsx if the runtime map is missing an entry, and
 * vice versa if the runtime map has a non-dotted key not listed here.
 *
 * Dotted sub-components (Tree.Folder, Color.Row, etc.) are registered
 * separately in the runtime map and don't need entries here.
 */
export const SAFE_MDX_COMPONENT_NAMES = [
  'p', 'Heading', 'a', 'code', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'ul', 'ol', 'li', 'Image', 'img', 'Bleed', 'Aside', 'FullWidth', 'Above', 'Hero',
  'Callout', 'Note', 'Warning', 'Info', 'Tip', 'Check', 'Danger', 'Tabs', 'Tab', 'Accordion',
  'AccordionGroup', 'Mermaid', 'Badge', 'Card', 'CardGroup', 'Columns', 'Column', 'Expandable',
  'Frame', 'Prompt', 'ParamField', 'ResponseField', 'Steps', 'Step', 'Tile', 'Tooltip', 'Update',
  'View', 'Panel', 'CodeCard', 'RequestExample', 'ResponseExample', 'Tree', 'Color', 'Icon',
  'Logo', 'Markdown', 'Visibility',
  'TableOfContentsPanel', 'HolocronAIAssistantWidget', 'HolocronPageNavRow', 'OpenAPIEndpoint',
] as const

export type SafeMdxComponentName = (typeof SAFE_MDX_COMPONENT_NAMES)[number]
