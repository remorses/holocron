# Holocron

Drop-in Mintlify replacement as a Vite plugin. Users point their `vite.config.ts` at this plugin and get a full documentation site from MDX files + a `holocron.jsonc` (or `docs.json`) config file.

Read the spiceflow skill before editing any code in this package. Run `playwriter skill` or load the spiceflow skill to get the latest API reference.

Read the tailwind skill before adding JSX or updating JSX. Use Tailwind utilities for JSX styling by default instead of inline styles, unless the value must be dynamic at runtime.

Read the Emil design-engineering skill before adding or changing animations/transitions in this package: https://raw.githubusercontent.com/emilkowalski/skill/refs/heads/main/skills/emil-design-eng/SKILL.md

## Config

Supports two config file names (first found wins):

- `docs.json` (preferred)
- `holocron.jsonc`

both follow the same schema.

**Schema**: the source of truth is `vite/src/schema.ts` — Zod schemas that describe the supported input shape. The JSON Schema at `vite/schema.json` is GENERATED from it via `pnpm -F @holocron.so/vite generate-schema` (runs automatically on build). Do not hand-edit `schema.json` — edit `src/schema.ts` and regenerate.

The schema follows the Mintlify docs.json shape (https://mintlify.com/docs.json) for the subset Holocron consumes. Unknown Mintlify fields pass through `.passthrough()` so users can paste a full docs.json without validation errors.

## Mintlify

To read mintlify docs curl `https://www.mintlify.com/docs/llms-full.txt` into a file and grep it. notice this file is very large. this is useful to find out specific mintlify behaviour, supported components, etc

Fetch those docs every time we need to find out some info about Mintlify


### How config maps to UI

- **`navbar.links`** → simple text links in the logo bar (top-right, next to logo)
- **`navigation.global.anchors`** → rendered as tabs in the tab bar (can be external URLs like GitHub, Changelog)
- **`navigation.tabs`** → also rendered as tabs; clicking switches the sidebar content
- **`navigation.versions`** → native `<select>` dropdown in the header (right of logo). Each version wraps its own inner navigation (tabs/groups/pages). Selecting a version navigates to its first page; sidebar updates to show that version's groups. The version marked `default: true` determines the `/` redirect target.
- **`navigation.dropdowns`** → native `<select>` dropdown in the header (next to version select). Same as versions but can also be link-only (`href` without content → opens external URL). `navigation.products` is normalized into dropdowns at config time.
- **`navigation` groups** → sidebar sections with collapsible pages

### Switcher architecture (versions/dropdowns)

All version/dropdown inner tabs are flattened into the main `navigation.tabs` array so every page gets a route. But `buildTabItems()` in `data.ts` must **exclude** switcher-owned tabs from the header tab bar — the `<select>` dropdowns replace that role. Only anchors (global links) appear in the tab bar when switchers are active. The `switchers` metadata (enriched inner nav trees) is serialized alongside `config` and `navigation` in the `virtual:holocron-config` module.

## Navigation tree as cache

The navigation tree is the central data structure. It mirrors the docs.json shape exactly (tabs → groups → pages) but enriches page slug strings into `NavPage` objects with parsed metadata (title, headings, gitSha).

This enriched tree is written to `dist/holocron-cache.json` after each sync. On the next build, the cache is read back and pages with matching `gitSha` are reused without re-parsing. This makes builds as fast as possible — only changed MDX files get processed. On CI, caching `dist/` between runs gives near-instant rebuilds.

Types are intentionally kept close to docs.json to minimize transformations. Utility functions (`getTabs`, `getActiveGroups`, `findPage`, `buildSidebarTree`) take the tree directly as input.

## Styling

### CSS variable convention — shadcn superset

Holocron's CSS variables follow the **standard shadcn/ui v2 naming convention**. This means users who already have a shadcn theme can port it directly — just override `--foreground`, `--primary`, `--border`, `--muted-foreground`, etc. in their own CSS and holocron adapts.

The full shadcn token set is defined in `globals.css` `:root` with editorial defaults, and registered in `@theme inline` for Tailwind utility generation (`text-foreground`, `bg-primary`, `border-border`, etc.).

**Three layers of variables:**

1. **shadcn standard** — `--background`, `--foreground`, `--primary`, `--muted-foreground`, `--border`, `--accent`, `--sidebar-foreground`, `--sidebar-primary`, etc. Users override these to theme holocron.
2. **Holocron extras** — `--text-tertiary`, `--border-subtle`, `--divider`. Things shadcn doesn't cover. No prefix, same naming style.
3. **Semantic colors** — `--blue`, `--green`, `--yellow`, `--orange`, `--red`, `--purple`. Dark-mode-aware color tokens for callouts/badges. Use as `text-blue`, `bg-red/10`, `border-green/20` in Tailwind. Don't conflict with Tailwind's numbered palette (`text-blue-500`).

**Do NOT introduce prefixed variable namespaces** (no `--hc-*`, no `--fd-*`, no `--editorial-*`). Keep everything in the flat shadcn naming style. If a new variable is needed, pick a descriptive name that could plausibly be a shadcn extension.

### Monospaced text sizing — always slightly smaller than surrounding sans

Monospaced fonts (code, `font-mono`) appear visually larger than sans-serif at the same `font-size` because their characters are wider. When monospaced text sits alongside sans text (property names, type annotations, inline code in UI chrome), always set it to `~0.875em` so it feels optically matched. The CSS variable `--code-font-size` in `globals.css` is the single source of truth for this value. The `.inline-code` class in `editorial.css` uses it. For Tailwind contexts use `text-(length:--code-font-size)` on the `font-mono` element. Never leave `font-mono` at the same size as the surrounding sans text.

Note: Tailwind arbitrary value classes like `text-[length:var(--code-font-size)]` won't work in components compiled to `dist/` because Tailwind's JIT scanner doesn't see the source. For package components (OpenAPI renderer, etc.), use the plain CSS class `.code-font-size` defined in `editorial.css` instead.

### Spacing — prefer gap over margin/padding

Always use flexbox/grid `gap` classes for spacing between sibling elements. Never use `margin-top`, `margin-bottom`, `padding-top`, or `padding-bottom` to create space between items in a list or stack. Gap is simpler (no first/last-child overrides), composes better, and avoids margin collapse bugs. Use `py-*` only for internal padding within a single element (e.g. padding inside a card), not for spacing between siblings.

Any container-like MDX component (`Callout`, `Accordion`, `Expandable`, `Panel`, `Card`, `Frame`, `Prompt`, `Steps`, `Step`, lists, API fields/examples, tiles, tree wrappers, etc.) must own its inner vertical rhythm with `flex flex-col gap-(--prose-gap)` on the container body, using the `--prose-gap` CSS variable defined in `globals.css`. This keeps all containers aligned with the page's overall vertical rhythm. Do not use hardcoded gap values like `gap-3` or `gap-4` — always use `gap-(--prose-gap)` so spacing stays consistent when the token changes. Do not rely on paragraph margins inside containers — many editorial nodes render with margins stripped, so raw MDX children will visually collapse unless the container explicitly provides gap spacing.

When a container can receive arbitrary MDX children, also add `no-bleed` on that container/body so nested code blocks, lists, and images do not leak outside the card frame.

### CSS variables — add only if they deduplicate values

A CSS variable is only justified if it is **used in many places** and serves to deduplicate an otherwise-repeated hardcoded value. If a variable is referenced only once (or never), inline the value directly and delete the variable.

Rules:

- **Many call sites** → define a CSS var (e.g. `--foreground` used in dozens of components, `--sticky-top` shared by sidebar + aside).
- **Single call site** → inline the value. A `--fade-top: 81px` that's only read by one `::before` rule should just be `top: 81px`.
- **Zero call sites** → delete immediately. Dead variables clutter `globals.css` and mislead future readers into thinking a token layer exists.

When auditing, grep the repo for `var(--name)` references plus Tailwind arbitrary-value patterns (`gap-(--name)`, `text-(color:--name)`, `[var(--name)]`). Remember that refs inside `/* ... */` CSS comments look live but aren't. See MEMORY.md ("CSS variable audit") for the grep commands and the last full audit.

CSS variables can also be used to change a color in dark/light mode. or change the value in desktop or mobile. for example we do this for negative margins in bleed images/code line numbers/lists. this use case is justified and desired.

## CSS variables and colors principles

if possible add as few hard coded colors & values as possible. instead use opacity to create variations of colors for example to add a background to a callout you would only define the fg color and derive the bg and border from the fg one using opacity

you can change alpha with `<div class="bg-sky-500/10"></div>`

or in css with --alpha

```css
:root {
    --new-variable: --alpha(var(--color-gray-950) / 10%);
}
```

derive colors from existing tokens with `color-mix()` instead of hardcoding new shades:

```css
:root {
    /* 90% neutral-500 mixed with black → slightly darker muted text */
    --muted-foreground: color-mix(in srgb, var(--color-neutral-500) 90%, var(--color-black));

    /* 64% foreground mixed with sidebar bg → sidebar text that adapts to surface */
    --sidebar-foreground: color-mix(in srgb, var(--foreground) 64%, var(--sidebar));

    /* 98% background mixed with white → slightly lighter card surface */
    --card: color-mix(in srgb, var(--background) 98%, var(--color-white));
}
```

`--alpha()` and `color-mix()` both produce computed colors that auto-adapt in dark mode when their input tokens change. Prefer these over hardcoded hex/oklch values — one definition works for both modes.

prefer our own CSS variables over Tailwind's `dark:` variant. dark mode values should be changed using CSS variables instead of `dark:`

using something like

```css
@variant dark {
    /* shadcn/ui dark */
    --background: oklch(0.21 0.006 285.885);
}
```

you can also change variables based on breakpoints with

```css
@variant lg {
    --bleed: 32px;
}
```

### `currentColor` inside data-URI SVGs is always black

SVG icons rendered **inline** (as `<svg>` elements in the DOM) inherit `currentColor` from the parent's CSS `color` property — this is how our `<Icon>` component works and why icons respond to dark mode. But SVG used as a CSS `background-image` data URI (`url("data:image/svg+xml,...")`) does **NOT** inherit `currentColor`. The data-URI SVG is not part of the document tree, so `currentColor` resolves to black regardless of the parent's color. Always use inline SVG elements (not background-image) for icons or decorations that need to adapt to light/dark mode.

## Architecture

- **Vite plugin** (`vite-plugin.ts`) — wraps spiceflowPlugin, tailwind, tsconfig-paths. Generates two virtual modules: `virtual:holocron-pages` (import.meta.glob for lazy MDX loading) and `virtual:holocron-config` (serialized config + navigation tree).
- **App entry** (`app.tsx`) — Spiceflow app that imports from virtual modules. Rendering logic is in `app-factory.tsx`.
- **Sync engine** (`lib/sync.ts`) — walks the config navigation, computes git blob SHAs, diffs against cache, parses only changed files.
- **Components** (`components/`) — editorial UI copied from `website/src/components/`. Same styles, same design tokens.

## Important CSS variables — grid geometry

Source of truth: `vite/src/lib/sidebar-widths.ts` (`GRID_TOKENS` + `buildGridTokenStyle()`).

These 4 independent tokens control the 3-column page grid. They're injected as inline styles on `.slot-page` by `editorial-page.tsx`:

- **`--grid-max-width`** (1100px) — overall page cap, clamped to `100vw - 60px`
- **`--grid-nav-width`** (230px) — left TOC sidebar column
- **`--grid-sidebar-width`** (230px, 396px for OpenAPI) — right aside column
- **`--grid-gap`** (50px) — gap between the three columns

**Content width is derived, not configured.** It's emitted as a CSS `calc()`:

```
--grid-content-width = --grid-max-width - --grid-nav-width - --grid-sidebar-width - 2 * --grid-gap
```

This means bumping `--grid-max-width` automatically grows the content column, and widening `--grid-sidebar-width` (e.g. for OpenAPI pages with `RequestExample`/`ResponseExample`) shrinks content by the same amount. The page never jumps width when navigating between docs and API reference.

## Page layout — grid hierarchy

The editorial page layout is built from a minimal set of CSS Grids. Understand these before touching `EditorialPage` in `components/markdown.tsx`.

### Hierarchy diagram

```
slot-page (flex flex-col gap-(--layout-gap))
├── slot-navbar (logo + tab bar)
├── Above mini-grid (3-col, only when above prop is set)
│   └── above content (col 2, aligned with page grid's content col)
└── Page grid — the ONLY explicit 3-col grid
    grid-template-columns: 210px 520px 210px (toc, content, sidebar)
    gap-x: 50px, gap-y: 48px (--section-gap between rows)
    justify-between (distributes extra width)
    ├── .slot-sidebar-left         (col 1, row 1/span 100, sticky TOC)
    ├── Inner per-section wrapper  (subgrid, col-[2/-1], grid-row: 1)
    │   ├── slot-main              (col 1 = content, H1 + paragraphs + …)
    │   └── per-section aside      (col 2 = sidebar, sticky-scoped to wrapper)
    ├── Inner per-section wrapper  (subgrid, col-[2/-1], grid-row: 2)
    │   ├── slot-main
    │   └── per-section aside
    ├── Shared full aside          (col 3, grid-row: N / span M via CSS var)
    ├── Inner per-section wrapper  (subgrid, col-[2/-1], grid-row: 3)
    │   └── slot-main
    └── .slot-sidebar-right        (col 3, flat-layout only)
```

### Grids used and why

**1. Page grid** (`markdown.tsx` EditorialPage) — the only explicit 3-col grid. Defines column widths and is the single source of truth. Every other grid inherits from it.

- Column widths live only here: `--grid-nav-width` (210), `--grid-content-width` (520), `--grid-sidebar-width` (210), `--grid-gap` (50).
- `justify-between` distributes extra width up to `--grid-max-width` (1100px), so actual column gaps are `50px + distributed`.
- `gap-y-(--section-gap)` (48px) gives uniform rhythm between section rows.
- On mobile: collapses to `grid-cols-1`, sidebars go `display: none`, everything stacks.

**2. Inner per-section wrapper** (subgrid, `lg:col-[2/-1]`, one per section) — pairs content with its per-section aside.

- Spans both page-grid cols 2-3 via subgrid inheritance → content in inner-col 1 (page col 2), aside in inner-col 2 (page col 3).
- **Key responsibility: sticky scoping.** Per-section asides inside this wrapper have a containing block = this wrapper = one section's bounds. Scrolling past the section unsticks its aside before the next section's aside sticks. No overlap between asides.
- On mobile: becomes `flex flex-col gap-y-(--prose-gap)` → content + aside stack tightly (20px gap).

**3. Above mini-grid** (only when `above` prop is set) — replicates the page grid's 3-col definition explicitly to align above content with the page grid's content column. Not a subgrid because above lives OUTSIDE the page grid in DOM (sibling in the flex flow).

### Aside and Section Processing (`mdx-sections.ts`)

The markdown document is parsed into an AST and split into sections (`MdastSection`) at every heading level. This split dictates the CSS grid rows in the main content area.

There are three ways content can exist in the right sidebar:
1.  **Per-section `<Aside>`**: Sticky only for the bounds of its specific section (the content between two headings). Handled via CSS subgrid row spanning.
2.  **Shared `<Aside full>`**: Spans multiple sections. It is sticky for the section it is placed in, and all subsequent sections until the next `<Aside full>` or the end of the document. Handled by calculating the grid row span across multiple sub-sections.
3.  **AI Widget (`<SidebarAssistant>` via `HolocronAIAssistantWidget`)**: Acts exactly like an `<Aside full>` but must never overlap with another aside. To achieve this without complex React rendering logic, the widget is injected during AST processing (`buildSections`). If the first section has an `<Aside>`, the widget is prepended into its children (rendering as a flex column above it). If there are no asides in the first section, it is wrapped in an `<Aside full>` and inserted at the very top of the document.

### How the grids interact

**Column alignment contract.** Every grid in this page uses the same 3 column widths defined via CSS vars. Subgrids inherit tracks through `grid-cols-subgrid`. The hero mini-grid redeclares the column template explicitly.

**Gap inheritance chain** (column-gap, through subgrid):

```
Page grid:          50px (explicit --grid-gap)
  → Inner subgrid:  normal → inherits from page grid → 50px
```

Axis rule: use `gap-y-(--token)` on subgrid wrappers (not `gap-(--token)`) so the column-gap inherits and isn't clobbered.

**Row placement**. Each inner wrapper gets an explicit `style={{ gridRow: i + 1 }}`. Shared `<Aside full>` gets `style={{ '--shared-row': '${start} / span ${N}' }}` plus class `lg:[grid-row:var(--shared-row)]` — grid-row is ONLY read at lg, so on mobile the aside gets `grid-row: auto` and auto-places at the end of its range instead of forcing an implicit second column in grid-cols-1.

**Sticky scoping via containing blocks**. `position: sticky` is bounded by its grid cell:

- TOC sidebar → page grid cell at col 1, row 1/span 100 (whole page).
- Per-section aside → inner subgrid cell (one section).
- Shared `<Aside full>` → multi-row grid area via `grid-row: start / span N` (its range of sections).

**NEVER use `display: contents`** on a wrapper whose children need sticky scoping — it removes the wrapper from layout, so descendants inherit the grand-parent as their containing block, collapsing all sticky scopes together. This was the cause of a multi-aside overlap bug (see MEMORY.md).

### Responsive behavior

- **Mobile** (< lg / 1080px): page grid is `grid-cols-1`. All items stack in DOM order. Inner wrappers become flex-col (20px prose-gap between content + aside). Sidebars hidden. Shared aside auto-places at end of its range.
- **Desktop** (≥ lg): full 3-col grid. Subgrids inherit columns. Sticky asides scoped by containing block.

### Key design rules

1. **Page grid owns column widths.** No other grid re-declares them (except the hero mini-grid, deliberately).
2. **Use `gap-y-...` on subgrids**, never `gap-(--token)` (breaks column-gap inheritance).
3. **Never `display: contents` around sticky-scoped children.**
4. **Inline `gridRow` style applies at ALL breakpoints** — if you only want it at lg, use a CSS custom property + `lg:[grid-row:var(--x)]` class.
5. **Axis ownership**: page grid owns horizontal (via `--grid-*`); section rhythm owns vertical (via `--section-gap`, `--prose-gap`).

## MDX component imports

Users can import `.tsx/.ts/.jsx/.js` components in MDX files:

```mdx
import { Greeting } from '/snippets/greeting'
import { Badge } from '../components/badge'
```

Import detection is **MDX-driven**, not folder-based. There are no magic `snippets/` or `components/` directories. Any local file can be imported from any location; the system discovers imports by parsing the MDX AST.

### How it works (two-step resolution)

**Build time** (`sync.ts`): during `syncNavigation`, `processMdx` extracts raw import source strings from each MDX file using `safe-mdx`'s `extractImports()`. The raw sources (e.g. `/snippets/greeting`, `../components/badge`) are cached in `holocron-mdx.json` as `pageImportSources`. On every sync, even cache hits, these sources are re-resolved against the filesystem to produce `{ moduleKey, absPath }` tuples. This means newly-created files are picked up without re-parsing MDX.

**Render time** (`app-factory.tsx`): `safe-mdx`'s `resolveModules()` parses the same MDX, extracts imports, normalizes them to module keys, and looks them up in the `virtual:holocron-modules` lazy glob map. The keys in that map must exactly match what safe-mdx produces.

### What `/` means in imports

`/` always means project root from safe-mdx's perspective. It normalizes `/x` to `./x`. On the filesystem, we probe `pagesDir` first, then `projectRoot`:

- `pagesDir = root` (default): `/snippets/greeting` finds `./snippets/greeting.tsx`
- `pagesDir = ./pages/`: `/snippets/greeting` finds `./pages/snippets/greeting.tsx` first, falls back to `./snippets/greeting.tsx`

The module key is always `./snippets/greeting.tsx` regardless of `pagesDir`.

### Key constraint: module keys must match

The build-time resolver and safe-mdx's render-time resolver must produce identical keys. Absolute imports are normalized as `'.' + source + ext`. Relative imports are resolved from `pagesDirPrefix + slugDir`. If the keys diverge, the import silently fails at render time. See `resolveImportSources()` in `sync.ts` for the exact logic.

### HMR behavior

- MDX file edited (new import added): `syncNavigation` re-runs, discovers new import sources, `virtual:holocron-modules` is invalidated and rebuilt with the new entry.
- Importable file added/removed: HMR triggers re-sync so previously-unresolvable imports can now resolve (or vice versa).
- Importable file edited (content change): normal Vite HMR, the `import()` in the lazy map already points to it.

### Caching

Raw import source strings are cached in `holocron-mdx.json` alongside `pageIconRefs`. Resolution to actual file paths happens fresh on every sync (just `fs.existsSync` probing, very cheap). This avoids stale cache when files are created or deleted between builds.

## MDX content loading

MDX files are loaded lazily via `import.meta.glob('?raw')`. Content stays on disk until a page is requested. At request time, the MDX is parsed with `safe-mdx`, split into sections, and rendered with the editorial components.

## `useSyncExternalStore` — all callbacks must be stable references

Every argument passed to `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)` **must be a stable function reference**. If any callback is an inline arrow or a new closure on every render, React re-subscribes on every render — causing performance bugs and potential infinite loops.

**Rules:**
- Module-level functions are always stable (preferred for global stores like theme, first-paint guard).
- Inside hooks, wrap callbacks with `useCallback`. If the callback closes over a prop (like a selector), stash it in a `useRef` and read the ref inside a `useCallback(fn, [])` — this keeps the function identity stable while the selector stays fresh.
- **Never** pass inline arrows like `() => selector(store.getState())` or `() => 'light'` directly to `useSyncExternalStore`.

### Dark mode detection — hydration-safe pattern

Never use `useState` + `useEffect` + `MutationObserver` to track `<html class="dark">`. That pattern causes hydration mismatches because `useState(() => document.documentElement.classList.contains('dark'))` runs during SSR where `document` doesn't exist, and the initial client value may differ from the server.

Instead, use `useSyncExternalStore` with module-level stable callbacks:

```tsx
// Module-level — stable references, no re-subscription
function getIsDark(): boolean {
  return document.documentElement.classList.contains('dark')
}
const getServerIsDark = () => false

function subscribeTheme(cb: () => void) {
  const observer = new MutationObserver(cb)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

// Inside component
const isDark = useSyncExternalStore(subscribeTheme, getIsDark, getServerIsDark)
```

Server always returns `false` (light). React handles the mismatch gracefully during hydration. The MutationObserver fires `cb` on class changes, triggering a synchronous re-render.

## HTML element nesting rules

**Never use `<p>` tags in components other than the `P` component itself** (the MDX `p` mapping in `app-factory.tsx`). In the editorial component system, `safe-mdx` wraps text children in paragraph nodes that map to `P`. If any other component (e.g. `Caption`, `Above`, custom wrappers) also renders a `<p>`, the text inside it will get wrapped in another `P` → `<p>`, creating invalid `<p>` inside `<p>` nesting. This violates the HTML spec and causes React hydration mismatches.

Use `<div>` instead of `<p>` in all editorial components. Style it identically with inline styles — the visual output is the same, and `<div>` can nest any element without spec violations.

This rule is **not a concern** for container components that receive `{children}` from MDX (like `Callout`, `Accordion`, `Expandable`, `Panel`, `Card`, `Frame`, `Prompt`, `Badge`, `Steps`, `Update`, `View`, `Tile`, etc.). Those containers render `{children}` directly and `safe-mdx` handles wrapping text into `P` nodes. The rule only applies when a component **explicitly renders** a `<p>` tag in its own JSX — that `<p>` would nest inside the `P` that `safe-mdx` wraps around the component call, producing `<P><p>…</p></P>`. As long as all text in your component JSX uses `<div>` or `<span>` (never `<p>`), you're safe.

## Hydration debugging

When a page renders but client behavior is dead (tree rows do not collapse, search input does nothing, title does not update on navigation), debug hydration in this order:

1. **Check whether the client tree hydrated at all**
    - Use Playwriter in a wide viewport.
    - Inspect TOC DOM nodes for React markers like `__reactFiber*` / `__reactProps*`.
    - If they are missing, the issue is not the TOC logic; the client boundary never mounted.

2. **Check the browser resource graph**
    - Compare Holocron against a known-good Spiceflow app (the `playwriter/website` project is a good reference).
    - If the page never requests a `virtual:vite-rsc/client-package-proxy/...` module for Holocron components, the package client boundary is not being treated as package source.

3. **Common root causes for missing hydration in Holocron**
    - **Package externalization**: `@vitejs/plugin-rsc` must keep `@holocron.so/vite/...` subpaths inside the RSC transform pipeline.
        - Symptom: no React markers on the TOC DOM.
        - Fix area: `vite/src/vite-plugin.ts` client/ssr/rsc config, especially `resolve.noExternal`.
    - **Symlink resolution escaping `node_modules`**: when workspace symlinks are real-pathed, `@vitejs/plugin-rsc` may stop treating Holocron imports as package sources.
        - Symptom: server rendering works, but interactive collapse regresses.
        - Fix area: `resolve.preserveSymlinks`.
    - **Browser entry failing before startup**: if `spiceflow`'s browser entry never reaches `hydrateRoot`, the whole page stays static.
        - Symptom: no React markers, no client behavior, often with browser `unhandledrejection` errors.
        - Fix area: dep optimization for wrapper-package transitive deps.

4. **Specific error messages and likely causes**
    - `SyntaxError: ... prism.js does not provide an export named 'default'`
        - Cause: browser package client chunk imported `prismjs` with default-import interop that only worked on the server side.
        - Fix area: `vite/src/components/markdown.tsx` Prism import shape.
    - `Error: Calling require for "scheduler" in an environment that doesn't expose the require function`
        - Cause: the browser dep optimizer left a raw `require("scheduler")` path in the React DOM client graph.
        - Fix area: wrapper-package client optimize deps and resolution/aliasing for `scheduler`.
    - `ReferenceError: module is not defined` from `@vitejs/plugin-rsc/dist/vendor/react-server-dom/...`
        - Cause: the vendored browser client path is reaching the browser as raw CommonJS instead of going through the correct optimized package chain.
        - Fix area: ensure the browser client dep graph is optimized through the wrapper package path, not only from the app root.
    - `Failed to resolve dependency: @holocron.so/vite > spiceflow > @vitejs/plugin-rsc/vendor/react-server-dom/client.browser`
        - Cause: Vite cannot resolve that exact nested include from the app root even though the runtime graph may still work.
        - Treat as a signal while debugging, not automatically as the root bug.

5. **Title debugging**
    - If `document.title` is empty but server markup looks correct, inspect the serialized flight payload and confirm `root.head` contains a real `<title>` tag.
    - The stable fix was to derive `head` and `title` from the actual page/layout tree (`getHeadSnapshot`) on the server, then sync `document.title` from that payload on the client.

6. **Best comparison target**
    - The extracted editorial UI originally worked in `playwriter/website`.
    - When Hydration breaks in Holocron, compare:
        - loaded browser resources
        - presence of `client-package-proxy` requests
        - React markers on TOC DOM
        - startup browser errors / unhandled rejections

## Deployments

**Always deploy preview first, then production.** Never go straight to production.

```bash
# 1. Deploy preview (runs migration + build + deploy)
pnpm --dir website deploy

# 2. Verify preview works (load the page, check logs)

# 3. Deploy production (runs migration + build + deploy)
pnpm --dir website deploy:prod
```

If the preview migration or deploy fails, **stop**. Do not continue to production.

The `deploy` and `deploy:prod` scripts run the D1 migration before building and deploying. If migration fails, the `&&` chain stops and the deploy never happens.

## Secrets management — always use sigillo

All secrets must be managed through **sigillo**. Never hardcode secrets, never read `.env` files directly. Load the `sigillo` skill before any secrets-related work. Run apps with `sigillo run -- pnpm dev` to inject secrets as env vars. Never read secret values into agent context.

## spiceflow

holocron docs website generator uses spiceflow deeply. I am also the author of spiceflow so if there is any issues there and we need to change code there clearly say so and create a plan and present it to me. the spiceflow source code can be downloaded with chamber to be read, then you can use the kimaki cli to find the source code to modify after plan is approved

## integration tests and example

after you make changes to holocron vite you will have to run `pnpm build` again inside vite so that the example and integration tests can use the updated code from dist.

### integration-tests fixture architecture

The `integration-tests/` package is organized as a set of **fixtures**, one per configuration shape. Each fixture is a self-contained mini-site with its own `holocron.jsonc` (or `docs.json`) + `pages/`, and its own matching test directory. Each fixture exercises a different permutation of Holocron config fields so we can cover every config shape a user might actually write.

```
integration-tests/
├── fixtures/
│   ├── basic/                # navigation: [{group, pages}] shorthand
│   │   ├── holocron.jsonc
│   │   └── pages/*.mdx
│   ├── tabs/                 # navigation.tabs with groups + external link tabs
│   │   ├── holocron.jsonc
│   │   └── pages/*.mdx
│   └── <name>/               # one folder per config variation
├── e2e/
│   ├── basic/                # tests for the basic fixture
│   │   ├── basic.test.ts
│   │   └── config-hmr.test.ts
│   └── tabs/                 # tests for the tabs fixture
│       └── tabs.test.ts
├── scripts/
│   ├── fixtures.ts           # discovers fixtures/* subdirs with a config file
│   └── build-fixtures.ts     # runs `vite build` once per fixture
├── vite.config.ts            # shared by every fixture
└── playwright.config.ts      # one webServer + one project per fixture
```

**How it works**: `scripts/fixtures.ts` walks `fixtures/` and returns every subdirectory containing a `holocron.jsonc` or `docs.json`. `playwright.config.ts` allocates one free port per fixture (persisted via `E2E_PORT_<NAME>` env vars so re-imports get stable ports), then spawns one webServer per fixture (via `vite <fixtureRoot> --config vite.config.ts --port <N>` in dev, or `node <fixtureRoot>/dist/rsc/index.js` in build mode) and one Playwright project per fixture with `testDir: e2e/<name>` and `use.baseURL: http://localhost:<N>`.

Tests use Playwright's `request` fixture (not raw `fetch()`) so per-project `baseURL` is picked up automatically.

**When you hit a config bug — add a fixture**: if a user reports that some combination of `navigation`, `navbar`, `anchors`, `redirects`, `footer.socials`, `logo`, or any other config fields misbehaves, add a new fixture under `fixtures/<descriptive-name>/` with the minimal reproduction config + MDX pages, add a matching `e2e/<name>/<name>.test.ts`, reproduce the bug as a failing test, then fix the bug in `vite/src/`.

**Adding a fixture, step by step**:

1. Create `fixtures/<name>/holocron.jsonc` (or `docs.json`)
2. Create `fixtures/<name>/pages/*.mdx` with whatever pages the config references
3. Create `e2e/<name>/<name>.test.ts` with assertions on the rendered output
4. Done — `playwright.config.ts` discovers the fixture automatically. No other changes needed.

**Running tests**:

- `pnpm test-e2e` — runs every fixture in dev mode (one Vite server per fixture)
- `pnpm test-e2e-start` — builds every fixture, runs every fixture in prod mode
- `pnpm test-e2e --project=<name>` — runs one specific fixture

**Playwright waits**: avoid fixed sleeps like `page.waitForTimeout(2000)` in integration tests. Prefer condition-based waits such as `expect(...).toBeVisible()`, `page.waitForLoadState('networkidle')`, `expect.poll(...)`, or a concrete DOM/state change tied to the behavior under test.

After changing `vite/src/` you must run `pnpm build` in the `vite/` package before re-running integration tests.

## takumi

takumi is the library used to generate images for example for og images

if needed read docs with `curl https://takumi.kane.tw/llms-full.txt`


## testing remark plugins

remark plugins are very useful to change the AST of the mdx, for example to convert <img> tags into our own image component with support for placeholder and static non layout shift size props.

another use case is to add a compat layer to support Mintlify patterns

to test remark plugins use vitest tests with inline snapshots, input is mdx string and output should be mdx string too. see existing tests for examples

## mdxJsxFlowElement vs mdxJsxTextElement (remark plugin pitfall)

MDX has two JSX node types in the mdast tree:

- **`mdxJsxFlowElement`** — block-level. The MDX parser wraps bare text children in `<p>` nodes. Use for containers (AccordionGroup, Tabs, Aside, …).
- **`mdxJsxTextElement`** — inline/phrasing-level. Text children stay inline with no `<p>` wrapping. Use for leaf wrappers whose children are purely inline (Heading, Badge, …).

**Problem with flow elements for headings:** safe-mdx's P component adds `editorial-prose` class + `opacity: 0.82` to paragraph children. If a heading is a flow element, its text gets wrapped in P, making heading text look like body text.

**Solution — three-part fix:**

1. **Remark plugin** (`remark-headings.ts`): emit `<Heading>` as `mdxJsxTextElement` via `createElement({ type: 'text' })`. This keeps heading text inline in the AST.

2. **Serialization** (`normalize-mdx.ts`): text elements at root level get serialized inline (no newlines), which breaks re-parsing when adjacent to flow siblings. Add `remarkMarkAndUnravel` (from safe-mdx) + `remarkPromoteRootTextElements` to the normalize pipeline. These promote standalone text elements to flow BEFORE serialization, so the output has proper block-level formatting.

3. **Rendering** (`mdx-components-map.tsx`): even after promotion to flow, the MDX parser wraps flow element text in paragraph nodes (`[paragraph → [text]]`). The `renderNode` callback intercepts `<Heading>` flow elements and **unwraps** paragraph children before passing them to `SectionHeading`.

**Key insight:** `remarkMarkAndUnravel` (from `safe-mdx/parse`) promotes `mdxJsxTextElement` nodes to `mdxJsxFlowElement` when they're alone in a paragraph. It only changes the node `type` — it does NOT wrap the phrasing children in a paragraph node. This means single-line `<Note>text</Note>` ends up with bare phrasing children `[text]` while multi-line `<Note>\ntext\n</Note>` gets `[paragraph → [text]]` from the parser. The two forms render differently.

**Important:** in `normalizeMdx`, `remarkMarkAndUnravel` runs AFTER serialization — the serialized string keeps text elements inline (avoiding `mdxToMarkdown`'s blank-line corruption), while the returned mdast tree has promoted flow elements for heading extraction and section splitting.

**Flow elements always get `<p>` wrappers on their text children.** The MDX parser wraps bare text inside any `mdxJsxFlowElement` in paragraph nodes — this is part of the content model, not a bug. So even after `remarkMarkAndUnravel` promotes a text element to flow, the text inside `<Heading>Getting Started</Heading>` becomes `[paragraph → [text "Getting Started"]]` in the parsed tree. `remarkMarkAndUnravel` only removes paragraphs that **wrap** JSX text elements (paragraph → [mdxJsxTextElement]) — it does NOT touch paragraphs **inside** a flow element's children (those contain plain `text` nodes, not JSX elements). Any `renderNode` handler for a flow element whose children should be inline must unwrap these paragraphs manually.

### MDX authoring rule: always use multi-line form for container components

When writing MDX content inside container components (Callout, Note, Warning, Info, Tip, Check, Danger, Aside, Accordion, Steps, Card, Expandable, Panel, Frame, Prompt, etc.), **always put content on its own line** with a newline after the opening tag and before the closing tag:

```mdx
<!-- ✅ CORRECT — parser creates proper paragraph children -->
<Note>
Use `Note` for neutral supporting information.
</Note>

<!-- ❌ WRONG — phrasing children without paragraph wrapper -->
<Note>Use `Note` for neutral supporting information.</Note>
```

Single-line form produces bare phrasing children (no `<P>` wrapper, no `editorial-prose` styling). Multi-line form gets proper paragraph wrapping from the MDX parser. This is a parser-level limitation — the two forms produce different ASTs.
