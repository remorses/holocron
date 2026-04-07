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

## Loader-backed site data

For the source-driven docs runtime, `data.ts` should read from the root loader instead of importing a separate static site module. Spiceflow's loader store is accessible both via hooks and `getLoaderData()` at module scope, so global reads still work even when the site object is request-scoped.

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

## CSS variable audit — which tokens are actually used (2026-04-05)

All CSS vars live in `vite/src/styles/globals.css` (+ Prism dark overrides in
`editorial-prism.css`). After a full audit of JSX/CSS references across
`vite/src/`, ~40 tokens are defined but never referenced.

### Definitely removable (zero references anywhere)

- `--toc-left` — leftover TOC offset, replaced by grid geometry
- `--fade-top`, `--fade-height`, `--fade-0` … `--fade-12` (15 tokens) — the
  `.slot-page::before` fade gradient block in `editorial.css` is commented out
- `--spacing-xxs` … `--spacing-xxl` (7 tokens) — Tailwind's `p-4`/`gap-6`
  spacing utilities handle all spacing; these custom tokens were never wired up
- `--transition-hover` — components use `transition-colors duration-150` instead
- `--duration-snappy`, `--ease-snappy`, `--duration-swift`, `--ease-swift`,
  `--duration-smooth`, `--ease-smooth` (6 tokens) — no custom cubic-beziers used
- `--logo-color` — logo now just uses `var(--foreground)` directly in CSS,
  the indirection is unused
- `--brand-secondary` — only `--brand-primary` is consumed (by toc-panel)
- `--overlay-filter`, `--overlay-bg`, `--overlay-shadow` — no glass overlay
- `--font-secondary` (Newsreader serif) — never applied
- `--weight-bold` — only prose/heading/regular weights are used
- `--radius-lg`, `--radius-sm` — only `--radius-md` is referenced (scrollbars)

### Shadcn tokens with no consumers (present via @theme inline)

These color tokens exist in `:root` + their `--color-*` twins in `@theme
inline`, but nothing in the editorial system actually uses them: `--card`,
`--card-foreground`, `--popover`, `--popover-foreground`, `--primary`,
`--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`,
`--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`,
`--destructive-foreground`, `--input`, `--chart-1` … `--chart-5`.

The Holocron repo has **no `components/ui/` folder** and no shadcn primitives.
These tokens are dead unless a user MDX file references tailwind classes like
`bg-card`. Keep as an opt-in safety net OR drop for a leaner editorial-only
token set.

### Actually used shadcn tokens (keep)

`--background`, `--foreground`, `--border`, `--ring`, `--radius` (via
`--radius-md`). The `@apply border-border outline-ring/50` + `@apply
bg-background text-foreground` in `@layer base` relies on these.

### Editorial palette (all used)

`--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-muted`,
`--text-hover`, `--text-tree-label`, `--page-border`, `--divider`,
`--border-subtle`, `--code-line-nr`, `--selection-bg`, all `--sidebar-*`
tokens, `--btn-bg`, `--btn-shadow`, `--link-accent`, `--brand-primary`.

### How to audit CSS var usage

Use `grep` (rg has a quirk where `-oh "var\(--..."` triggers help output — 
unknown why, possibly the `--` in the regex interacts with arg parsing):

```bash
# extract all var() references
grep -rho "var(--[a-zA-Z0-9-]*" vite/src --include="*.tsx" --include="*.css" | sort -u

# extract tailwind arbitrary-value var refs like gap-(--x) or text-(color:--x)
grep -rho "[a-z]*-(--[a-zA-Z0-9-]*" vite/src --include="*.tsx" --include="*.css" | sort -u
grep -rho ":--[a-zA-Z0-9-]*" vite/src --include="*.tsx" --include="*.css" | sort -u
```

Then diff against the `--xxx:` definitions in `globals.css`.

### Pitfall — commented-out CSS still matches grep

The `.slot-page::before` fade gradient in `editorial.css` is wrapped in
`/* ... */`. `grep` finds the var refs inside the comment, so a "used"
variable may actually be dead. Always open the file and check context
before assuming a var is live.

## Zod v4 `z.toJSONSchema()` gotchas + config schema source-of-truth pattern

**File**: `vite/src/schema.ts` (Zod schemas) →
`vite/scripts/generate-schema.ts` (generator) →
`vite/schema.json` (generated, 641 lines covering MVP subset of Mintlify
docs.json).

### Key Zod v4 quirks when generating draft-07 JSON Schema

1. **`reused: 'ref'` auto-names every reused subschema** as
   `__schema0`, `__schema1`, ... Use `reused: 'inline'` and rely on
   explicit `.meta({ id: 'X' })` + `metadata: z.globalRegistry` to
   extract ONLY the named schemas into `definitions/`.

2. **`.optional()` on a schema with `id` creates `allOf: [{ $ref }]`
   wrapper**. JSON Schema forbids siblings next to `$ref`, so Zod wraps
   in allOf when the optional wrapper wants to add anything. Post-process
   to unwrap: if node has only `allOf` with 1 item and no other keys,
   replace node with that item.

3. **Zod writes `id` field INSIDE each definition** (duplicate of the
   definitions/ key). Strip it in post-processing.

4. **`z.record(z.enum([...]), z.string())` creates EXHAUSTIVE record** —
   every enum key becomes REQUIRED in JSON Schema output. Use
   `z.partialRecord(z.enum([...]), z.string())` for optional keys.
   Needed for things like `footer.socials` where users pick any subset
   of platforms.

5. **draft-07 uses `definitions/`, draft-2020-12 uses `$defs/`**. Set
   `target: 'draft-7'` to keep the classic naming.

6. **Descriptions with `dedent`**: `.describe(dedent\`...\`)` gets
   preserved in the JSON Schema output with literal `\n` line breaks.
   IDE tooltips render them correctly. Keep description source lines
   ≤ 100 chars per rule.

### Post-processing shape (`scripts/generate-schema.ts`)

```ts
const clean = (node) => {
  if (Array.isArray(node)) return node.map(clean)
  if (!node || typeof node !== 'object') return node
  // Unwrap allOf: [{ $ref }] when it's the only key
  if (Array.isArray(node.allOf) && node.allOf.length === 1 &&
      Object.keys(node).length === 1) return clean(node.allOf[0])
  // Strip duplicate id
  const result = {}
  for (const [k, v] of Object.entries(node)) {
    if (k !== 'id') result[k] = clean(v)
  }
  return result
}
```

### Source-of-truth pattern for config types

- **Zod schemas in `schema.ts`** = single source of truth for INPUT shape
- **`HolocronConfigRaw = z.input<typeof holocronConfigSchema>`** for the
  raw user-written shape (before normalize())
- **Normalized types in `config.ts` DERIVE from Zod via `z.output<>`**
  where shapes overlap (`ConfigAnchor`, `ConfigNavGroup`,
  `ConfigNavPageEntry`, colors, redirects, footer.socials)
- **Wrapper types stay hand-written** for fields where `normalize()`
  collapses unions (`logo`, `favicon`, `navigation`, `navbar`, `ConfigNavTab`)

### Type derivation pitfall — hand-written types can silently lie

Before this refactor, `ConfigAnchor.icon` was typed `string | undefined`
but `normalize()` never transformed it — so at runtime, `icon` could be
`{ name, style?, library? }`. Deriving from Zod exposed the truth and
broke `sync.ts` which assigned `configGroup.icon` to `NavGroup.icon: string
| undefined`. Fix was to add an `iconToString()` helper at the
enrichment boundary that extracts `.name` from icon objects. Always
derive from the validation source rather than hand-writing narrower
types — the compiler will surface all the places that need adapters.

### Regen-check test pattern (catches out-of-sync schema.json)

Add a vitest test that calls `z.toJSONSchema()` + clean() and compares
to `fs.readFileSync('schema.json', 'utf-8')`. Fails CI if someone edits
`schema.ts` but forgets `pnpm generate-schema`. See `src/schema.test.ts`.

### AJV `validateSchema()` to confirm draft-07 compliance

```ts
const ajv = new Ajv({ allErrors: true, strict: false })
ajv.validateSchema(schema)  // returns true if valid
```

Also `npx ajv-cli@5 validate -s schema.json -d config.jsonc
--strict=false` validates real user configs against generated schema.

## Styling discipline — Tailwind tokens over CSS vars, and "positioning-only" primitives

Two lessons from the Aside/Callout component planning (2026-04-05):

### Do NOT invent `--callout-*-bg` / `--callout-*-border` / `--callout-*-fg` vars per variant

When adding a new visual-variant component (e.g. Callout with note/warning/info/
tip/check/danger types), the reflex is to declare N×3 CSS vars in `globals.css`
and reference them from the component. **Don't.** The user wants:

- Use **Tailwind / shadcn tokens** that already exist (`bg-muted`,
  `border-border`, `text-muted-foreground`, `bg-(color:--destructive)`, etc.).
- Where Tailwind doesn't have a semantic color for the variant, put the
  variant-color map **inline in the component** (small TS object of
  `{ bg, border, fg }` per type) — NOT as new CSS vars.
- Do NOT proliferate `globals.css` with per-component tokens. CSS vars are
  only justified when they deduplicate a value used in many places (see the
  "CSS variable audit" section above).

Rule of thumb: if a color is only referenced from ONE component file, keep it
in that file. Promote to a CSS var only when a second consumer appears.

### Aside is a positioning-only primitive — no visual styles

The `<Aside>` MDX marker component (`markdown.tsx`) is NOT a styled card. It's
a positioning primitive: on desktop, extract children into the right grid column
with sticky positioning; on mobile, stack inline at end of section. That's it.

Anti-pattern: decorating the Aside wrapper with `p-3 border border-subtle
rounded text-muted-foreground` — this double-frames any Callout/card component
placed inside it and couples visual presentation to positioning.

Correct split:
- **Aside** = positioning + a subtle `bg-muted` tint to visually group the
  right column. No padding, no border, no text-color, no font-size overrides.
- **Callout** = the framed card primitive (padding, border, rounded, color
  variant). Nests cleanly inside Aside with no double borders because Aside
  has no border of its own.

If plain text in an Aside looks raw against the tint, wrap it in a `<Callout>`.
Don't add padding back to Aside.

### Mintlify Callout API — shape reference

For compatibility with Mintlify docs.json users, the Callout component should
accept:

- `children: ReactNode`
- `icon?: ReactNode | string` (ReactNode = inline svg; string = URL/path or
  icon-library name; bare icon-library names can be ignored unless a lucide/
  FA dep is added)
- `iconType?: 'regular' | 'solid' | 'light' | 'thin' | 'sharp-solid' | 'duotone' | 'brands'`
  (FontAwesome style, accepted for API parity, no-op without FA)
- `color?: string` (hex, drives bg tint + border + icon color via alpha blending)
- Plus typed aliases: `Note`, `Warning`, `Info`, `Tip`, `Check`, `Danger`
  (each just a `<Callout type="...">` wrapper with preset color + icon).

All must be registered in `app-factory.tsx`'s `mdxComponents` map so MDX pages
can use them directly.

### Example dev server runs on Vite's default 5173, NOT 3000

The `example/` workspace runs `vite dev` with no custom port config. It binds
to **5173** by default. When starting the tunnel, use `-p 5173`:

```bash
tmux send-keys -t holocron-dev "kimaki tunnel --kill -p 5173 -- pnpm -F example dev" Enter
```

Using `-p 3000` makes the tunnel wait forever on port 3000 while Vite sits
on 5173 — tunnel never connects. Always double-check `package.json`'s
`dev` script and the Vite output line (`Local: http://localhost:XXXX/`)
before picking the tunnel port.

### Verify visual components in both light AND dark mode

When adding any styled component (Callout, Aside, cards, etc.) to Holocron,
always verify rendering in both color schemes before calling it done. The
Holocron theme switches automatically via `@media (prefers-color-scheme: dark)`.
The user's system may be in either mode, so a single screenshot covers only
one branch.

Playwriter pattern:

```js
// current system scheme
await page.screenshot({ path: 'tmp/x-dark.png', fullPage: true })

// force light
await page.emulateMedia({ colorScheme: 'light' })
await page.waitForTimeout(500)
await page.screenshot({ path: 'tmp/x-light.png', fullPage: true })
```

Then hand each screenshot to the `image-understanding` agent and ask it to
verify contrast, bg tint visibility, icon colors, and absence of double-
border artifacts per variant. A single visual bug (e.g. Tailwind `/10` bg
opacity collapsing on the dark background) only shows up in the mode it
affects.

## Subgrid gap inheritance — `gap` shorthand overrides parent gaps (pitfall)

CSS subgrid inherits tracks (columns/rows) from parent AND inherits gaps
from parent by default. BUT if you set `gap`, `column-gap`, or `row-gap`
on the subgrid, you override the inherited value.

Tailwind's `gap-(--foo)` sets BOTH `column-gap` and `row-gap`. If you use
it on a subgrid to get vertical spacing between items (say `gap-(--prose-gap)`
for flex-col on mobile), at lg breakpoint when the element becomes a grid
subgrid, that same class silently overrides the inherited `column-gap`
from the parent grid.

Concrete example from Holocron sections refactor:
- Page grid: `lg:gap-x-(--grid-gap)` → 50px column gap
- Outer sections wrapper (subgrid): `gap-(--section-gap)` → overrides to 48px
- Inner section wrapper (subgrid): `gap-(--prose-gap)` → overrides to 20px

Result: gap between content and aside was 20px, not 50px — much too tight.

Fix: use axis-specific gap classes on subgrid wrappers so you only set the
axis you actually need. For a flex-col-on-mobile + subgrid-on-desktop
wrapper, use `gap-y-(--prose-gap)` (row-gap only). Column-gap stays unset
and the subgrid inherits it from the parent grid.

Rule of thumb: **never use `gap-(--token)` on an element that becomes a
subgrid at any breakpoint**. Always use `gap-x-...` or `gap-y-...`
depending on which axis you need. The other axis will correctly inherit.

## `display: contents` breaks `position: sticky` scoping (pitfall)

`position: sticky` is scoped by the sticky element's **containing block**,
which is its nearest grid/block/flex ancestor. When a wrapper uses
`display: contents`, it vanishes from layout — the nearest layout ancestor
for its children becomes the GRAND-parent.

In the sections refactor this created an overlap bug: per-section wrappers
used `lg:contents` to flatten content+aside into the outer subgrid. Every
aside's sticky containing block became **the entire sections grid** (not
just its own section's row), so multiple asides pinned at `top: 120px`
simultaneously and overlapped during scroll.

Symptoms:
- At scroll position X, aside A (row 1) AND aside B (row 2) both at `top: 120`
- User sees two stacked asides instead of just the current section's aside

Fix: don't use `display: contents` on a wrapper whose children need sticky
scoping. Use `lg:grid lg:grid-cols-subgrid lg:col-[1/-1]` instead — the
wrapper becomes a real inner subgrid item. Aside's sticky containing block
= the wrapper = one section's bounds.

For `<Aside full>` with span > 1, render the aside as a SEPARATE outer-
grid child (escaping the per-section wrapper) with `grid-row: start /
span N` so sticky still works across the multi-row range.

**Flatten update (2026-04-05)**: the outer sections subgrid was removed
entirely. Per-section wrappers + shared asides are now direct children of
the page grid. Shared asides are rendered ONCE (no dual render) in DOM
after their last sub-section, with `lg:col-[3]` + explicit `grid-row`.
Their sticky containing block becomes the page grid's multi-row area.
This simplification removed 1 grid level + 1 dual-render branch.

## Pre-existing title test flake (documented, not fixed)

`integration-tests/e2e/basic.test.ts:31 renders page title and headings`
is flaky at HEAD. When run AFTER the home page test, document.title
resolves to just the siteName ("Test Docs") instead of the expected
"Getting Started — Test Docs". When run in isolation, the test passes.

Root cause suspected: spiceflow's `getHeadStore` uses `React.cache(() =>
({ tags: [] }))`. On server each request gets a fresh store. But across
consecutive Playwright navigations in the same Vite dev server, tag
ordering might get mangled such that `CollectedHead`'s
`reversed.find(title)` returns the layout's siteName title instead of
the page's headTitle.

DEBUGGING LESSON: before blaming your own changes for a test regression,
check the same test with `git checkout HEAD` on the touched files. If
the test fails at HEAD too, the flake is pre-existing. Waste less time
chasing a red herring.

Workaround options (not applied):
- Add retry to the flaky test (`test.describe.configure({ retries: 2 })`)
- Skip the test until spiceflow fixes head-store deduplication
- Report as spiceflow bug with minimal repro

## Per-section aside + row height coupling (pitfall)

CSS grid rows size to `max(item-heights)` across all items in the row,
regardless of `align-self`. When an `<Aside>` (non-full) is taller than its
section's content, the row stretches to the aside's height — creating empty
space in the content column below the short content. `align-self: start`
only changes item alignment within the cell, NOT the cell/row sizing.

Example: a short one-paragraph section (~72px) paired with an aside of
3 lines (~130px) → row is 130px → 58px of dead space below the paragraph,
then `--section-gap` (48px) on top → ~106px visible gap before the next
section heading.

Workaround for authors: use `<Aside full>` when the aside is taller than its
section's content. Full asides span multiple rows via `grid-row: N / span M`
and don't couple to a single row's height.

Structural fix (if needed later): move per-section asides out of the
subgrid row flow and into `position: absolute` or a separate parallel
flex column. Keep `<Aside full>` using the grid-row span approach.

## `.editorial-prose { margin: 0 }` SHADOWS Tailwind margin utilities (cascade trap)

In `vite/src/styles/editorial.css` the `.editorial-prose` class sets `margin: 0`.
In `globals.css` the imports are ordered:

```css
@import 'tailwindcss';        /* utilities: .-ml-5 {...}, .mt-4 {...} */
@import './editorial.css';    /* .editorial-prose { margin: 0; } */
```

Both `.editorial-prose` and Tailwind utilities have single-class specificity (0,1,0).
CSS tie-breaks by **document order** → whatever is imported LAST wins. Since
`editorial.css` imports AFTER tailwindcss, **any `.editorial-prose` element with
a Tailwind margin utility gets margin zeroed out**.

Symptom (wasted time on this 2026-04-05): applying `-ml-5` to an `<ol>`/`<ul>`
that also has `editorial-prose` → class is generated by Tailwind, present on the
element, but computed `margin-left: 0px` because `.editorial-prose { margin: 0 }`
wins the cascade.

**Fix**: use an inline `style={{ marginLeft: '...' }}`. Inline styles beat any
class rule regardless of import order. Or use `!important` in arbitrary syntax
(`!-ml-5` in Tailwind v4), but inline is clearer for a one-off value.

Same trap applies to any margin utility on an editorial-prose element:
`my-*`, `mt-*`, `mb-*`, `mx-*`, `ml-*`, `mr-*`. All are silently dead.

## Bleed tokens + `.no-bleed` scope disable (2026-04-05)

Three bleed tokens in `globals.css`, all mobile-first (`0px`) with a single
`@variant lg { ... }` block that enables the full values at ≥1080px:

| token           | lg value | consumer                                     |
|-----------------|----------|----------------------------------------------|
| `--bleed`       | 44px     | code blocks (`.bleed` class, editorial.css)  |
| `--bleed-image` | 28px     | images (`<Bleed>` wrapper, inline style)     |
| `--bleed-list`  | 32px     | lists (`<OL>`/`<List>` inline style)         |

All three are consumed as `calc(-1 * var(--bleed-*))` for left/right negative
margin. The Tailwind v4 `@variant lg { ... }` block inside `:root` compiles to
`@media (width >= 1080px) { --bleed: 44px; ... }` — verified via DOM CSS
inspection.

**`.no-bleed` scope override** (`editorial.css`):

```css
.no-bleed {
  --bleed: 0px;
  --bleed-image: 0px;
  --bleed-list: 0px;
}
```

Because CSS custom properties cascade to descendants, any element inside a
`.no-bleed` ancestor picks up `0` for all three tokens — lists, code blocks,
and images automatically shrink to fit. **Applied to `<Callout>` `baseClass`**
(`markdown.tsx:1450`) so callout contents stay inside their frame.

**List alignment math**:
- `ul pl-5` (20px) + `li paddingLeft: 12px` = 32px total text offset from ul
  border. `--bleed-list: 32px` at lg therefore makes `li` text flush with prose
  paragraphs, with bullets/numbers hanging in the gutter at -32px to -12px.

**Verified end-to-end** (playwriter DOM inspection):
- Normal list in `.slot-main` with lg tokens → `--bleed-list: 32px`, `marginLeft: -32px`
- List inside a `.no-bleed` callout → `--bleed-list: 0px`, `marginLeft: 0px`
- Mobile viewport (`< 1080px`) → all tokens 0, no bleed

**Why not a Tailwind `@custom-variant`?** Considered defining one variant that
unions (inside-callout, mobile) and applies tokens via `@variant`. The plain
CSS approach with three `--bleed-*` tokens + one `.no-bleed` class is simpler:
same mechanism across consumers, no variant indirection, fewer moving pieces.

**margin-left MUST be an inline style** on lists (not a Tailwind `-ml-*`
utility). `.editorial-prose` sets `margin: 0` in `editorial.css`, which
imports after tailwindcss in `globals.css`; at equal specificity editorial
wins the cascade and zeroes any margin utility. Inline styles beat class
rules regardless of import order.

**Nested lists**: a nested ul/ol inside an li inherits the same component → also
picks up `-32px`, which makes it bleed further left instead of indenting. No
consumer MDX currently has nested lists, but when one appears, add a CSS reset:

```css
.slot-main ul ul, .slot-main ul ol,
.slot-main ol ul, .slot-main ol ol { margin-left: 0; }
```

## Commit splitting with critique hunks (workflow tip)

When a session touches many unrelated changes (schema refactor + loader refactor
+ spacing refactor + docs, all in the same working tree), split per-file with
`git add file1 file2` and per-hunk with `critique hunks add 'path:@-O,L+N,L'`.

Workflow that worked well:

1. `git diff --stat && git status -s -u` — map the full change surface
2. Read each changed file's diff to understand goals (use `head`/`sed` for
   large diffs to paginate without blowing context)
3. Draft a commit plan grouping by feature/concern, noting which hunks go where
4. For mixed files (e.g. markdown.tsx has loader-refactor hunks AND spacing
   hunks), stage the feature-matched hunks explicitly with
   `critique hunks add 'path:@offset'`
5. After committing, `critique hunks list` to see remaining hunks — their
   offsets update after each commit, so re-run before picking the next batch

Pitfalls:
- Hunk IDs change after each commit (offsets shift). Always re-run
  `critique hunks list` before the next `critique hunks add`.
- `git stash` without `-k` refuses if the index has been manually touched with
  `git add -N`. Either commit/restore or use `git add -N` then `git diff --stat`
  to refresh the index.
- MEMORY.md was added with `git add -N` early in the session — it ended up
  auto-staged in later `git add file1 file2` calls because `-N` keeps the
  intent-to-add flag. Use `git restore --staged` to unstage if needed.

## Expand/collapse containers: never `useState(0)` for height — use CSS grid `0fr↔1fr` to avoid hydration layout shift

Symptom: sidebar groups that contain the current page animate in from height 0
on every page load, causing a visible layout shift even though the loader-driven
`expandedGroups` state already knew which groups should be open at SSR time.

Root cause: the old `ExpandableContainer` in `vite/src/components/markdown.tsx`
measured `scrollHeight` via `ResizeObserver` and kept it in `useState`. During
SSR and the first client render, that state was `0`, so `height: 0px` rendered
for EVERY container — even `open={true}` ones. Only after the effect ran post-
mount did React re-render with the real height, and the CSS transition animated
0 → scrollHeight. That's a visible shift per load, not per toggle.

Fix: CSS grid with `grid-template-rows: 1fr | 0fr`. Browsers interpolate
between fractional track sizes (Chrome 117+, Safari 17.4+, Firefox 125+). The
child wraps content in `overflow: hidden` + `min-height: 0`. No JS measurement,
no ResizeObserver, no `useState` for height. SSR renders with the correct final
height for open containers because the browser sizes the track from content
synchronously during layout.

Belt-and-suspenders: use a module-level "first paint done" flag exposed via
`useSyncExternalStore(subscribe, getSnapshot, () => false)`. It returns `false`
on the server and initial client render, then flips to `true` on the first
`requestAnimationFrame`. Set `transition: canAnimate ? '...' : 'none'` so the
opacity fade doesn't run during hydration either. Subsequent toggles animate
normally.

Why NOT `useSyncExternalStore` to read `scrollHeight` during render: the value
we need can only be measured AFTER the DOM exists, and the element ref doesn't
exist during the first render. Height measurement is fundamentally post-mount;
the fix is to stop measuring heights at all and let CSS do it.

Applies to any expand/collapse UI pattern. Never do `useState(0)` + measure +
`setHeight` + animate height — it always causes first-paint layout shift.

## useEffect removal patterns — three common cases that are NOT effects

When auditing a component for removable useEffects, classify each effect into
one of these buckets first. Most are removable.

**Bucket 1: "Adjusting state when a prop changes"** → render-phase setState
Symptom: `useEffect([propA])` that calls `setState(derived from propA)`.
React docs explicitly document the alternative at
https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes

```tsx
const prevPropRef = useRef(propA)
if (prevPropRef.current !== propA) {
  prevPropRef.current = propA
  setState(next)  // React bails out of render, restarts with new state
}
```

Use this ONLY when the state genuinely needs to persist across prop changes
(e.g. merging a Set of user-toggled keys with new defaults). If state is
purely derived from props, use `useMemo` or just compute during render.

**Bucket 2: "Side effect triggered by a state change caused by an event
handler"** → move to event handler with `flushSync`
Symptom: `useEffect([stateA])` where stateA is only written by event handlers.
The effect runs imperative DOM work (scrollIntoView, focus, select) after
React re-renders.

```tsx
import { flushSync } from 'react-dom'

const onClick = () => {
  flushSync(() => setState(next))  // synchronous re-render
  ref.current?.scrollIntoView()     // ref points at new element
}
```

`flushSync` forces React to commit synchronously so refs/DOM reflect the new
state before the handler continues. Colocates the side effect with its cause.

**Bucket 3: "Two effects with identical dependency chain"** → merge into one
Symptom: two `useEffect` calls whose dep arrays reduce to the same value
(often because one depends on a `useCallback` whose deps match the other).

Merge pattern: inline the callback inside the effect body. It closes over
the current values directly, the `useCallback` wrapper becomes unnecessary,
and the effect has exactly one dependency.

```tsx
// Before: 2 effects, 1 useCallback
const fn = useCallback(() => { ...uses activeId }, [activeId])
useEffect(() => { fn() }, [fn])
useEffect(() => { observer.observe(el); return () => observer.disconnect() }, [fn])

// After: 1 effect, no useCallback
useEffect(() => {
  const fn = () => { ...uses activeId }
  fn()
  observer.observe(el)
  return () => observer.disconnect()
}, [activeId])
```

**What's left after applying all three:** legitimate effects only — global
event listeners on `document`/`window`, subscriptions to external stores
(or better: `useSyncExternalStore`), and DOM measurement that genuinely
needs to happen post-mount.

## pnpm-lock.yaml gets rewritten with relative paths in worktrees (do NOT commit)

When running `pnpm install` inside a git worktree whose path differs from the
main repo path, pnpm rewrites `file:` dependencies in `pnpm-lock.yaml` to use
relative paths that climb out of the worktree directory. Example from a
worktree at `~/.local/share/opencode/worktree/.../holocron-branch/`:

```diff
- spiceflow@file:../spiceflow-rsc/spiceflow:
+ spiceflow@file:../../../../../../Documents/GitHub/spiceflow-rsc/spiceflow:
```

These path rewrites are worktree-specific and will break the main repo
checkout if committed. Always check `git diff pnpm-lock.yaml` for `file:`
path changes before staging and exclude the file from commits when the only
changes are path rewrites. Use `git commit path/to/specific/files` (selective
staging) rather than `git add -A` in worktrees.

## Sidebar search — architecture & navigation gotchas (markdown.tsx)

Sidebar search lives in `SideNav()` at `vite/src/components/markdown.tsx`
(search input around line 555, keyboard handlers ~509-550, state ~477-501).
The Orama DB + search logic is in `vite/src/components/search.ts`, and
`siteSearchEntries` is built once at module load in `vite/src/data.ts`
(`buildSearchEntries` → only pages + headings, no groups).

**SearchState shape** (`search.ts:23-32`):
- `matchedHrefs: Set<string> | null` — hrefs that matched query
- `expandGroupKeys: Set<string> | null` — groups to auto-expand (ancestors
  of matches, via \0-joined groupPath walk)
- `dimmedHrefs: Set<string> | null` — hrefs to render at opacity 0.3
- `focusableHrefs: string[] | null` — matched hrefs in document order, used
  for arrow-key cycling

Dimmed items get `tabIndex={-1}` in `NavPageLink` (line 258) and `TocInline`
(line 170), so **browser-native Tab/Shift+Tab naturally skips them** — Tab
cycling through filtered items already works without custom handlers.

**Programmatic navigation — DO NOT use `window.location.hash = href`.** The
href values are full paths (`/some/page` or `/some/page#slug`), so setting
hash produces `current-url#/some/page` which is broken. Use
`router.push(href)` from `spiceflow/react` (the same `router` that `<Link>`
uses internally — see `node_modules/spiceflow/dist/react/components.js:152`).

**Icon convention in markdown.tsx**: inline SVG components only (no
`lucide-react` dep). Examples: `ChevronIcon` (~line 69), callout icons
(~line 1372). New icons should follow the same pattern — `currentColor`
stroke/fill, `viewBox='0 0 24 24'` (or 16 if tiny), wrapper `<span>` for
layout.

**Selection highlight color**: `--selection-bg` token already exists in
`globals.css` (`rgba(0,0,0,0.08)` light / `rgba(255,255,255,0.1)` dark).
Semantically perfect for "currently highlighted search result" — don't
invent a new `--search-highlight-*` token.

**Common pitfalls seen in this file's search implementation**:
- `highlightedRef` declared but not attached to any element → `scrollIntoView`
  in the effect is a no-op. Must conditionally attach `ref` to the DOM node
  whose href matches `focusableHrefs[highlightedIndex]`.
- `highlightedIndex` state lives in `SideNav` but never propagates into
  `NavPageLink`/`TocInline` children. Derive `highlightedHref` in `SideNav`
  and thread it through as a single prop — simpler than passing the index.
- ArrowUp/Down use `Math.min`/`Math.max` clamp (no wrap). Wrap-around
  (modulo) is friendlier: at last item, ArrowDown goes to first:
  `(prev + 1) % length` and `(prev - 1 + length) % length`.

## `box-shadow` for "bleed" highlight outlines gets clipped by `overflow-y-auto` parents

Used `boxShadow: '0 0 0 4px var(--selection-bg)'` as a 4px spread outline
around the highlighted sidebar item. Visually perfect — creates a pill
that extends 4px beyond the element's text box without changing layout.

**Problem**: the sidebar `<nav>` has `overflow-y-auto` for scrolling. Per
CSS spec, when one axis is `auto`, the other axis can't stay `visible` —
browsers force it to `auto` too. So `overflow-y-auto` also clips
horizontally. A 4px leftward `box-shadow` gets cut off at the nav's left
edge, and the pill looks like it's missing its left bevel.

Same problem for `ExpandableContainer` (uses `overflow: hidden` for
height animations) — any `box-shadow`/negative-margin extension from
children inside it also gets clipped.

**Fixes that don't work**:
- `padding + margin: -Npx` on the highlighted element itself — the
  negative margin extends past the element's natural box, but that
  extension is STILL inside the overflow-clipped parent → clipped.
- `overflow-x: visible; overflow-y: auto` on the parent — CSS normalizes
  this to `overflow: auto auto` (both axes).

**Fix that works**: add horizontal padding (`pl-1` = 4px) to every
clipping ancestor that the highlight might need to bleed into. That
padding creates clearance inside the clip boundary:
- Add `pl-1` to the scroll `<nav>` container.
- Keep `pr-1` (was already there for scrollbar clearance).
- To maintain visual alignment between search input and nav items, add
  `pl-1` to the search input wrapper `<div>` too.
- Nested items inside `ExpandableContainer`: either use a different
  highlight mechanism that doesn't bleed, or switch to inner `padding`
  on the highlighted element itself (no outer bleed).

**Cleaner alternative**: use inner `padding` (2px 4px) + `background` +
`borderRadius` on the highlighted element, no outer bleed at all. The
highlight fits entirely within the element's own box — no parent clip
interaction. Text shifts 4px when highlighted, but that's a feature
(indicates "selected"). This approach survives any overflow scheme.

## integration-tests multi-fixture layout + Vite 8 CLI gotchas (2026-04-05)

Reworked `integration-tests/` to support many fixtures under `fixtures/<name>/`,
one per config shape. Each fixture is a self-contained mini-site
(`holocron.jsonc` + `pages/`) pointed at via `vite <root>`. Playwright spawns
one webServer per fixture (each on its own free port) and one project per
fixture with `testDir: e2e/<name>`. Tests under `e2e/<name>/` only run
against the matching server.

### Vite 8 CLI flag changes (don't get caught)

- `--root` is **gone** as a flag. Use root as a POSITIONAL arg:
  `vite fixtures/basic --config vite.config.ts --port 5175 --strictPort`.
- `--strict-port` → `--strictPort` (camelCase).
- Config path via `--config` is resolved from CWD, not from the positional
  root arg. So you can share one `vite.config.ts` at project root and
  point many fixtures at it.

### Playwright config is re-imported per worker — persist ports via env vars

`playwright.config.ts` is evaluated MULTIPLE times: once in the main process
(for webServer + project setup) and again for each test worker. If you call
`getFreePort()` at module scope, each re-import gets FRESH ports and the
project's `use.baseURL` port stops matching the webServer's port — tests
fail with ECONNREFUSED to a port nothing is listening on.

Fix: allocate ports in the main process and write them to env vars, then
on re-import read from env first and only allocate if absent. Child
workers inherit env so they see the same ports. Key by fixture name:

```ts
function envKey(name: string) {
  return `E2E_PORT_${name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`
}
const port = process.env[envKey(name)]
  ? Number(process.env[envKey(name)])
  : await getFreePort()
process.env[envKey(name)] = String(port)
```

The original single-fixture config used the same trick with one
`E2E_PORT` var — this generalizes it to N fixtures.

### Tests must use `request` fixture, not raw `fetch(baseURL + …)`

The old tests had `const baseURL = http://localhost:${process.env.E2E_PORT}`
at module top and used `fetch(baseURL + "/path")`. This only works with
one global port. In multi-project mode each project has its OWN baseURL
(`use.baseURL`), and only Playwright's `request` fixture (or `page.request`)
picks it up automatically. Refactored every raw `fetch()` to
`async ({ request }) => { await request.get("/path") }`. `APIResponse`
uses `.status()` (method, parens) instead of `.status` property.

### RESOLVED bug: "Failed to resolve import fixtures/<name>/holocron.jsonc from virtual:holocron-config"

**Symptom**: Vite crashes during transform of the virtual config module
with the error above. Originally thought to be a two-server race; turned
out to be a single-server bug that just happened to surface first in the
multi-fixture setup.

**Root cause**: In `vite/src/vite-plugin.ts` the `config()` hook did
`root = viteConfig.root || process.cwd()`. When Vite is launched with a
positional root arg (`vite fixtures/basic ...`), `viteConfig.root` is
still the RAW CLI string (`"fixtures/basic"`, **relative**), because
Vite only resolves it later into `resolved.root`. That relative `root`
was then fed into `resolveConfigPath({ root, configPath })`, which uses
`path.join(root, 'holocron.jsonc')`. `path.join` does **not** make the
result absolute (unlike `path.resolve`) — so `configFilePath` stayed
relative (`"fixtures/basic/holocron.jsonc"`). That relative path was
passed to `this.addWatchFile(configFilePath)` in the virtual module's
`load()` hook, and Vite interpreted it as an import specifier of the
virtual module → "Failed to resolve import".

**Fix** (applied in commit `aba17df5`): overwrite `root` with
`resolved.root` (canonical absolute path) inside `configResolved`, and
re-derive `pagesDir`, `configFilePath`, `distDirPath`, `publicDirPath`
from the absolute `root`. `cacheDir` still computed in `config()` via
`path.resolve(process.cwd(), root)` — functionally correct because
`path.resolve` handles the relative case, but there's a minor timing
inconsistency (see Oracle review in commit notes).

**Tip**: in any Vite plugin that reads `viteConfig.root` in `config()`,
either (a) immediately normalize it via `path.resolve(process.cwd(), root)`,
or (b) defer all path derivations to `configResolved` where `resolved.root`
is guaranteed absolute. Don't feed a potentially-relative root into
`path.join` — that will quietly produce a relative output.

### Concurrent Vite servers need per-root cacheDir or they race on `node_modules/.vite/deps`

Second bug surfaced by running two vite servers simultaneously: flaky
tests, random ECONNREFUSED and "Failed to fetch dynamically imported
module" errors, dep re-optimization loops. Root cause: Vite's default
`cacheDir` is `<firstAncestorWithNodeModules>/node_modules/.vite/`. When
two servers have different `root`s but share an ancestor's
`node_modules/`, they both write to the SAME cache dir and corrupt each
other's optimized deps.

**Fix**: in the holocron plugin's `config()` hook, set
`cacheDir: path.join(absoluteRoot, 'node_modules/.vite')` so each root
gets its own cache. Vite creates `<root>/node_modules/` on demand even
if the fixture has no real dependencies.

**Trade-off flagged by Oracle**: this is a plugin-wide behavior change
affecting all downstream consumers, not just the integration-test
harness. An alternative would be to scope the cacheDir override in
`integration-tests/vite.config.ts` (consumer-level) rather than in the
plugin itself. Kept in the plugin for now because it's a strictly safer
default for anyone running multiple holocron sites concurrently (e.g.
monorepo with parallel docs previews).

### Spiceflow standalone trace needs absolute outDir

For `vite <relative-root> --config ...` multi-fixture builds, Spiceflow's standalone trace plugin must resolve `build.outDir` against `config.root` before calling `traceAndCopyDependencies()`. Using raw relative `outDir` makes the trace step look for `process.cwd()/dist/rsc/index.js` (for us `integration-tests/dist/...`) instead of the actual fixture output under `fixtures/<name>/dist/...`.

### Fixture architecture quick-ref for future sessions

```
integration-tests/
├── fixtures/<name>/           # self-contained mini-site
│   ├── holocron.jsonc  (or docs.json)
│   └── pages/*.mdx
├── e2e/<name>/<name>.test.ts  # tests for this fixture
├── scripts/fixtures.ts        # discovers fixtures/* with config files
├── scripts/build-fixtures.ts  # loops, runs vite build per fixture
├── playwright.config.ts       # multi-project + multi-webServer
└── vite.config.ts             # shared by every fixture
```

Each fixture's `dist/` lives inside the fixture folder (e.g.
`fixtures/basic/dist/`), kept out of git via `fixtures/*/dist/` in
`.gitignore`. Adding a new config type = drop a folder under `fixtures/`
+ test file under `e2e/<name>/` and everything else is discovered.

## Schema field-usage audit — status after commit b4d1676e (2026-04-05)

`schema.json` regenerated cleanly with **0 diff** vs `schema.ts`. Full
trace of every schema field through `schema.ts` → `config.ts normalize()`
→ `data.ts` → `app-factory.tsx` / `markdown.tsx` / `sync.ts`:

**WIRED (rendered / drives behaviour):**
- Root: `name`, `description` (site-wide `<meta>` fallback)
- `logo.light` (header img), `logo.href` (logo `<Link>` destination)
- `favicon.light` (layout `<link rel="icon">`)
- `favicon.dark` (second `<link>` with `media="(prefers-color-scheme: dark)"` —
  spiceflow dedup currently drops one variant, spiceflow-side fix pending)
- `redirects[]` — regex matcher in `.use()` middleware
- `navigation.tabs` + `tab.hidden` (filtered) + `navigation.global.anchors` +
  `navigation.anchors` + `anchor.hidden` (filtered)
- `navigation.groups` / `navigation.pages` (alt input shapes)
- `group.hidden` (pruned from sidebar at every depth, including
  transitive-empty parents via `hasVisibleSidebarEntries`)
- `group.expanded: true` (seeded into initial expanded-groups Set in
  `NavSidebar` — first-render only)
- `navbar.links[]` — label, type (for label derivation), href/url
- `navbar.links[].icon` (only string-URL form renders via `<img>`)
  — **caveat**: this means `navbar.links` is practically broken for
  the common case. If the user writes `{ "type": "github", "href": "..." }`
  with no explicit `icon` URL, the `<a>` tag renders EMPTY (only
  `aria-label` set for screen readers). Users expecting automatic
  GitHub/Discord/etc. icons see nothing. Needs either (a) a built-in
  SVG map keyed by `link.type` for known platforms, or (b) a text
  fallback showing the label when no visible icon is available.
- Page slugs, `tab.tab`, `tab.href`, `tab.groups`/`tab.pages`,
  `group.group`, `group.pages`, `anchor.anchor`, `anchor.href`

**PRESERVED through pipeline but NOT RENDERED (renderer work needed):**

These fields now flow all the way through `config` → `NavTab` / `NavGroup`
/ `TabItem` / `HeaderLink` — ready to be consumed by a renderer that
doesn't exist yet. Each requires styling/design decisions:

- `colors.primary` / `colors.light` / `colors.dark` — need CSS var
  injection at `<style>` level (e.g. override `--brand-primary`)
- `footer.socials` — no `<footer>` element rendered anywhere
- `navbar.primary` + `.type` — no primary-CTA button component exists
- `logo.dark` — need `<picture>` with media-query source switching
  (current hack: `dark:invert` on single `.light` asset)
- `tab.icon`, `group.icon`, `anchor.icon`, `navbar.links[].icon`
  (object form) — all need an icon resolver component that dispatches
  on `icon.library` (fontawesome/lucide/tabler) and `icon.style`
  (fontawesome style variant)
- `tab.align` (`start`/`end`) — tab bar needs a flex-split layout
- `group.tag` — needs a badge component
- `group.root` — group label needs to become a `<Link>` pointing at
  the root page's href (already resolved in `sync.ts`)

When rendering any of these, remember: all the data plumbing is DONE.
You only need to read them off the enriched tree / data exports / the
Nav* types in `navigation.ts`, and drop them into the UI with the
right styling. No further `config.ts` or `sync.ts` changes needed.

## Redirects middleware in Spiceflow (API reference for holocron)

To add redirect rules from `config.redirects[]`:

```ts
import { redirect } from 'spiceflow'

app.use(async ({ request }) => {
  const url = new URL(request.url)
  const match = matchRedirect(redirectTable, url.pathname)
  if (match) {
    throw redirect(match.destination, match.permanent ? 301 : 302)
  }
  // return undefined → continues to next handler
})
```

Place the `.use()` call BEFORE `.loader('/*')` in `createHolocronApp()`
so redirects short-circuit before any loader/layout/page runs. `redirect()`
is already imported in `app-factory.tsx`. Use `throw` (not `return`) to
match the existing pattern at `app-factory.tsx:369`.

Middleware that returns `undefined` (no Response) falls through to
subsequent handlers — exactly what we want when no redirect matches.

## data.ts exports — only if DERIVED, never as pure aliases

`data.ts` re-exports `config` + `navigation` from `virtual:holocron-config`.
Consumers should read raw config fields via `config.description`,
`config.logo.href`, `config.colors`, `config.footer.socials`,
`config.navbar.primary` directly — **do not add named exports that are
pure aliases** like:

```ts
// BAD — pure alias, no transformation, adds a second name for the
// same data and forces readers to look up what it points to.
export const brandColors = config.colors
export const socials = config.footer.socials
export const primaryCta = config.navbar.primary
```

Named exports are only justified when they actually DERIVE something:

```ts
// GOOD — compiles a match table (real work done once at module load)
export const redirectTable = buildRedirectTable(config.redirects)

// GOOD — walks the navigation tree to find the first page
export const firstPage = navigation[0] ? findFirstPageInTab(navigation[0]) : undefined

// GOOD — collapses empty-string sentinel from the normalizer into
// `undefined` so consumers can write `if (logoSrc)` cleanly. Matches
// the pre-existing pattern for `siteName`/`logoSrc`/`faviconLight`.
export const logoDark: string | undefined = config.logo.dark || undefined
```

Rule of thumb: if the right-hand side is just `config.X.Y`, delete the
export and have consumers write `config.X.Y`. If the right-hand side
runs a function or converts sentinel values, keep it.

When this pattern slipped in during the schema-field-wiring work, the
immediate cost was a long import list in `app-factory.tsx` and
`markdown.tsx` for values that were already one dot-access away from
`config`. Reverted.

## Pattern matcher pitfalls (from the redirects review)

Four gotchas the oracle flagged on our first-pass `lib/redirects.ts`
implementation. Worth remembering for ANY path/pattern matcher:

1. **Exact patterns MUST beat parameter/wildcard patterns, regardless
   of declaration order.** Users write `/users/:id` first, then
   `/users/new` as a more-specific exception. A naive "first-match-wins"
   loop routes `/users/new` to `:id`. Fix: split rules into an exact
   `Map<string, Rule>` + a pattern `Rule[]`, check the map first.

2. **Preserve query strings + hash fragments on redirect.** `GET /old?ref=x`
   → `/new` without the `?ref=x` loses analytics / tracking. When the
   destination has no `?`, append `url.search`. Same for `url.hash`.

3. **Empty splat capture.** `/blog/*` against `/blog/` should match with
   `:splat = ""`. Against `/blog` (no trailing slash) should NOT match.
   Verify both cases in tests.

4. **Last-write vs first-write for duplicate rules.** If users duplicate
   the same exact source, first declaration should win (principle of
   least surprise — later rules are "fallbacks"). `Map.set` is
   last-write-wins by default — guard with `!map.has(source)` before
   setting.

Companion pitfall from the SAME review pass: **page-level `<meta>` tags
need to emit EVERY variant of the thing they're overriding.** Spiceflow's
`Head` dedups meta tags by key (`meta:property:og:description` vs
`meta:name:description` are DIFFERENT keys). When the site-level layout
emits both `name="description"` AND `property="og:description"`, the
page-level override must ALSO emit both — emitting only
`name="description"` leaves the site's `og:description` stuck.

## Hidden groups: prune empty wrappers, preserve intentional section labels

When filtering `group.hidden: true` out of the sidebar, there's a
subtle UX question: what about a parent group whose ONLY children were
all hidden groups?

The rule that works:
- `group.hidden === true` → prune (always)
- `group.pages.length === 0` → render (intentional section label divider)
- `group.pages.length > 0` AND every descendant is hidden → prune
- otherwise → render

Implemented as `hasVisibleSidebarEntries(group)` in `navigation.ts`,
called from `NavGroupNode` in `markdown.tsx`. The distinction matters
because users write empty groups as deliberate section dividers in the
sidebar — we shouldn't prune those. Only groups that WOULD have had
content but all got filtered out.

## Redirects in spiceflow — stuck with a custom regex matcher + `.use()` middleware

Tried FOUR integration points with spiceflow during the schema-wiring
work. None of the "delegate to spiceflow's routing" approaches worked
without tradeoffs. Landing on a custom regex matcher inside `.use()`
middleware, because it's the simplest reliable option.

### What we tried

**`.get('/old', handler)`** — does NOT work.
`spiceflow.js → resolveRoutes` (line ~1025) does
`shouldEnterReact = hasPageMatch || ...`. Whenever ANY `.page()`
matches, spiceflow enters the React pipeline and ignores all
non-React routes that also matched. Holocron always has
`.page('/*')`, so `.get('/old')` is never called.

**`.loader('/old', handler)`** — works for non-overlapping rules,
breaks for overlaps. `spiceflow.js → renderReact` (line ~543) runs
all matched loaders in parallel via `Promise.all`, then sorts them
by specificity AFTER running them. When both `/blog/*` and
`/blog/index` throw a redirect, Promise.all rejects with whichever
throws first synchronously — which is the LESS specific one
(appears earlier in the sorted array). Mintlify's idiomatic
"wildcard + exception" pattern (`/blog/*` + `/blog/index`) breaks.

**`.page('/old', handler)`** — works (pages use `pickBestRoute`
which picks ONE handler by specificity, so no race). But requires
Vite RSC runtime for tests; can't be exercised via bare `new
Spiceflow()` + `.handle()`. Also, the catch-all `.loader('/*')`
still runs for every redirect request (wasted work walking
`navigation`) before the page throws.

**`TrieRouter` deep import** — works, but requires importing
`spiceflow/dist/trie-router/router` which isn't in spiceflow's
`package.json` `exports` map. Could break on spiceflow updates.

### Why custom regex matcher + `.use()` middleware is fine

- `.use()` runs BEFORE any route resolution, so it's not affected by
  the `.get()` vs `.page()` vs `.loader()` issues.
- ~50 lines of code, tested in isolation with 20+ unit tests.
- Bare `new Spiceflow().use(...)` works in tests — no RSC runtime
  needed.
- No deep imports, no spiceflow internals.
- No dependency on spiceflow's routing semantics (stable across
  spiceflow updates).

### Implementation shape

```ts
// lib/redirects.ts
export function buildRedirectTable(rules) {
  // exact map + pattern[] split so exact matches beat :param/* rules
}
export function matchRedirect(table, pathname) {
  // exact lookup first (O(1) Map), then patterns in declaration order
}
export function interpolateDestination(template, params) {
  return template.replace(/:(\w+)/g, (_, n) => params[n] ?? '')
}

// app-factory.tsx
.use(async ({ request }) => {
  const url = new URL(request.url)
  const match = matchRedirect(redirectTable, url.pathname)
  if (match) {
    let dest = interpolateDestination(match.destination, match.params)
    if (!dest.includes('?') && url.search) dest += url.search
    if (!dest.includes('#') && url.hash) dest += url.hash
    throw redirect(dest, { status: match.permanent ? 301 : 302 })
  }
})
```

### Future: worth migrating to spiceflow routes if

1. **Spiceflow changes loader execution to sequential, most-specific-first.**
   Then `.loader()` works cleanly with overlap patterns. Would be a
   1-line refactor here.
2. **Spiceflow exports `TrieRouter` from its public API.** Then we
   can delegate matching to spiceflow's trie without the deep import
   wart.

Neither is worth chasing until we have other reasons to touch
redirects.

## Icon resolver — build-time lucide atlas + virtual:holocron-icons (SHIPPED 2026-04-06)

**Bug fixed:** `navbar.links[].icon` strings used to render as
`<img src={icon}>` — wrong. Mintlify's convention (and now holocron's)
is that string icons are **lucide icon names** by default. Also fixed:
`{ "type": "github", "href": "..." }` without an explicit icon used
to render an empty `<a>` tag (only aria-label set) — invisible. Now
the normalizer auto-fills `link.icon` from `link.type`.

### Architecture — build-time atlas, client-side lookup

1. `lib/collect-icons.ts` — walks `config.navbar.links[].icon`,
   `config.navbar.primary.icon`, `config.navigation.anchors[].icon`,
   and recursively every `tab.icon` / `group.icon` in the enriched
   navigation. Dispatches via `iconToRef()`: emoji/URL icons skipped
   (they render inline), library-name strings map to
   `{library:'lucide', name}`, objects use `library ?? 'lucide'`.
   Returns a de-duped `IconRef[]` keyed by `library:name`.
2. `lib/resolve-icons.ts` — imports
   `{ icons as lucideIcons } from '@iconify-json/lucide'`, follows
   aliases (`lucideIcons.aliases?.[name]?.parent` — e.g. `home` →
   `house`), and emits
   `{ icons: { 'lucide:github': { body, width, height } } }`.
3. `vite-plugin.ts` — computes the atlas in `configResolved` (once
   per build) and re-computes in `hotUpdate` when the config
   changes. Serves it via the `virtual:holocron-icons` virtual module
   using `JSON.stringify(iconAtlas)`.
4. `components/icon.tsx` — `<Icon icon size className>` client
   component. Imports `iconAtlas` from the virtual module. Emoji →
   `<span>`, URL → `<img>`, otherwise → inline `<svg>` rendered via
   `dangerouslySetInnerHTML={{ __html: entry.body }}` with
   `viewBox="0 0 24 24"`. Icons inherit `currentColor` so they work
   in both dark + light mode without extra CSS.

### Why bundled-client, not server-rendered

Atlas payload for a typical site is 2-5 KB gzipped (<20 icons × ~180
bytes body + JSON overhead). Shipping it to the client keeps the call
sites simple — every `'use client'` component (TabLink, NavGroupNode,
navbar links) just calls `<Icon>`. Server-rendering + passing
pre-materialized SVG JSX as props would need a structural refactor
for negligible payload savings.

Fumabase does runtime-fetch-per-icon because its config is per-tenant
and changes without rebuilds. Holocron's config is known at Vite
plugin init → build-time resolution wins on every axis (no network
round-trip, no loading state, no hydration flicker).

### Dispatch rules for the `<Icon>` component

For each `icon: string | { name, library?, style? } | undefined`:

1. `undefined` / `''` → return `null` (no layout slot).
2. **Emoji** (unicode property escape regex matches) →
   `<span style={{ fontSize: size }}>{icon}</span>`.
3. **URL** (starts with `http://` / `https://` / `/`) →
   `<img src={icon} width={size} height={size}>`.
4. **Otherwise (lucide name)** → look up `iconAtlas.icons['lucide:' + name]`,
   render inline `<svg>` via `dangerouslySetInnerHTML`.
5. **Object form** `{ name, library?, style? }` → `library` defaults
   to `'lucide'` (matches Mintlify). `style` is ignored (FontAwesome
   concept). Missing from atlas → `null` + `console.warn`.

### Type → icon auto-fill (fixes "invisible github link")

`normalizeNavbar` in `lib/normalize-config.ts` auto-fills
`link.icon` AND `primary.icon` from their `type` when the user
omits the icon, via a `TYPE_ICONS` map aligned with `schema.ts`
`socialPlatformKeys`. Notable mappings:

- `discord` → `message-circle` (lucide has no discord icon)
- `x` / `x-twitter` → `twitter` (lucide's `x` is a close-X symbol,
  not the X/Twitter brand logo)
- `website` / `earth-americas` → `globe`
- `button` / `link` → `external-link`

Users writing `{ "type": "github", "href": "..." }` (the dominant
Mintlify pattern) now get the GitHub icon automatically.

### Sizes used in holocron UI

- navbar link icons: 16px
- navbar primary CTA: 14px
- tab / anchor icons: 14px
- group icon at depth 0: 13px
- group icon next to chevron: 12px
- emoji: `fontSize: size` (scales with the same `size` prop)

### Integration tests — fixture at `fixtures/fields/`

The `navbar` block in `fields/holocron.jsonc` exercises all 5 icon
variants (type-only, string lucide name, URL, emoji, object form)
plus a label-only fallback and a primary CTA. Tests in
`e2e/fields/fields.test.ts` (describe `navbar icon resolution`)
assert each variant renders the right element (svg / img / span)
with the right attributes.

### Pitfalls & notes

- **Empty atlas key leaks missing icons silently.** The resolver logs
  a warning but emits no entry. `<Icon>` returns null for missing
  keys → nothing renders. Always check the `[holocron] resolved N
  icons` log for expected count.
- **Lucide body uses `currentColor` + `stroke-width`.** SVG color
  inherits from the parent's `text-*` class. Our navbar/tab/group
  styles set `color: var(--text-secondary)` with hover →
  `--text-primary`, so icons color correctly in both modes.
- **Alias resolution is CRITICAL for common names.** `home`, `user`,
  etc. are aliases in lucide. The resolver must check
  `lucideIcons.aliases?.[name]?.parent` BEFORE `lucideIcons.icons[name]`.
- **iconify-json/lucide is ~490 KB** on disk. It's a Vite-plugin-only
  import (Node, build-time) and never touches any client or server
  bundle. Only the resolved SVG bodies get serialized.
- **HMR recomputes the atlas** in `vite-plugin.ts:hotUpdate` when
  config changes — invalidates `virtual:holocron-icons` and sends an
  `rsc:update` so newly referenced icons ship without a dev restart.

### Reference paths in fumabase (runtime-fetch pattern, NOT what we do)

- `fumabase/docs-website/src/lib/icon.tsx` — runtime `DynamicIcon`
  component with emoji/URL/lucide dispatch + `useEffect` + `fetch`
- `fumabase/docs-website/src/lib/icons.server.tsx` — server-side
  `getIconJsx()` using `@iconify-json/lucide`
- `fumabase/docs-website/src/routes/api.icons.$provider.icon.$icon.ts`
  — SVG-returning endpoint
- `fumabase/docs-website/src/routes/_catchall-client.tsx:529-560` —
  how navbar.links + navbar.primary consume the resolver
- `fumabase/docs-website/src/routes/_catchall-client.tsx:12` —
  hard-coded `GithubIcon`/`XIcon` from `lucide-react` for primary CTA

## 2026-04-06 markdown.tsx split — file layout + pitfalls

The 2082-line `components/markdown.tsx` was split into
`components/markdown/` subdirectory. `app-factory.tsx` (562 lines) and
`config.ts` (429 lines) were also trimmed. Zero behaviour changes —
only file moves + extraction.

### New file map (use this to find components)

- `components/markdown/index.tsx` — public barrel, re-exports everything.
  Also re-exports `TableOfContentsPanel` from the sibling `toc-panel.tsx`
  so the MDX components map can import from one place.
- `components/markdown/editorial-page.tsx` — `EditorialPage`, `EditorialSection`
- `components/markdown/side-nav.tsx` — `SideNav` (left sidebar + search input)
- `components/markdown/nav-tree.tsx` — `NavPageLink`, `NavGroupNode`, `TocInline`
- `components/markdown/expandable-container.tsx` — `ExpandableContainer`
  + module-scope first-paint store (`useFirstPaintDone`)
- `components/markdown/icons.tsx` — `ChevronIcon`, `SearchIcon`
- `components/markdown/back-button.tsx` — `BackButton`
- `components/markdown/typography.tsx` — `SectionHeading`, `P`, `Caption`,
  `A`, `Code`, type `HeadingLevel`
- `components/markdown/layout.tsx` — `Bleed`, `Divider`, `Section`,
  `OL`, `List`, `Li`
- `components/markdown/code-block.tsx` — `CodeBlock` + Prism setup +
  `diagram` language grammar
- `components/markdown/image.tsx` — `PixelatedImage`, `LazyVideo`,
  `ChartPlaceholder`
- `components/markdown/table.tsx` — `ComparisonTable`
- `components/markdown/markers.tsx` — `Aside`, `FullWidth`, `Hero`
  (pass-through marker components read by the section splitter)
- `components/markdown/callout.tsx` — `Callout` + `Note/Warning/Info/
  Tip/Check/Danger` + preset icons + `hexToRgba`
- `components/markdown/sidebar-banner.tsx` — `SidebarBanner`
- `components/markdown/tab-link.tsx` — `TabLink` (used by editorial-page)

Non-UI logic moved out of `components/` to `lib/`:

- `lib/search.ts` (was `components/search.ts`) — Orama index + query
- `lib/toc-tree.ts` (was `components/toc-tree.ts`) — `slugify`,
  `extractText`, `generateTocTree`
- `lib/mdx-sections.ts` (NEW, from `app-factory.tsx`) — `buildSections`,
  `isHeroNode`, `isAsideNode`, etc.
- `lib/mdx-components-map.tsx` (NEW, from `app-factory.tsx`) —
  `mdxComponents`, `renderNode`, `RenderNodes`
- `lib/site-head.tsx` (NEW, from `app-factory.tsx`) — `SiteHead`
  (favicon links, fonts, og:* meta)
- `lib/normalize-config.ts` (NEW, from `config.ts`) — all 7 `normalize*`
  functions

### package.json exports for directory-style subpath

When converting a `foo.tsx` file-export into a `foo/` directory with
`index.tsx`, the `package.json` exports entry needs `/index.{d.ts,js}`:

```json
"./components/markdown": {
  "types": "./dist/components/markdown/index.d.ts",
  "default": "./dist/components/markdown/index.js"
}
```

Forgetting to update `package.json` silently breaks `@holocron.so/vite/
components/markdown` imports (self-imports and external consumers both).

### Self-imports inside the package

`app-factory.tsx` and `lib/mdx-components-map.tsx` both import from
`'@holocron.so/vite/components/markdown'` — a self-import. This works
because:

1. `package.json` has an `exports` entry for the subpath.
2. `vite-plugin.ts` resolveId() resolves this subpath to the source
   file (via `preserveSymlinks` resolver, so `@vitejs/plugin-rsc`
   keeps the module in the `node_modules/` package-source path — see
   MEMORY.md section on hydration debugging).

The self-import pattern is DELIBERATE — it keeps the client boundary
on the package side so `@vitejs/plugin-rsc` emits stable
`client-package-proxy/...` chunks. Don't "simplify" it to a relative
import; that breaks hydration.

### Pre-existing integration test flakes (not caused by this refactor)

When running `pnpm test-e2e` against the `basic` fixture these tests
were already failing BEFORE the refactor (verified by running against
the pre-refactor baseline via `git stash -u`):

- `basic.test.ts` → `not found › returns 404 status for unknown page`
- `basic.test.ts` → `not found › renders 404 for nested paths`
- `config-hmr.test.ts` → `new MDX file HMR @dev › ...`
- `config-hmr.test.ts` → `deleted MDX file HMR @dev › ...`
- `config-hmr.test.ts` → `config HMR @dev › adding a navigation group...`

The 404 tests return 200 instead of 404; the HMR tests don't see the
new page appear within the 10s timeout. Likely related to dev-mode
config-hmr.test.ts running in `dev` + shared port config. They were
introduced in commit `aba17df5`. **Do not debug unless specifically
asked** — they are flakes independent of any changes you make in
`vite/src/`.

### Validation pattern for this kind of refactor

1. `pnpm -F @holocron.so/vite build` (regenerates `schema.json` + tsc)
2. `pnpm -F @holocron.so/vite typecheck`
3. `pnpm -F @holocron.so/vite test` → all 326 tests should pass
4. `pnpm -F integration-tests test-e2e --grep-invert "config HMR @dev|
   new MDX file|deleted MDX file|returns 404 status|renders 404 for nested"`
   (skips the pre-existing flakes documented above)

## React.cache() broken in Vite RSC — dual React instances (2026-04-06)

### Root cause

`@vitejs/plugin-rsc` pre-bundles `react-server-dom-webpack` in `dist/vendor/`.
That vendor bundle has its own copy of React. When `renderToReadableStream`
starts, it sets `ReactSharedInternals.A = DefaultAsyncDispatcher` on the
**vendor's** React, not on the **user code's** React. So user-code calls to
`React.cache()` see `A = null` and degrade to uncached — every call creates
a fresh object.

### Why Head/CollectedHead broke

`Head` pushes tags to a `React.cache()`-backed store. `CollectedHead` reads
from it. Because `React.cache()` was uncached (returning a new `{ tags: [] }`
each call), Head and CollectedHead each got isolated stores — `<title>`,
`<meta>`, `<link>`, favicon, theme script, and fonts never appeared in the SSR
HTML `<head>`.

### Diagnosis steps

1. Added debug logging showing `React.cache()` returned different objects on
   consecutive calls in the same function (`same-ref: false`).
2. Checked `ReactSharedInternals.A` at module load time → null.
3. Checked `ReactSharedInternals.A` at render time (inside Head fn) → still null.
4. Confirmed `__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`
   EXISTS on user React → it IS the server build, just with A unset.
5. Disabled wire-cache-dispatcher → A goes back to null. Enabled → A is SET.
   Proof that the vendor sets it on a different React instance.

### Fix: `wire-cache-dispatcher.ts` (in spiceflow)

Sets up a custom `AsyncLocalStorage`-backed cache dispatcher on the user React's
internals. Tries both `__SERVER_INTERNALS_*` and `__CLIENT_INTERNALS_*` keys.

`runWithRequestCache()` wraps `buildRscResponse` with `requestCacheStorage.run(new Map(), fn)`.
All `React.cache()` calls within the same request share that Map via `getCacheForType`.

The dispatcher provides `getCacheForType`, `cacheSignal` (→ null), and
`getOwner` (→ null, needed in DEV mode or React crashes with
"dispatcher.getOwner is not a function").

### Why Waku works

Waku uses `@vitejs/plugin-rsc` the same way. Presumably its React deduplication
works (vendor React and user React are the same instance). The vendor
pre-bundling issue exists but doesn't manifest because the module resolution
deduplicates React more effectively in Waku's setup.

### Why NOT a module-level variable (global store)

A global `_currentStore` variable is NOT safe for concurrent requests. Even
though `renderToReadableStream`'s synchronous rendering phase runs atomically
in Node.js's event loop, the `buildRscResponse` wrapper is async. Two concurrent
requests could interleave and clobber each other's store.

### Why NOT native `<title>`/`<meta>` without `<Head>`

React 19 hoists `<title>`, `<meta>`, `<link>` to `<head>`, but NOT `<script>`
or `<style>` with `dangerouslySetInnerHTML`. Those cause hydration mismatches
if rendered as siblings of `<head>`/`<body>` inside `<html>`. The `<Head>`
wrapper + CollectedHead approach handles deduplication correctly.

### `React.cache()` in client React build is a no-op

In the default/client React build (no `react-server` condition), `React.cache(fn)`
returns `function() { return fn.apply(null, arguments) }` — no caching at all.
This is by design: caching only works in server components. Tests that validate
the dispatcher must use the `react-server` condition or be conditionally skipped.

## Default pagesDir changed from `pages/` to project root (2026-04-06)

Mintlify puts MDX files directly in the project root alongside `docs.json`.
Changed Holocron's default `pagesDir` from `path.resolve(root, 'pages')` to
`root` to match this convention. The `pagesDir` plugin option remains available
for users who want a custom layout.

All example and fixture MDX files moved from `pages/` subdirectories to their
respective roots.
