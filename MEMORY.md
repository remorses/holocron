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
