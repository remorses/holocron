# Holocron

Drop-in Mintlify replacement as a Vite plugin. Users point their `vite.config.ts` at this plugin and get a full documentation site from MDX files + a `holocron.jsonc` (or `docs.json`) config file.

Read the spiceflow skill before editing any code in this package. Run `playwriter skill` or load the spiceflow skill to get the latest API reference.

## Config

Supports two config file names (first found wins):
- `holocron.jsonc` — our format (JSONC with comments)
- `docs.json` — Mintlify new format (direct compatibility)

**Schema**: the source of truth is `vite/src/schema.ts` — Zod schemas that describe the supported input shape. The JSON Schema at `vite/schema.json` is GENERATED from it via `pnpm -F @holocron.so/vite generate-schema` (runs automatically on build). Do not hand-edit `schema.json` — edit `src/schema.ts` and regenerate.

The schema follows the Mintlify docs.json shape (https://mintlify.com/docs.json) for the subset Holocron consumes. Unknown Mintlify fields pass through `.passthrough()` so users can paste a full docs.json without validation errors.

MVP subset we support: `name`, `logo`, `favicon`, `colors`, `navigation` (with `tabs`, `global.anchors`), `navbar` (with `links`, `primary`), `redirects`, `footer.socials`.

### How config maps to UI

- **`navbar.links`** → simple text links in the logo bar (top-right, next to logo)
- **`navigation.global.anchors`** → rendered as tabs in the tab bar (can be external URLs like GitHub, Changelog)
- **`navigation.tabs`** → also rendered as tabs; clicking switches the sidebar content
- **`navigation` groups** → sidebar sections with collapsible pages

## Navigation tree as cache

The navigation tree is the central data structure. It mirrors the docs.json shape exactly (tabs → groups → pages) but enriches page slug strings into `NavPage` objects with parsed metadata (title, headings, gitSha).

This enriched tree is written to `dist/holocron-cache.json` after each sync. On the next build, the cache is read back and pages with matching `gitSha` are reused without re-parsing. This makes builds as fast as possible — only changed MDX files get processed. On CI, caching `dist/` between runs gives near-instant rebuilds.

Types are intentionally kept close to docs.json to minimize transformations. Utility functions (`getTabs`, `getActiveGroups`, `findPage`, `buildSidebarTree`) take the tree directly as input.

## Styling

Prefer the existing shadcn-style token names (`--background`, `--foreground`, `--muted`, `--accent`, `--border`, etc.) over introducing parallel Fumadocs-style color variable namespaces. If a ported Fumadocs component needs local helpers or utilities, keep those minimal and map them onto the shared shadcn token layer instead of creating a second design system.

### CSS variables — add only if they deduplicate values

A CSS variable is only justified if it is **used in many places** and serves to deduplicate an otherwise-repeated hardcoded value. If a variable is referenced only once (or never), inline the value directly and delete the variable.

Rules:
- **Many call sites** → define a CSS var (e.g. `--text-primary` used in dozens of components, `--sticky-top` shared by sidebar + aside).
- **Single call site** → inline the value. A `--fade-top: 81px` that's only read by one `::before` rule should just be `top: 81px`.
- **Zero call sites** → delete immediately. Dead variables clutter `globals.css` and mislead future readers into thinking a token layer exists.

When auditing, grep the repo for `var(--name)` references plus Tailwind arbitrary-value patterns (`gap-(--name)`, `text-(color:--name)`, `[var(--name)]`). Remember that refs inside `/* ... */` CSS comments look live but aren't. See MEMORY.md ("CSS variable audit") for the grep commands and the last full audit.

CSS variables can also be used to change a color in dark/light mode. or change the value in desktop or mobile. for example we do this for negative margins in bleed images/code line numbers/lists. this use case is justified and desired.

## Architecture

- **Vite plugin** (`vite-plugin.ts`) — wraps spiceflowPlugin, tailwind, tsconfig-paths. Generates two virtual modules: `virtual:holocron-pages` (import.meta.glob for lazy MDX loading) and `virtual:holocron-config` (serialized config + navigation tree).
- **App entry** (`app.tsx`) — Spiceflow app that imports from virtual modules. Rendering logic is in `app-factory.tsx`.
- **Sync engine** (`lib/sync.ts`) — walks the config navigation, computes git blob SHAs, diffs against cache, parses only changed files.
- **Components** (`components/`) — editorial UI copied from `website/src/components/`. Same styles, same design tokens.

## Page layout — grid hierarchy

The editorial page layout is built from a minimal set of CSS Grids. Understand these before touching `EditorialPage` in `components/markdown.tsx`.

### Hierarchy diagram

```
slot-page (flex flex-col gap-(--layout-gap))
├── slot-navbar (logo + tab bar)
├── Hero mini-grid (3-col, only when hero prop is set)
│   └── hero content (col 2, aligned with page grid's content col)
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
- Column widths live only here: `--grid-toc-width` (210), `--grid-content-width` (520), `--grid-sidebar-width` (210), `--grid-gap` (50).
- `justify-between` distributes extra width up to `--grid-max-width` (1100px), so actual column gaps are `50px + distributed`.
- `gap-y-(--section-gap)` (48px) gives uniform rhythm between section rows.
- On mobile: collapses to `grid-cols-1`, sidebars go `display: none`, everything stacks.

**2. Inner per-section wrapper** (subgrid, `lg:col-[2/-1]`, one per section) — pairs content with its per-section aside.
- Spans both page-grid cols 2-3 via subgrid inheritance → content in inner-col 1 (page col 2), aside in inner-col 2 (page col 3).
- **Key responsibility: sticky scoping.** Per-section asides inside this wrapper have a containing block = this wrapper = one section's bounds. Scrolling past the section unsticks its aside before the next section's aside sticks. No overlap between asides.
- On mobile: becomes `flex flex-col gap-y-(--prose-gap)` → content + aside stack tightly (20px gap).

**3. Hero mini-grid** (only when `hero` prop is set) — replicates the page grid's 3-col definition explicitly to align hero content with the page grid's content column. Not a subgrid because hero lives OUTSIDE the page grid in DOM (sibling in the flex flow).

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

## MDX content loading

MDX files are loaded lazily via `import.meta.glob('?raw')`. Content stays on disk until a page is requested. At request time, the MDX is parsed with `safe-mdx`, split into sections, and rendered with the editorial components.

## HTML element nesting rules

**Never use `<p>` tags in components other than the `P` component itself** (the MDX `p` mapping in `app-factory.tsx`). In the editorial component system, `safe-mdx` wraps text children in paragraph nodes that map to `P`. If any other component (e.g. `Caption`, `Hero`, custom wrappers) also renders a `<p>`, the text inside it will get wrapped in another `P` → `<p>`, creating invalid `<p>` inside `<p>` nesting. This violates the HTML spec and causes React hydration mismatches.

Use `<div>` instead of `<p>` in all editorial components. Style it identically with inline styles — the visual output is the same, and `<div>` can nest any element without spec violations.

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


## spiceflow

holocron docs website generator uses spiceflow deeply. I am also the author of spiceflow so if there is any issues there and we need to change code there clearly say so and create a plan and present it to me. the spiceflow source code can be downloaded with chamber to be read, then you can use the kimaki cli to find the source code to modify after plan is approved


## integration tests and example

after you make changes to holocron vite you will have to run `pnpm build` again inside vite so that the example and integration tests can use the updated code from dist.
