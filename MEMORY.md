# MEMORY — Holocron session learnings

## Spiceflow loader data serialization

**Key insight:** Spiceflow loader data is serialized via the **RSC flight stream**,
not JSON. loaderData CAN contain:

- React JSX nodes / ReactElements
- `Date`, `Map`, `Set`, `BigInt`
- Server component output
- Client component references
- Promises (React suspends until resolved)

BUT: the loader payload is re-streamed on EVERY navigation. So minimize loader data
— put static data (navigation tree, config, tabs) in a shared client module that
the bundler caches forever. Put only PER-REQUEST state in the loader.

## Spiceflow loader TYPE INFERENCE GAP (important)

`.loader('/*', async () => {...})` correctly stores the return type in
`App['_types']['Metadata']['loaderData']` — the typed client router
(`createRouter<App>()` / `useLoaderData`) reads it perfectly.

HOWEVER, the SERVER page handler's `loaderData` arg is always typed as `{}`.
Spiceflow's `InlineHandler` type does not thread loader data into
`SpiceflowContext`. Workaround:

```tsx
.page('/*', async ({ loaderData: rawLoaderData }) => {
  const loaderData = rawLoaderData as unknown as HolocronLoaderData
  // ...use loaderData
})
```

This is a spiceflow improvement opportunity. File an issue if you hit it again.

## Spiceflow createRouter — TS2742 portability fix

`export const { router, ... } = createRouter<App>()` emits TS2742 on `router`
because its type references `import("history").To` via a pnpm-mangled path.

**Fix:** re-export `router` and `useRouterState` directly from `spiceflow/react`
(they are the same singletons createRouter returns internally). Only destructure
the App-typed hooks:

```tsx
import { createRouter, router, useRouterState } from 'spiceflow/react'
import type { HolocronApp } from './app-factory.tsx'
export { router, useRouterState }
const typed = createRouter<HolocronApp>()
export const useLoaderData = typed.useLoaderData
export const getLoaderData = typed.getLoaderData
export const href = typed.href
```

## Static data in shared client module pattern

`vite/src/data.ts` imports from `virtual:holocron-config` and exports
site-wide derived data (siteName, tabs, headerLinks, searchEntries,
navigation). Both server AND client code imports from data.ts:

- Server (app-factory.tsx) uses it for loader computations
- Client (markdown.tsx, toc-panel.tsx) imports it — Vite bundles into client chunk
- Browser caches the bundle forever → navigation tree NOT re-shipped per request

This is the right way to split "static config/nav" from "per-request dynamic state":

```diagram
static data → data.ts → client bundle (once, cached)
dynamic data → .loader('/*') → RSC flight (minimal, per-request)
```

## App type derivation

```tsx
// app-factory.tsx
export function createHolocronApp() { return new Spiceflow()... }
export type HolocronApp = ReturnType<typeof createHolocronApp>
```

The App type flows naturally into router.ts without needing virtual modules at
the type level — ReturnType of the factory preserves Spiceflow's `_types`
inference through the chained .loader/.page/.get calls.

## Holocron architecture (as of 2026-04-05 refactor)

- `vite/src/app-factory.tsx` — Spiceflow app factory. `.loader('/*')` returns
  minimal per-request data. `.page('/*')` parses MDX, renders sections/hero as
  server JSX, passes to `<EditorialPage/>`.
- `vite/src/router.ts` — `'use client'` module with `createRouter<HolocronApp>()`.
  Exports `useHolocronData = useLoaderData('/*')` convenience hook.
- `vite/src/data.ts` — shared static site data computed once at module load.
  Client-safe (only imports `virtual:holocron-config`, not `virtual:holocron-mdx`).
- `vite/src/components/markdown.tsx` — `'use client'` editorial UI. No more prop
  drilling. SideNav reads navigation from data.ts + currentPageHref from loader.
- `vite/src/components/toc-panel.tsx` — `headings` prop now optional, defaults
  to `useHolocronData().currentHeadings`.
- Virtual modules: `virtual:holocron-config` (config + nav tree, client-safe),
  `virtual:holocron-mdx` (keyed MDX strings, server-only).

## Loader data shape

`HolocronLoaderData` intentionally minimal — only per-request dynamic state:

```ts
type HolocronLoaderData = {
  currentPageHref: string | undefined
  currentPageTitle: string | undefined
  currentPageDescription: string | undefined
  currentHeadings: NavHeading[]
  ancestorGroupKeys: string[]
  activeTabHref: string | undefined
  notFoundPath: string | undefined
  headTitle: string
  headRobots: string | undefined
}
```

Per-request flight payload is ~500 bytes. Before the refactor it was multi-KB
(full activeGroups tree re-serialized every navigation).

## Package exports

`@holocron.so/vite/react` → router.ts (typed client hooks)
`@holocron.so/vite/data` → data.ts (static site data)

Users write custom MDX client components like this:

```tsx
'use client'
import { useHolocronData, href } from '@holocron.so/vite/react'
export function Breadcrumb() {
  const { currentPageHref, currentPageTitle } = useHolocronData()
  return <a href={href('/')}>Home</a>
}
```

## Dev rules

- Always read the full spiceflow README from
  `https://raw.githubusercontent.com/remorses/spiceflow/main/README.md` (root, not
  inside spiceflow/).
- After changing vite/src code, run `pnpm build` inside vite/ so example and
  integration tests pick up the new dist.
- Client components MUST NOT render `<p>` — use `<div>` to avoid hydration
  mismatches with safe-mdx's p→P mapping.
- kimaki tunnel wraps `pnpm dev` so the user can see it on Discord:
  `kimaki tunnel --kill -p 5173 -- pnpm dev`

## pnpm file: dependency stale after upstream edits

The `spiceflow` dep is a `file:/Users/morse/Documents/GitHub/spiceflow-rsc/spiceflow`
dependency. When spiceflow source is updated (e.g. new exported file like
`document-title.js` added), `pnpm install` does NOT re-copy unless the
`.pnpm/` store entry is removed first. Symptom: `ERR_MODULE_NOT_FOUND` for
a file that exists in the source dist but not in node_modules.

Fix:
```bash
rm -rf node_modules/.pnpm/spiceflow@file+..+spiceflow-rsc+spiceflow_<hash>
pnpm install
```

## Test checklist after loader refactor

1. `cd vite && pnpm build` — tsc clean
2. `cd example && pnpm dev` — home, subpages, 404 render correctly
3. Flight payload minimal — grep for `loaderData` in HTML response
4. Active-state highlighting on current page in sidebar
5. TOC expands ancestor groups for current page
6. Prerender step of `pnpm build` may hang (pre-existing, unrelated)

## Markdown vertical spacing — pure flex/grid gaps, no margin/padding

The editorial layout uses **flex and grid gaps exclusively** for vertical
rhythm between markdown elements. No `margin-top`, `padding-top`, or
`padding-bottom` anywhere on headings, paragraphs, lists, dividers, tables,
or section wrappers. First and last children automatically get zero edge
spacing from gap semantics — nothing to reset, nothing to override.

### Three gap tokens in `globals.css`

- `--prose-gap: 20px` — inside a section (between p, h1, h2, h3, code, list)
- `--section-gap: 48px` — between `##` sections (one per grid row)
- `--list-gap: 8px` — between `<li>` items

### Layout structure (sections-based path)

```
slot-page (flex flex-col gap-[--layout-gap])
└── grid [toc | content | sidebar]
    ├── TOC (col 1)
    └── sections wrapper
        flex flex-col gap-[--section-gap] (mobile)
        lg:grid lg:grid-cols-subgrid lg:col-[2/-1] lg:gap-y-[--section-gap] (desktop)
        └── per-section wrapper (flex flex-col gap-[--prose-gap] lg:contents)
            ├── slot-main (col 1, gridRow: i+1, flex flex-col gap-[--prose-gap])
            └── aside (col 2, gridRow: "r / span N", position: sticky)
```

**Why `lg:contents` per-section wrapper**: on mobile each section is a flex
column pairing content + aside with `--prose-gap` (tight coupling). On
desktop the wrapper becomes `display: contents` and its children flow into
the outer subgrid directly, where explicit `grid-row` controls placement.

### Section splitting happens at EVERY heading level

`groupBySections()` in `app-factory.tsx` splits on `node.type === 'heading'`
(any depth: #, ##, ###, ####, #####, ######). Every heading gets its own
grid row with `--section-gap` (48px) above it, making heading prominence
uniform regardless of hierarchy. Content below a heading (paragraphs, lists,
code, etc.) flows with the tighter `--prose-gap` (20px) inside that
heading's section.

Previously we only split at depth === 2 (##), which meant h3/h4 headings
were rendered inline within their parent section with only 20px above them.
Now every heading stands out with 48px breathing room.

### `<Aside full>` with explicit `grid-row` span (instead of merging)

Old approach: merged all content under `<Aside full>` into ONE section
(no `##` splitting) so the aside's sticky range covered everything. Problem:
inconsistent section-gap rhythm since sections disappeared inside the merge.

New approach: ALWAYS split at `##`, even inside full-aside ranges. Attach
the shared aside to the **last sub-section** of its range and set
`asideRowSpan = N` (sub-section count). Desktop renderer computes
`grid-row: ${row - span + 1} / span ${span}` so the aside cell spans all
sub-section rows. `position: sticky` inside this tall cell scrolls alongside
the whole range — stickiness is constrained by the cell's extent, not a
single row.

Mobile: aside attached to last sub-section stacks after all content in its
range (matching the old visual behavior).

### Invisible mdast nodes create empty sections (pitfall)

MDX frontmatter parses to a top-level `yaml` node. `groupBySections()` puts
ANY non-heading/non-aside/non-fullwidth node into `current.contentNodes`,
producing a ghost section at the top. Filter these in `buildSections`:

```ts
function isInvisibleNode(n): boolean {
  const t = n.type
  return t === 'yaml' || t === 'toml' || t === 'definition'
}
const children = root.children.filter((n) => !isInvisibleNode(n))
```

### Components stripped of Y-padding

- `.editorial-h1 / h2 / h3`: removed all `padding-top / padding-bottom`
- `<Divider>`: removed `padding: '24px 0'`
- `<Li>`: removed `padding-bottom: 8px`, kept `padding-left: 12px`
- `<List> / <OL>`: added `flex flex-col gap-(--list-gap)`
- `<ComparisonTable>`: removed `padding: '8px 0'`
- Aside panel: removed `my-2` / `lg:my-0`
- FullWidth section: removed `my-5`

### Verification tricks via DevTools / Playwriter

```js
// Each section has explicit grid-row
document.querySelectorAll('.slot-main').forEach(el => console.log(el.style.gridRow))
// Shared aside has "N / span M"
document.querySelector('[style*="span"]').style.gridRow
// Sticky aside stays pinned during scroll
getComputedStyle(aside).position === 'sticky'
// Container row-gap matches --section-gap
getComputedStyle(container).rowGap === '48px'
```
