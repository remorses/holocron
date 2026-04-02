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
