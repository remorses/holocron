# Holocron

Drop-in Mintlify replacement as a Vite plugin. Users point their `vite.config.ts` at this plugin and get a full documentation site from MDX files + a `holocron.jsonc` (or `docs.json`) config file.

Read the spiceflow skill before editing any code in this package. Run `playwriter skill` or load the spiceflow skill to get the latest API reference.

## Config

Supports two config file names (first found wins):
- `holocron.jsonc` — our format (JSONC with comments)
- `docs.json` — Mintlify new format (direct compatibility)

**Schema**: the JSON Schema for `holocron.jsonc` lives at `holocron/schema.json`, ported from the mintlify docs.json schema at https://mintlify.com/docs.json. This is the source of truth for all supported config fields.

MVP subset we support: `name`, `logo`, `favicon`, `colors`, `navigation` (with `tabs`, `global.anchors`), `navbar` (with `links`, `primary`), `redirects`, `footer.socials`.

### How config maps to UI

- **`navbar.links`** → simple text links in the logo bar (top-right, next to logo)
- **`navigation.global.anchors`** → rendered as tabs in the tab bar (can be external URLs like GitHub, Changelog)
- **`navigation.tabs`** → also rendered as tabs; clicking switches the sidebar content
- **`navigation` groups** → sidebar sections with collapsible pages

## Navigation tree as cache

The navigation tree is the central data structure. It mirrors the docs.json shape exactly (tabs → groups → pages) but enriches page slug strings into `NavPage` objects with parsed metadata (title, headings, gitSha).

This enriched tree is written to `dist/holocron-cache.json` after each sync. On the next build, the cache is read back and pages with matching `gitSha` are reused without re-parsing. This makes builds as fast as possible — only changed MDX files get processed. On CI, caching `dist/` between runs gives near-instant rebuilds.

Types are intentionally kept close to docs.json to minimize transformations. Utility functions (`getTabs`, `getActiveGroups`, `findPage`, `flattenForSidebar`) take the tree directly as input.

## Architecture

- **Vite plugin** (`vite-plugin.ts`) — wraps spiceflowPlugin, tailwind, tsconfig-paths. Generates two virtual modules: `virtual:holocron-pages` (import.meta.glob for lazy MDX loading) and `virtual:holocron-config` (serialized config + navigation tree).
- **App entry** (`app.tsx`) — Spiceflow app that imports from virtual modules. Rendering logic is in `app-factory.tsx`.
- **Sync engine** (`lib/sync.ts`) — walks the config navigation, computes git blob SHAs, diffs against cache, parses only changed files.
- **Components** (`components/`) — editorial UI copied from `website/src/components/`. Same styles, same design tokens.

## MDX content loading

MDX files are loaded lazily via `import.meta.glob('?raw')`. Content stays on disk until a page is requested. At request time, the MDX is parsed with `safe-mdx`, split into sections, and rendered with the editorial components.
