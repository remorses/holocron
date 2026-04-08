# Mintlify MDX Components — Complete Reference

Source: https://www.mintlify.com/docs/components/index

This document lists every MDX component Mintlify supports, with their props and descriptions. Use this as the roadmap for Holocron's MDX component implementation.

## Implementation Status

Components already implemented in Holocron (`vite/src/components/markdown/mintlify/compat.tsx` and `index.tsx`) are marked with **[IMPLEMENTED]**.

---

## 1. Accordion / AccordionGroup

Expandable/collapsible content sections for progressive disclosure.

**[IMPLEMENTED]**

### `<Accordion>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `title` | `string` | Yes | — | Title in the accordion preview |
| `description` | `string` | No | — | Detail below the title in the preview |
| `defaultOpen` | `boolean` | No | `false` | Whether the accordion is open by default |
| `id` | `string` | No | — | Custom ID for anchor linking (defaults to `title`) |
| `icon` | `string` | No | — | Icon name (FA/Lucide/Tabler/URL/SVG) |
| `iconType` | `string` | No | — | FA icon style: `regular`, `solid`, `light`, `thin`, `sharp-solid`, `duotone`, `brands` |
| `children` | `ReactNode` | Yes | — | Content inside the accordion |

### `<AccordionGroup>`

Wraps multiple `<Accordion>` components. No props beyond `children`.

---

## 2. Badge

Inline status indicators, labels, or metadata.

**[IMPLEMENTED]**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `color` | `string` | No | `"gray"` | Color variant: `gray`, `blue`, `green`, `yellow`, `orange`, `red`, `purple`, `white`, `surface`, `white-destructive`, `surface-destructive` |
| `size` | `string` | No | `"md"` | Size: `xs`, `sm`, `md`, `lg` |
| `shape` | `string` | No | `"rounded"` | Shape: `rounded`, `pill` |
| `icon` | `string` | No | — | Icon name |
| `iconType` | `string` | No | — | FA icon style |
| `stroke` | `boolean` | No | `false` | Outline style instead of filled background |
| `disabled` | `boolean` | No | `false` | Disabled state with reduced opacity |
| `className` | `string` | No | — | Additional CSS classes |
| `children` | `ReactNode` | Yes | — | Badge text content |

---

## 3. Banner

Dismissible announcement banner at the top of every page. Configured via `docs.json` (NOT an MDX component).

**[IMPLEMENTED]** (as `SidebarBanner` — but note Mintlify's banner is site-wide, not sidebar-specific)

| Prop in docs.json | Type | Required | Default | Description |
|-------------------|------|----------|---------|-------------|
| `content` | `string` | Yes | — | Text with basic MDX formatting (links, bold, italic). Custom components NOT supported |
| `dismissible` | `boolean` | No | `false` | Whether users can dismiss the banner |

---

## 4. Callout (and variants: Note, Warning, Info, Tip, Check, Danger)

Highlighted boxes for important information, warnings, tips.

**[IMPLEMENTED]**

### `<Callout>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `icon` | `string` | No | — | Icon name |
| `iconType` | `string` | No | — | FA icon style |
| `color` | `string` | No | — | Custom color as hex (e.g. `#FFC107`). Sets border, background tint, and text |
| `children` | `ReactNode` | Yes | — | Callout content |

### Typed variants (preset icons + colors, only accept `children`)

- `<Note>` — info callout
- `<Warning>` — warning callout
- `<Info>` — important info callout
- `<Tip>` — tip/hint callout
- `<Check>` — success/checked callout
- `<Danger>` — danger callout

---

## 5. Card

Navigation/content card with optional icon, image, and link.

**[IMPLEMENTED]**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `title` | `string` | No | — | Card title |
| `icon` | `string` | No | — | Icon name |
| `iconType` | `string` | No | — | FA icon style |
| `color` | `string` | No | — | Icon color as hex |
| `href` | `string` | No | — | URL to navigate to on click |
| `horizontal` | `boolean` | No | — | Compact horizontal layout |
| `img` | `string` | No | — | URL/path to image displayed at top |
| `cta` | `string` | No | — | Custom call-to-action text |
| `arrow` | `boolean` | No | — | Show/hide link arrow icon |
| `children` | `ReactNode` | No | — | Card body content |

---

## 6. CodeGroup

Tabbed code block container for displaying multiple code examples.

**[IMPLEMENTED]** (via `mintlify/tabs.tsx` — CodeGroup uses same sync mechanism)

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `dropdown` | `boolean` | No | `false` | Show dropdown menu instead of tabs |
| `children` | `ReactNode` | Yes | — | Code blocks with title meta |

Code blocks inside use standard markdown fenced code with title metadata: ` ```javascript helloWorld.js `

---

## 7. CodeBlock

Programmatic React component for rendering code blocks (not MDX — for use in custom React components).

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `language` | `string` | No | — | Programming language for syntax highlighting |
| `filename` | `string` | No | — | Filename in code block header |
| `icon` | `string` | No | — | Icon in header |
| `lines` | `boolean` | No | — | Show line numbers |
| `wrap` | `boolean` | No | — | Wrap long lines |
| `expandable` | `boolean` | No | — | Allow expand/collapse |
| `highlight` | `string` | No | — | Lines to highlight, e.g. `"[1,3,4,5]"` |
| `focus` | `string` | No | — | Lines to focus, e.g. `"[1,3,4,5]"` |
| `children` | `string` | Yes | — | Code content |

---

## 8. Color / Color.Item / Color.Row

Display color swatches with hex values and click-to-copy.

**[IMPLEMENTED]**

### `<Color>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `variant` | `string` | Yes | — | Display style: `"compact"` or `"table"` |
| `children` | `Color.Item \| Color.Row` | Yes | — | Items or rows |

### `<Color.Row>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `title` | `string` | No | — | Row label |
| `children` | `Color.Item` | Yes | — | Color items |

### `<Color.Item>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | `string` | No | — | Color name/label |
| `value` | `string \| { light, dark }` | Yes | — | CSS color value, or `{light, dark}` for theme-aware colors |

---

## 9. Columns / Column

Responsive multi-column grid layout.

**[IMPLEMENTED]**

### `<Columns>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `cols` | `number` | No | `2` | Number of columns (1-4) |
| `children` | `ReactNode` | Yes | — | Column/Card content |

### `<Column>`

Wraps arbitrary content in a single column. No specific props beyond `children`.

---

## 10. Expandable

Toggle nested content (used inside `<ResponseField>` for nested object properties).

**[IMPLEMENTED]**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `title` | `string` | No | — | Label for the expandable toggle |
| `defaultOpen` | `boolean` | No | `false` | Whether open by default |
| `children` | `ReactNode` | Yes | — | Nested content (typically `<ResponseField>`) |

---

## 11. Fields / ParamField / ResponseField

API parameter and response field documentation.

**[IMPLEMENTED]**

### `<ParamField>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `path` / first positional | `string` | Yes | — | Parameter name (in body attribute: `query`, `path`, `body`, or `header` followed by name) |
| `type` | `string` | No | — | Expected type (`number`, `string`, `boolean`, `object`, `string[]`, etc.) |
| `required` | `boolean` | No | — | Mark as required |
| `deprecated` | `boolean` | No | — | Mark as deprecated |
| `default` | `any` | No | — | Default value |
| `placeholder` | `string` | No | — | Placeholder text for playground input |
| `children` | `string` | No | — | Description (Markdown-enabled) |

### `<ResponseField>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | `string` | Yes | — | Field name |
| `type` | `string` | Yes | — | Type (arbitrary string) |
| `default` | `string` | No | — | Default value |
| `required` | `boolean` | No | — | Mark as required |
| `deprecated` | `boolean` | No | — | Mark as deprecated |
| `pre` | `string[]` | No | — | Labels shown before field name |
| `post` | `string[]` | No | — | Labels shown after field name |
| `children` | `ReactNode` | No | — | Description/nested fields |

---

## 12. Frame

Wraps images/videos with styled borders, captions, hints.

**[IMPLEMENTED]**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `caption` | `string` | No | — | Text below content (supports markdown links/bold) |
| `hint` | `string` | No | — | Text above the frame |
| `children` | `ReactNode` | Yes | — | Image/video/content |

---

## 13. Icon

Inline icon from Font Awesome, Lucide, Tabler, or custom sources.

**[IMPLEMENTED]** (as `MintlifyIcon` and `Icon` in `icon.tsx`)

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `icon` | `string` | Yes | — | Icon name (FA/Lucide/Tabler/URL/path) |
| `iconType` | `string` | No | — | FA icon style: `regular`, `solid`, `light`, `thin`, `sharp-solid`, `duotone`, `brands` |
| `color` | `string` | No | — | Icon color as hex |
| `size` | `number` | No | — | Size in pixels |
| `className` | `string` | No | — | Custom CSS class |

---

## 14. Mermaid

Render Mermaid diagrams (flowcharts, sequence diagrams, etc.) from text definitions.

**[IMPLEMENTED]**

Rendered via fenced code block with `mermaid` language:

````
```mermaid
flowchart LR
    A --> B
```
````

Props (passed as code block metadata):

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `actions` | `boolean` | No | — | Show/hide interactive zoom/pan controls (default: show when height > 120px) |
| `placement` | `string` | No | `"bottom-right"` | Control position: `top-left`, `top-right`, `bottom-left`, `bottom-right` |

---

## 15. Panel

Customize the right sidebar content of a page. Replaces table of contents.

**[IMPLEMENTED]**

```mdx
<Panel>
  <Info>Pin info to the side panel.</Info>
</Panel>
```

No specific props documented — just `children`. If a `<Panel>` is present, any `<RequestExample>` and `<ResponseExample>` must be inside it.

---

## 16. Prompt

Display AI prompts with copy and Cursor integration buttons.

**[IMPLEMENTED]**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `description` | `string` | Yes | — | Text displayed in the prompt card (supports Markdown) |
| `children` | `string` | Yes | — | Full prompt text copied to clipboard / sent to Cursor |
| `actions` | `array` | No | `["copy"]` | Available actions: `"copy"`, `"cursor"` |
| `icon` | `string` | No | — | Icon name |
| `iconType` | `string` | No | — | FA icon style |

---

## 17. RequestExample / ResponseExample

Display code examples in the right sidebar panel (API documentation use case).

**[IMPLEMENTED]**

### `<RequestExample>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `dropdown` | `boolean` | No | — | Show dropdown instead of tabs for multiple code blocks |
| `children` | `ReactNode` | Yes | — | Code blocks with title meta |

### `<ResponseExample>`

Same props as `<RequestExample>`.

---

## 18. Steps / Step

Numbered step-by-step procedures.

**[IMPLEMENTED]**

### `<Steps>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `children` | `Step[]` | Yes | — | Step components |
| `titleSize` | `string` | No | `"p"` | Title size: `p`, `h2`, `h3`, `h4` |

### `<Step>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `title` | `string` | Yes | — | Step title |
| `children` | `ReactNode` | No | — | Step content |
| `icon` | `string` | No | — | Icon name |
| `iconType` | `string` | No | — | FA icon style |
| `stepNumber` | `number` | No | — | Override step number |
| `titleSize` | `string` | No | `"p"` | Title size: `p`, `h2`, `h3`, `h4` |
| `id` | `string` | No | — | Custom anchor ID |
| `noAnchor` | `boolean` | No | `false` | Hide anchor link for the step |

---

## 19. Tabs / Tab

Organize content into switchable tabbed panels. Synchronizes with matching CodeGroups/Tabs across the page.

**[IMPLEMENTED]**

### `<Tabs>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `defaultTabIndex` | `number` | No | `0` | Index of default active tab (zero-based) |
| `sync` | `boolean` | No | `true` | Synchronize selection with other tabs/code groups with matching titles |
| `borderBottom` | `boolean` | No | — | Add bottom border and padding |
| `children` | `Tab[]` | Yes | — | Tab components |

### `<Tab>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `title` | `string` | Yes | — | Tab title (used for sync matching) |
| `id` | `string` | No | — | Custom anchor ID (defaults to `title`) |
| `icon` | `string` | No | — | Icon name |
| `iconType` | `string` | No | — | FA icon style |
| `children` | `ReactNode` | Yes | — | Tab content |

---

## 20. Tile

Visual preview card with image thumbnail, title, and description in a grid layout.

**[IMPLEMENTED]**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `href` | `string` | Yes | — | URL to navigate to on click |
| `title` | `string` | No | — | Title below the preview |
| `description` | `string` | No | — | Short description |
| `children` | `ReactNode` | Yes | — | Preview area content (typically images/SVGs) |

---

## 21. Tooltip

Hover tooltip with contextual definition and optional CTA link.

**[IMPLEMENTED]**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `tip` | `string` | Yes | — | Tooltip text |
| `headline` | `string` | No | — | Text above the tip |
| `cta` | `string` | No | — | Call-to-action text |
| `href` | `string` | No | — | URL for CTA (required when using `cta`) |
| `children` | `ReactNode` | Yes | — | Inline text to attach tooltip to |

---

## 22. Tree / Tree.Folder / Tree.File

Hierarchical file/folder structure display with collapsible nodes.

**[IMPLEMENTED]** (as `Tree`, `TreeFolder`, `TreeFile`)

### `<Tree>`

Root container. No specific props.

### `<Tree.Folder>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | `string` | Yes | — | Folder name |
| `defaultOpen` | `boolean` | No | `false` | Whether expanded by default |
| `openable` | `boolean` | No | `true` | Whether folder can be opened/closed |
| `children` | `TreeNode[]` | No | — | Nested files and folders |

### `<Tree.File>`

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | `string` | Yes | — | File name |

---

## 23. Update

Changelog/release notes entry with date label and tag filters.

**[IMPLEMENTED]**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `label` | `string` | Yes | — | Update label (appears to the left, creates anchor link). Must be unique |
| `description` | `string` | No | — | Description below the label |
| `tags` | `string[]` | No | — | Tags shown as filters in the right side panel |
| `rss` | `object` | No | — | Custom RSS entry: `{ title?: string, description?: string }` |
| `children` | `ReactNode` | Yes | — | Update content (supports Markdown, components, etc.) |

---

## 24. View

Conditionally visible content panel synced with a multi-view dropdown (page-level context switcher for languages/frameworks).

**[IMPLEMENTED]**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `title` | `string` | Yes | — | View identifier (must match a dropdown option) |
| `icon` | `string` | No | — | Icon name (FA/Lucide/URL/path) |
| `iconType` | `string` | No | — | FA icon style |
| `children` | `ReactNode` | Yes | — | Content visible when this view is active |

Note: `<View>` is a page-level context switcher. Use `<Tabs>` for procedure differences and `<CodeGroup>` for code differences. One `<View>` per language per page.

---

## 25. Code Block Meta Options (not a component, but important MDX feature)

Fenced code blocks support these meta options after the language identifier:

| Option | Type | Description |
|--------|------|-------------|
| `title` | `string` | Filename/label for the code block |
| `icon` | `string` | Icon in code block header |
| `highlight` | `string` | Line numbers to highlight (e.g. `{1-2,5}`) |
| `focus` | `string` | Lines to focus (dims unhighlighted lines) |
| `lines` | `boolean` | Show line numbers |
| `wrap` | `boolean` | Enable text wrapping |
| `expandable` | `boolean` | Allow expand/collapse for long code |
| `twoslash` | `boolean` | Enable TypeScript hover type info |

Additionally, inline diff markers are supported: `// [!code ++]` and `// [!code --]`.

---

## Feature Comparison: Mintlify vs Holocron

Based on `vite/src/components/markdown/index.tsx` exports, here's the current implementation status:

| Mintlify Component | Holocron Export | Status |
|---|---|---|
| `<Accordion>` / `<AccordionGroup>` | `Accordion`, `AccordionGroup` | **Implemented** |
| `<Badge>` | `Badge` | **Implemented** |
| `<Banner>` | `SidebarBanner` (partial) | **Partial** — site-wide banner, not sidebar |
| `<Callout>` / `<Note>` / `<Warning>` / `<Info>` / `<Tip>` / `<Check>` / `<Danger>` | `Callout`, `Note`, `Warning`, `Info`, `Tip`, `Check`, `Danger` | **Implemented** |
| `<Card>` | `Card` | **Implemented** |
| `<CodeGroup>` | `Tabs`/`Tab` (shared sync) | **Implemented** (via shared tabs infrastructure) |
| `<CodeBlock>` | `CodeBlock` | **Implemented** |
| `<Color>` / `<Color.Row>` / `<Color.Item>` | `Color`, `ColorRow`, `ColorItem` | **Implemented** |
| `<Columns>` / `<Column>` | `Columns`, `Column` | **Implemented** |
| `<Expandable>` | `Expandable` | **Implemented** |
| `<ParamField>` | `ParamField` | **Implemented** |
| `<ResponseField>` | `ResponseField` | **Implemented** |
| `<Frame>` | `Frame` | **Implemented** |
| `<Icon>` | `MintlifyIcon`, `Icon` | **Implemented** |
| `<Mermaid>` | `Mermaid` | **Implemented** |
| `<Panel>` | `Panel` | **Implemented** |
| `<Prompt>` | `Prompt` | **Implemented** |
| `<RequestExample>` / `<ResponseExample>` | `RequestExample`, `ResponseExample` | **Implemented** |
| `<Steps>` / `<Step>` | `Steps`, `Step` | **Implemented** |
| `<Tabs>` / `<Tab>` | `Tabs`, `Tab` | **Implemented** |
| `<Tile>` | `Tile` | **Implemented** |
| `<Tooltip>` | `Tooltip` | **Implemented** |
| `<Tree>` / `<Tree.Folder>` / `<Tree.File>` | `Tree`, `TreeFolder`, `TreeFile` | **Implemented** |
| `<Update>` | `Update` | **Implemented** |
| `<View>` | `View` | **Implemented** |

All 25 Mintlify MDX component types are implemented in Holocron. 

---

## Props Completeness Audit

The following props may be missing or incomplete in Holocron's implementation. Check each component's source for details:

1. **Badge**: `size` (xs/sm/md/lg), `shape` (rounded/pill), `stroke`, `disabled`, `className` — verify all are handled
2. **Card**: `img`, `cta`, `arrow`, `horizontal` — verify all are handled
3. **Tab**: `id` for anchor linking, `icon` for tab icons — verify in sync context
4. **CodeGroup**: `dropdown` prop to switch from tabs to dropdown — verify support
5. **Steps**: `titleSize`, `icon`, `iconType`, `stepNumber`, `noAnchor` on `<Step>` — verify all
6. **Step**: `titleSize` prop on both `<Steps>` wrapper and individual `<Step>`
7. **Update**: `tags`, `rss` (object with `title` + `description`) — verify nested Expandable support
8. **Accordion**: `defaultOpen`, `id`, `icon`, `iconType` — verify anchor linking via URL hash
9. **RequestExample / ResponseExample**: `dropdown` prop — verify support
10. **View**: Page-level context synchronization with navigation dropdown — verify hookup