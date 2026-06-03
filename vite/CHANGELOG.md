# @holocron.so/vite

## 0.18.0

1. **Build summary with actionable tips** — after all individual warnings are logged, the build now prints a final summary at the end:

   ```
   ▲ holocron found 3 invalid internal links across 2 pages. Fix them or add paths to knownPaths in docs.json.
   ▲ holocron 2 pages with MDX errors. Fix the syntax issues in the pages listed above.
   ```

   The broken links summary includes a link to the docs page explaining `knownPaths`.

2. **`HOLOCRON_TOKEN` accepted as env var alias for `HOLOCRON_KEY`** — the Vite plugin, deploy command, and AI chat auth now check both `HOLOCRON_TOKEN` and `HOLOCRON_KEY` (first defined wins). Useful when your CI already has a `HOLOCRON_TOKEN` secret.

3. **Fixed OpenAPI renderer CJS crash in dev** — `render-openapi.tsx` was incorrectly marked `'use client'`, pulling `safe-mdx` and its transitive chain (`remark-frontmatter` -> `micromark-extension-frontmatter` -> `fault` -> `format`) into the client bundle. The `format` package (CJS-only, last updated 2013) caused:

   ```
   The requested module "format/format.js" does not provide an export named "default"
   ```

   The fix removes the `'use client'` directive so the OpenAPI renderer stays server-side.

4. **Trimmed Prism syntax highlighting bundle (891 KB -> 471 KB)** — removed ~170 obscure languages (Agda, ABAP, Bro, GAP, etc.), keeping ~130 popular ones. If you need a removed language, open an issue.

5. **Deduplicated acorn in RSC bundle (180 KB saved)** — acorn ships both CJS and ESM entries. Some transitive deps use `require("acorn")` while others use ESM imports, causing both copies to end up in the bundle. A resolve alias now forces all acorn imports to the ESM entry. RSC bundle: 3,998 KB -> 3,818 KB.

6. **Removed dead dependencies** — dropped `@fastify/deepmerge`, `image-size`, and `motion` from the package. These were unused leftovers that added install weight.

## 0.17.1

1. **Fixed OpenAPI double-framed code panels** — when an operation defined multiple named request body or response examples, `RequestExample` and `ResponseExample` wrapped them in a `CodeGroup` inside a `CodeCard`, producing a double frame. Now they render as a single tabbed panel with each example as a named tab.

2. **Fixed app entry CSS crash without the Vite plugin** — importing `@holocron.so/vite/app` outside the holocron Vite plugin (e.g. inside a `@cloudflare/vitest-pool-workers` test) crashed with `Cannot find module './styles/globals.css'`. The import now resolves from the package `src/` directory which is stable from both `src/` and `dist/`.

3. **Hidden tab scrollbars and press feedback** — the horizontal tab scroll container no longer shows a scrollbar on overflow, and tab buttons no longer flash a press/active highlight.

## 0.17.0

1. **Changelog tab generated from GitHub releases** — add a tab with a `changelog` URL and Holocron fetches the repository's published releases at build time, rendering one page with a Mintlify-compatible `<Update>` entry per release (newest first, drafts skipped):

   ```jsonc
   {
     "tab": "Changelog",
     "changelog": "https://github.com/owner/repo"
   }
   ```

   The generated page uses `mode: center` (left nav hidden) with a right-side notice explaining it's generated from GitHub releases. Release notes are Markdown and are safely escaped so a release body can never break the page. Set a `GITHUB_TOKEN` / `GH_TOKEN` to avoid rate limits; the token is only ever sent to `api.github.com`. Transient GitHub outages render a warning page instead of failing the build.

2. **Page mode frontmatter (`mode: center`)** — hide the left navigation sidebar on a per-page basis, matching Mintlify's `mode` layout control:

   ```mdx
   ---
   title: Landing
   mode: center
   ---
   ```

   Holocron collapses Mintlify's five mode values into two real layouts: `default` / `wide` / `frame` keep the left nav; `center` / `custom` hide it and center the content. All five names are accepted so existing Mintlify frontmatter works unchanged.

3. **Static page prerendering with `rendering: static`** — opt a page into build-time prerendering. Static pages are rendered to HTML + RSC data at build for faster delivery and cheaper hosting. Use it for pages whose content never depends on the incoming request:

   ```mdx
   ---
   title: Overview
   rendering: static
   ---
   ```

   The default is `ssr`, which renders on every request so pages can react to per-request data like cookies.

4. **Multiple OpenAPI examples render as switchable tabs** — when an operation defines several named examples for a request body or response (the `examples` map), Holocron renders all of them as a tabbed code group instead of showing only the first. Example names become the tab labels:

   ```yaml
   responses:
     '201':
       content:
         application/json:
           examples:
             Confirmed order:
               value: { id: 'order-001', status: 'pending' }
             Empty order:
               value: { id: 'order-002', items: [] }
   ```

5. **Markdown in OpenAPI descriptions** — `description` fields (which are Markdown by spec) now render as formatted HTML — headings, lists, inline code, links, emphasis, code blocks — everywhere they appear: endpoint summary, parameters, schema properties, request bodies, and responses. Previously they were dumped as plain text. The page `<meta>` description is still flattened to clean plain text. (Closes #96)

6. **Mix MDX pages with endpoint pages in OpenAPI tabs** — an API Reference tab can now interleave hand-written MDX pages (overviews, authentication guides) with auto-generated endpoint pages, instead of being limited to generated endpoints only.

7. **`/index` paths resolve to their canonical href** — pages authored as `index.mdx` serve at `/` and `guide/index.mdx` at `/guide`. The `*/index` forms now 308-redirect to the canonical href at runtime (query strings preserved) and are treated as valid targets by build-time broken-link detection, so links to `/guide/index` no longer 404 or get flagged as broken.

8. **New `@holocron.so/vite/prism` export** — reuse Holocron's vendored Prism bundle (prismjs core + ~300 grammars in one ESM module) to highlight code outside MDX, without shipping a duplicate Prism bundle in your client output:

   ```tsx
   import { Prism } from '@holocron.so/vite/prism'

   const html = Prism.highlight(code, Prism.languages[lang], lang)
   ```

9. **`bleed` prop on CodeBlock accepts `'both' | 'right' | 'none'`** — control how a code block bleeds into the page margins. `'both'` (or `true`) bleeds both sides, `'right'` only the right margin, `'none'` (or `false`) stays inside the parent.

10. **Scroll-driven fade mask on the left navigation sidebar** — the sidebar top/bottom edges now fade as you scroll, for a cleaner overflow appearance.

11. **Collapsible TOC headings in the left sidebar** — nested headings in the left navigation can now collapse and expand.

12. **Broken link validation runs during builds** — links pointing to non-existent pages are now reported at build time.

13. **`base` slug prefix accepts a leading slash** — the `base` field on OpenAPI and Changelog tabs is a slug prefix, not a route, so a leading slash is now allowed and ignored (`"/docs/api"` behaves like `"docs/api"`); trailing slashes are also trimmed. Useful when mounting docs inside your own app via custom entry. The field was renamed from `openapiBase` to `base` and is now shared across virtual-tab providers.

14. **`<Above>` hero spans the full grid width** including the side rails.

15. **Restyled inline code pills** — GitHub-style with baseline alignment; body prose softened so bold text and headings stand out at full foreground color.

16. **Seamless HMR for `globals.css` edits** — editing Holocron's global stylesheet now hot-reloads without a full page refresh.

17. **Skip auto H1 injection for non-default page modes and JSX-first pages** — pages in `center`/`custom` mode, or pages that start with a JSX component, no longer get an automatic H1 prepended from the title.

18. **Fixed per-section asides scoped on heading-first pages** — asides stay scoped to their section even when a page begins with a heading.

19. **Updated spiceflow to 1.26.0-rsc.3**

## 0.16.0

1. **New `@holocron.so/vite/mdx` export** — import Holocron MDX components in your own `.tsx` files. Useful when building custom components that compose Holocron primitives:

   ```tsx
   import { Card, CardGroup, Callout, Steps, Step } from '@holocron.so/vite/mdx'
   ```

   In MDX pages all components remain available globally without imports.

2. **Image processing preserves user-specified dimensions** — when you set `width` or `height` on `<Image>` or `<img>` in MDX, those values are now preserved instead of being overridden with the natural image size. When only one dimension is provided, the other is computed proportionally from the aspect ratio.

3. **SVG images skip placeholder generation** — SVG files no longer get a pixelated 16px rasterized WebP placeholder. Since SVGs are vector and render instantly, the placeholder system is bypassed entirely for `.svg` sources.

4. **Fixed images in flex containers** — images inside `<Marquee>`, card grids, and other flex layouts now use a definite pixel width capped at 100% instead of `width: 100%`, which caused circular sizing dependencies in flex items.

5. **AI logo proxy moved to `/holocron-api/` namespace** — the internal AI-generated logo proxy route moved from `/api/ai-logo/` to `/holocron-api/ai-logo/` to avoid collisions with user API routes.

6. **AI logo cache improvements** — stale SVG fallback responses are now evicted from the Cache API, and SVG fallbacks are never cached. This ensures retries can fetch the real AI-generated image once it's ready.

7. **Reduced nav group font size** — sidebar group titles decreased from 13px to 12px for a tighter, more refined sidebar.

8. **Thinner search clear icon** — the X icon in the sidebar search input uses strokeWidth 1.5 instead of 2.

9. **Reduced chat input placeholder opacity** — the AI chat input placeholder text is now rendered at 75% opacity for a subtler appearance.

10. **Removed vertical margin from Marquee** — the `my-6` class was removed from the Marquee wrapper, letting the component inherit spacing from its parent layout gap.

## 0.15.0

1. **Keyboard shortcut `d` to toggle dark mode** — press `d` anywhere on the page to switch between light and dark mode. Skips when focus is in an input, textarea, or contenteditable, and ignores modifier combos (Cmd+D, Ctrl+D, etc.).

2. **Styled `<blockquote>` for plain MDX** — standard markdown `> quoted text` now renders with a left border accent and italic muted text. GitHub-style callouts (`> [!NOTE]`, etc.) still render as Callout components.

3. **New `--type-nav-group-size` CSS variable** — controls font-size of sidebar group titles (both section labels and collapsible group buttons). Override it in your CSS to customize sidebar typography:

   ```css
   :root {
     --type-nav-group-size: 14px;
   }
   ```

4. **Smarter AI chat assistant** — the documentation chat assistant now gives shorter, messenger-style answers. Prefers linking to relevant docs pages over re-explaining content, and only includes code when explicitly asked.

5. **Fixed ai-logo proxy crash in Dynamic Workers** — the `caches.open()` call in the ai-logo proxy route could throw in hosted environments where the Cache API is unavailable, causing a 500. Now gracefully falls back to a direct fetch.

6. **Fixed theme shortcut firing during input** — custom interactive components (search, code playgrounds) that call `preventDefault()` no longer accidentally trigger the dark mode toggle.

7. **Removed paragraph `opacity: 0.82`** — body text no longer renders at reduced opacity. The compensating counter-opacity on `<strong>` and inline code is also removed.

8. **Fixed `@holocron.so/vite` subpath externalization in client builds** — `addNoExternal` for the `@holocron.so/vite` package pattern now runs in all Vite environments (client, ssr, rsc) instead of only rsc/ssr, preventing client bundles from failing to resolve subpath imports.

9. **Updated spiceflow to 1.26.0-rsc.0**

## 0.14.5

1. **Fixed dev-server `module is not defined` crashes** — Holocron now uses `spiceflow@1.25.5-rsc.2`, which prebundles `@vitejs/plugin-rsc`'s browser RSC client instead of letting Vite serve the raw CommonJS vendor file to browsers.
2. **Resolved production static middleware through Holocron** — Spiceflow's production virtual app entry now imports `serveStatic` through `@holocron.so/vite/src/serve-static`, so strict pnpm projects resolve the static middleware from Holocron's package context.

## 0.14.4

1. **Fixed `module is not defined` browser error** — removed the custom spiceflow `resolveId` hook that was interfering with `@vitejs/plugin-rsc`'s browser entry resolution. The underlying issue (bare `'spiceflow'` import in a virtual module) is now fixed upstream in spiceflow 1.25.5-rsc.0.
2. **Updated spiceflow to 1.25.5-rsc.0**

## 0.14.3

1. **Fixed spiceflow resolution in strict pnpm workspaces** — spiceflow is a transitive dependency of `@holocron.so/vite` and is not hoisted to the user's `node_modules` in strict pnpm. Spiceflow's own `virtual:app-entry` module imports from `spiceflow`, but virtual modules have no filesystem location so Vite falls back to resolving from the project root where spiceflow doesn't exist. A `resolveId` hook now resolves `spiceflow` from holocron's own source directory where pnpm places it as a sibling in the `.pnpm` store.
2. **Logo text uses heading font** — the logo text in the navbar now renders with the configured heading font-family, heavier weight (560), and tighter letter-spacing at 22px, matching the editorial heading style.
3. **Removed preserveSymlinks resolver** — eliminated the custom `@holocron.so/vite/src/*` resolveId hook that was only needed when spiceflow was a workspace dependency.
4. **Updated spiceflow to 1.25.4-rsc.0**

## 0.14.1

1. **DialKit config panel persists open/closed state** — the config panel no longer resets to its default state on page refresh or RSC remount. Open/closed state is saved to localStorage so the panel stays how you left it.
2. **Reduced main bundle size** — DialKit is now fully lazy-loaded. A stray value import was pulling the entire dialkit package into the eager bundle; switching to `import type` ensures it only loads when the config panel is opened.

## 0.14.0

1. **Analytics integrations for 14 providers** — new `integrations` field in docs.json injects client-side analytics scripts. Supports Fathom, Plausible, Pirsch, GA4, GTM, PostHog, Mixpanel, Hotjar, Heap, Segment, Clarity, Amplitude, LogRocket, and Clearbit. Mintlify-compatible config shape:

   ```json
   {
     "integrations": {
       "ga4": { "measurementId": "G-XXXXXXXXXX" },
       "plausible": { "domain": "docs.example.com" },
       "fathom": { "siteId": "ABCDEF" }
     }
   }
   ```

2. **New `<Marquee>` MDX component** — infinite scrolling content strip, available directly in MDX without imports. Supports horizontal and vertical directions, fade edges, configurable speed, and hover deceleration. Safe with multiple instances per page via `React.useId()` scoped keyframes:

   ```mdx
   <Marquee duration={30} fade slowOnHover>
     <img src="/logos/github.svg" />
     <img src="/logos/vercel.svg" />
     <img src="/logos/stripe.svg" />
   </Marquee>
   ```

3. **`logo.text` config field** — display a site name next to the logo in the navbar:

   ```json
   {
     "logo": {
       "light": "/favicon.svg",
       "dark": "/favicon.svg",
       "text": "My Docs"
     }
   }
   ```

4. **Layout and typography controls in docs.json** — new `layout` and `fonts` fields for customizing page geometry and font sizes without custom CSS:

   ```json
   {
     "layout": {
       "maxWidth": 1200,
       "sidebarWidth": 230,
       "columnGap": 60,
       "radius": 10
     },
     "fonts": {
       "fontSize": 14,
       "heading": { "fontSize": 16 }
     }
   }
   ```

5. **Live config panel on preview deployments** — a DialKit-powered config panel appears in dev mode and on preview deployments, letting you live-tweak colors, layout, fonts, decorative lines, and assistant settings. Changes are stored as config overrides via a Durable Object backend and applied via cookie.

6. **Relative-path global anchors with client-side navigation** — anchors pointing to relative paths now use client-side navigation instead of full page reloads, and no longer show the external link arrow icon.

7. **Version/dropdown inner tabs visible in the tab bar** — when a version or dropdown contains inner tabs (e.g. "Documentation" + "API Reference"), those tabs now correctly appear in the header tab bar instead of being hidden.

8. **Search UI improvements** — keyboard-layout-aware shortcut hints (shows "/" on US layouts, ⌘K/Ctrl K on layouts where "/" requires a modifier), accent border on focus, clear button, and the "/" shortcut now works alongside ⌘K/Ctrl K.

9. **Lazy-loaded Prism.js for faster initial page render** — syntax highlighting is now loaded via dynamic `import()` instead of blocking the initial bundle. Code blocks render unhighlighted text immediately (matching SSR output), then syntax highlighting appears asynchronously.

10. **Safe-mdx render errors shown in-page during development** — missing components, invalid expressions, and unsupported JSX now display as a Warning callout directly on the page in dev mode, instead of only logging to the terminal.

11. **CSS variable border-radius tokens** — all hardcoded border-radius values are now derived from the `--radius` CSS variable, making border radius globally customizable via `layout.radius` in docs.json.

12. **`sidebarTitle` frontmatter for SEO-friendly page titles** — use a long `title` for search engines while keeping the sidebar label short:

    ```yaml
    ---
    title: "Holocron — Open Source Documentation Site Generator"
    sidebarTitle: "Holocron"
    ---
    ```

13. **Fixed ordered list numbering** — lists split by code blocks now continue their numbering correctly instead of restarting at 1.

14. **Fixed theme token cascade** — Holocron design tokens now use a low-priority CSS cascade layer so user CSS overrides them regardless of stylesheet load order. Theme cookie renamed to `color-theme` for cross-app compatibility.

15. **Fixed sidebar search filtering** — search results now update synchronously instead of being wrapped in a transition, fixing flaky no-results states.

16. **Fixed mobile overflow** — removed hardcoded `display:flex` from grid-dot that caused horizontal overflow on mobile.

17. **UI polish** — hover background on clickable cards, bottom border on last table row, removed faux-bold text-shadow from active tabs, differentiated group labels from page links in sidebar, tighter heading section padding in navigation, wider API reference aside panel (460px), hidden line numbers in API reference examples, removed `white-space:nowrap` from heading text spans, removed bleed class from footer wrapper.

## 0.13.0

1. **Anchor placement in tabs or sidebar** — anchors now support a `placement` field that controls where they render. `"sidebar"` (the new default) places anchors at the top of the left navigation sidebar with icon and label. `"tabs"` places them in the header tab bar, preserving the previous behavior. You can mix both placements in the same config:

   ```json
   {
     "navbar": {
       "links": [
         { "label": "GitHub", "url": "https://github.com/...", "placement": "sidebar" },
         { "label": "Changelog", "url": "/changelog", "placement": "tabs" }
       ]
     }
   }
   ```

2. **Copy-to-clipboard button on code blocks** — every fenced code block now shows a copy button on hover in the top-right corner. The button fades in, transitions to a checkmark icon on success, and gracefully handles clipboard write failures in insecure contexts.

3. **`.md`/`.mdx` extensions stripped from internal links** — links like `[guide](/getting-started.md)` are now automatically rewritten to `/getting-started` at build time. Previously these links were excluded from broken-link validation and would serve raw markdown or 404. Reference-style links and JSX `href` attributes are also handled.

4. **Dark mode persists across reloads** — a blocking `<script>` now reads the `color-theme` cookie before first paint, preventing the theme from flashing or resetting during RSC streaming. Previously the theme script existed but was never injected into the page.

5. **Stale build artifacts cleaned before each build** — `vite build` now removes old `client/`, `rsc/`, `ssr/` directories from `dist/` before building, preventing stale artifacts from leaking into fresh builds. Cache files (`holocron-cache.json`, `holocron-images.json`, `holocron-mdx.json`) are preserved for incremental builds.

## 0.12.0

1. **Code block meta props: bleed, lines, title, highlight** — fenced code blocks now support meta string options parsed at build time:

   ````md
   ```ts title="vite.config.ts" highlight="3-5" lines=false bleed=true
   import { defineConfig } from 'vite'
   import holocron from '@holocron.so/vite'

   export default defineConfig({
     plugins: [holocron()],
   })
   ```
   ````

   - `title="..."` or bare words → filename/label header above the code block
   - `highlight="1-3,7"` → dims non-highlighted lines with a background overlay
   - `lines=false` → hides line numbers (on by default)
   - `bleed=true` → extends the code block into page margins

2. **Improved inline code in headings** — inline code inside headings now inherits the heading's font size and weight instead of shrinking to `0.875em`. Background pill is hidden, and color uses full-contrast `var(--foreground)` to match heading text. H2 headings also get a decorative divider line (previously h1 only).

3. **Theme-adaptive diagram labels** — ASCII diagram labels in code blocks now use `var(--primary)` instead of hardcoded green values, so they automatically match the site's color theme.

4. **Tighter line-height for diagram code blocks** — code blocks with diagram languages (`diagram`, `ascii`, `box`) use `line-height: 1.3` instead of `1.6`, improving vertical alignment of box-drawing characters and connected lines.

5. **Inline code color fix** — `.inline-code` now uses `var(--foreground)` in both light and dark mode instead of hardcoded `rgba()` values, so it adapts to custom themes.

## 0.11.0

1. **Inline `.md`/`.mdx` imports at remark level** — imported markdown files are now spliced directly into the page's mdast tree before any remark plugins run, replacing the previous multi-pipeline approach. Headings from imported files appear in the TOC automatically, images go through the normal build-time processor, and all remark plugins (callouts, code groups, mermaid, etc.) apply to the inlined content. Recursive imports are supported with cycle detection.

2. **New `knownPaths` config field** — suppress false broken-link warnings when mounting docs alongside other routes (API endpoints, dashboards, external apps). Supports exact paths and prefix wildcards:

   ```json
   {
     "knownPaths": ["/api/*", "/dashboard", "/blog/*"]
   }
   ```

3. **Imported `.md`/`.mdx` files included in AI chat context** — imported markdown snippets and shared fragments are now sent to the AI chat agent during local dev, matching production behavior where they were already included via `docs.zip`.

4. **Content column capped at 720px** — the derived `--grid-content-width` is now wrapped in `min(720px, ...)` so it never grows beyond 720px regardless of grid geometry.

5. **Fixed heading anchor scroll offset** — `scroll-margin-top` now uses `--sticky-top` instead of `--header-height`, adding breathing room below the navbar when navigating to `#id` anchors.

6. **Fixed AI chat loading dots alignment** — loading indicator dots are now aligned to top-start instead of vertically centered.

7. **Reduced parse count for imported `.md`/`.mdx` files** — each imported file is parsed exactly once and the mdast is reused for import extraction, image dep collection, and pre-building spliced nodes. Pages without `.md` imports skip the full AST parse entirely via a regex fast path.

## 0.10.2

1. **Fixed custom entry CSS under Cloudflare dev** — custom-entry apps now correctly load Holocron's global stylesheet when running under `wrangler dev`. The Spiceflow RSC entry now uses the real custom entry file instead of routing through a virtual module, so vite-rsc can walk the import graph and collect all CSS dependencies.

2. **Removed manual safe-mdx aliases** — safe-mdx 1.11.1 ships a package-level `react-server` export map fallback, so Holocron no longer needs to carry private path aliases for `safe-mdx`, `safe-mdx/parse`, and `safe-mdx/client`.

3. **Fixed broken 0.10.1 publish** — 0.10.1 was published with npm instead of pnpm, leaving `workspace:^` references unresolved in the published package.json.

## 0.10.0

1. **Build-time processing for imported `.md`/`.mdx` files** — imported markdown files (e.g. `import Guide from "./snippets/guide.md"`) now go through the same build pipeline as regular pages: all remark plugins (GitHub callouts, code groups, etc.), image resolution (dimensions, placeholders, copy to public), and normalization. Previously these were loaded as raw strings and parsed at render time without any processing.

2. **Imported MDX headings appear in sidebar TOC** — headings from imported `.md`/`.mdx` files now show up in the left sidebar table of contents in correct document order. Previously imported components were opaque JSX nodes, so their headings were invisible to the TOC.

3. **Broken internal link warnings during sync** — Holocron now walks the mdast tree during sync and resolves every internal link against the page index and redirect sources. Links pointing to non-existent pages log a warning with source location. Handles absolute (`/foo`), relative (`./foo`, `../bar`), hash fragments, and query strings.

4. **Serve raw markdown at `.mdx` URLs** — pages were already served as raw markdown at `/<slug>.md` for AI agents. Now `.mdx` URLs work identically, returning the same content with `text/markdown` content-type.

5. **Imported files included in `/docs.zip`** — the `/docs.zip` endpoint now includes imported markdown files (snippets, shared fragments, files outside pagesDir) alongside navigation pages.

6. **Global CSS loads for custom entries** — custom-entry apps that mount Holocron through a user-owned Spiceflow entry now correctly load Holocron's global stylesheet. Previously the CSS dependency could be missed under Cloudflare dev when vite-rsc collected stylesheets only from the virtual module.

7. **Spiceflow moved to regular dependencies** — users no longer need to install spiceflow separately. It ships as a regular dependency, so `pnpm install` resolves it automatically.

8. **Fixed copy-as-markdown button on index pages** — the "Copy as Markdown" button was fetching `/.md` (404) on the root page instead of `/index.md`. Now correctly appends `index.md` for root and trailing-slash paths.

9. **Fixed link hydration mismatch** — `isExternalHref` used `new URL()` origin comparison that produced different results on server vs client for relative paths like `docs/openapi.md#section`. Replaced with a simple regex that's consistent across environments.

10. **Fixed empty sidebar group labels** — unnamed sidebar groups no longer render an empty `<div>` wrapper.

11. **Fixed config HMR** — editing `docs.json` colors and styles now hot-reloads correctly without stale CSS artifacts.

## 0.9.0

1. **New prev/next page navigation in the right sidebar** — every page now shows chevron arrows linking to the previous and next pages in navigation order, plus a "Copy as Markdown" button that copies the current page content to clipboard. Tooltips on the arrows show the target page title via portal-based rendering to avoid clipping.

2. **Frontmatter JSON Schema** — a new `frontmatter-schema.json` is generated alongside the config schema, describing all supported MDX frontmatter fields (title, description, icon, SEO meta, hidden, etc.). Add `$schema: "https://holocron.so/frontmatter.json"` to your MDX frontmatter for IDE autocomplete and validation.

3. **Icon name autocomplete in `docs.json`** — the config JSON schema now references external enum schemas for lucide and Font Awesome icon names. IDEs that support `$ref` resolution fetch icon name lists on demand from holocron.so, giving you autocomplete for all 4,000+ supported icon names.

4. **Shared `cn()` utility (clsx + tailwind-merge)** — all components now use a shared `cn()` following the shadcn convention. This fixes a bug where passing `className` to `<Logo>` would completely replace the base sizing classes instead of merging with them. All components with className props now merge correctly via `tailwind-merge`.

5. **`text` prop on `<Logo />`** — pass `<Logo text="My Docs" />` to render an AI-generated logo using that text, bypassing the site config logo entirely.

6. **Fixed Tailwind HMR for MDX page edits** — editing MDX files or imported components no longer triggers a full page reload. New Tailwind utility classes are now compiled and injected in-place during HMR, preserving client state. Previously, Tailwind treated MDX files as external template changes and forced a reload.

7. **Upgraded Spiceflow to 1.25.3-rsc.0** — aligns all workspace packages on the same RSC build, avoiding duplicate framework versions.

8. **Search bar focus styling** — replaced the thick box-shadow focus ring with a subtle border-color change to `muted-foreground` for a cleaner active state.

9. **AI chat polish** — reduced the ShowMore collapsed height from 80px to 40px for tighter tool output previews.

## 0.8.0

1. **New `<Logo />` MDX component** — render the configured site logo directly inside docs content. It uses the same resolved light, dark, and generated logo variants as the navbar and footer.

   ```mdx
   <Logo />
   ```

2. **Tailwind scans your docs tree** — Holocron now adds your configured `pagesDir` as a Tailwind source, so utility classes used in MDX content and imported docs components are included in the generated CSS.

3. **Better MDX error pages and build failures** — MDX parse failures stay attached to their page route in dev, rendering a focused error page instead of turning into a 404. Production builds fail with the formatted code-frame message so broken docs do not deploy silently.

4. **MDX component validation during sync** — Holocron validates rendered MDX against the supported component map while syncing navigation. Unknown components and invalid imported MDX now surface earlier with the page source that caused the failure.

5. **Self-hosted JetBrains Mono** — code now uses `@fontsource-variable/jetbrains-mono`, avoiding a third-party font request for the default monospace font.

6. **JSONC syntax highlighting** — fenced `jsonc` code blocks now reuse Prism's JSON grammar instead of rendering without highlighting.

7. **OpenAPI success responses open by default** — generated endpoint pages now expand successful response examples first, making the useful response shape visible immediately.

8. **Navigation and layout polish** — browser scroll restoration works across docs navigation, unnamed sidebar groups no longer break search, responsive images keep their intended sizing, Frame captions align better, and the page AI widget stays hidden on mobile.

## 0.7.1

1. **Fixed internal links opening in new tabs** — relative links, hash links, and same-origin links in docs content now navigate in-place using client-side navigation instead of opening a new browser tab. External links still open in a new tab as expected.
2. **Table edges align flush with page content** — removed left padding from the first table column and right padding from the last column so table data aligns with surrounding editorial content.
3. **Improved AI chat scroll behavior** — after submitting a message, the chat drawer now scrolls your message to the top of the viewport instead of jumping to the bottom. The loading state and assistant response area get enough height to keep the scroll position stable during streaming.
4. **Fixed chat message overflow** — resolved an issue where `overflow-x-hidden` on chat text containers silently triggered vertical scrollbars due to CSS spec behavior. Content now grows naturally without nested scroll regions.

## 0.7.0

1. **Auto-derive dark mode `--primary` when `colors.light` is not set** — previously, if you only configured `colors.primary` without an explicit `colors.light`, the dark mode accent color was identical to light mode, making links and buttons hard to read on dark backgrounds. Now it auto-generates a lighter variant via `color-mix(in oklch, <primary> 40%, white)`, roughly matching Tailwind's 200-scale lightness. If you explicitly set `colors.light`, your value is still used as-is.
2. **Fixed Cloudflare Workers deploy crash ("No such module ssr/isbot")** — the `@cloudflare/vite-plugin` was loaded via async `import()`, leaving an unresolved Promise in the plugins array. Spiceflow's `hasPluginNamed()` couldn't detect it, so `noExternal: true` was never set for SSR/RSC environments. Bare npm imports like `isbot` and `history` stayed external in the bundle, crashing Dynamic Workers at runtime. The plugin is now imported synchronously and placed before spiceflow in the plugin array so detection works correctly.
3. **Fixed image height override in content area** — a blanket `.slot-main img { height: auto !important }` rule was overriding the explicit `height: 100%` set by the Image component for pixelated placeholder grid overlays. The global rule has been removed; `height: auto` and `max-width: 100%` are now applied only on the specific image paths that need them (bare fallback images and Card img props).
4. **Tighter TOC panel spacing** — reduced right-sidebar table of contents item vertical padding from `py-1.5` to `py-1` so headings feel less spread out while keeping comfortable click targets.
5. **Excluded spiceflow from RSC/SSR optimizeDeps** — prevents Vite from pre-bundling spiceflow in RSC and SSR environments so it stays in the transform pipeline as-is.
6. **Deploy output writes to `dist/.holocron`** — when `HOLOCRON_DEPLOY=1` is set, the Vite plugin now sets `build.outDir` to `dist/.holocron` instead of `dist/`, keeping deploy artifacts separate from normal platform-specific builds.

## 0.6.1

1. **`@cloudflare/vite-plugin` is now a direct dependency** — users deploying to Cloudflare Workers no longer need to install it separately. It ships as a transitive dep of `@holocron.so/vite`.

2. **Fixed OpenAPI spec resolution when `pagesDir` is set** — specs inside a custom `pagesDir` (e.g. `pagesDir: "./src"` with `api.yaml` in `src/`) now resolve correctly. Previously only the project root was probed, causing "OpenAPI spec not found" errors. The error message now lists all probed locations when neither has the file.

3. **Removed build-time OIDC registration from the Vite plugin** — the OIDC token minting and `.env` write path has been moved to the CLI deploy command. The Vite plugin no longer writes `HOLOCRON_KEY` or `HOLOCRON_BRANCH` to `.env` during build. This is a security improvement; deploy authentication is now fully handled by `holocron deploy`.

4. **Bumped spiceflow peer dep to `>=1.25.1-rsc.0`** — fixes deploy failures where the SSR entry wasn't nested inside the RSC output directory, causing "deployment must include worker/ssr/index.js" errors.

## 0.6.0

1. **Self-hosted Inter font** — the default Inter font is now bundled via `@fontsource-variable/inter` instead of loading from third-party CDNs (`rsms.me`, Google Fonts). No external font requests on default config. Google Fonts preconnect tags only appear when you explicitly configure a custom Google font.

2. **OIDC keyless deploys from GitHub Actions** — when `permissions: id-token: write` is set, the Vite plugin automatically mints a GitHub OIDC token and registers the deployment without any secret configuration. The API key is derived from the verified JWT and persisted to `.env`:

   ```yaml
   # No HOLOCRON_KEY secret needed
   permissions:
     id-token: write
   steps:
     - run: npx -y @holocron.so/cli deploy
   ```

3. **Prism excluded from SSR** — syntax highlighting now runs client-only via a `#prism` conditional import. SSR/RSC get a noop stub that returns unhighlighted text, then the client adds highlighting during hydration. Reduces SSR bundle by ~500KB and avoids the CJS global crash in Dynamic Workers.

4. **Stable dependency code splitting** — framework and vendor code is grouped into a single `holocron-stable` chunk in the RSC build. The entry chunk shrinks to ~20KB of virtual modules that change every deploy, while the stable chunk stays content-addressable across deploys for maximum KV dedup.

5. **`listen()` guard moved to renderChunk** — the auto-start `listen()` call is now appended to the final RSC entry chunk after bundling, not in the virtual module. This keeps `import.meta.url` correct even when code splitting moves framework code into dependency chunks.

6. **Dynamic Workers `createRequire` fix** — `createRequire(import.meta.url)` calls in bundled CJS helpers are replaced at build time when `HOLOCRON_DEPLOY=1`, preventing module evaluation crashes in Dynamic Workers where `import.meta.url` is undefined.

7. **Auto-inject Cloudflare plugin** — when `HOLOCRON_DEPLOY=1` is set (by `holocron deploy`), the `@cloudflare/vite-plugin` is auto-injected if not already present. Users don't need it in their `vite.config.ts`.

8. **Headings with inline code** — `extractText` now handles `inlineCode` nodes, so headings like `` ### `config` `` appear correctly in the sidebar and table of contents instead of showing as empty entries.

9. **Empty headings filtered** — headings with no text content are silently dropped from the sidebar TOC and right-side table of contents instead of rendering as blank items.

10. **User entry exports preserved** — when a user provides a custom spiceflow entry, all their named exports are re-exported alongside `app` and `default`, so custom middleware and routes stay accessible.

11. **`yaml` browser entry alias** — the `yaml` package is aliased to its browser entry at build time, fixing resolution issues in the browser bundle.

12. **`@cloudflare/vite-plugin` optional peer dependency** — added as an optional peer so `pnpm install` doesn't warn when deploying to non-Cloudflare targets.

## 0.5.0

1. **Decorative grid lines** — configurable vertical lines with dot ornaments at intersections. Set `decorativeLines` in your config to `"none"`, `"lines"`, `"dashed"`, or `"lines-with-dots"` (default):

   ```json
   { "decorativeLines": "dashed" }
   ```

   Lines respect the tab bar and footer borders, adapting their style automatically.

2. **Per-page CDN caching via frontmatter** — set `cache-control` in page frontmatter to control HTTP caching headers per page:

   ```yaml
   ---
   title: My Page
   cache-control: public, max-age=3600
   ---
   ```

3. **`?raw` imports in MDX modules** — MDX files can now import raw text content from other files using Vite's `?raw` query suffix.

4. **`docs.jsonc` config discovery** — Holocron discovers config files in Mintlify-first order: `docs.json`, `docs.jsonc`, then `holocron.jsonc`. JSONC comments and trailing commas work without renaming your Mintlify config.

5. **`holocron` CLI bundled with vite package** — installing `@holocron.so/vite` now also provides the `holocron` CLI command. No separate `@holocron.so/cli` install needed.

6. **Deploy with just `HOLOCRON_KEY`** — deployment registration now only needs `HOLOCRON_KEY` (removed `HOLOCRON_PROJECT`). The project is resolved from the key server-side.

7. **Generated entry guards `listen()` with `import.meta.main`** — the built `dist/rsc/index.js` can now be imported by another framework (e.g. Next.js catch-all route) without starting a second server.

8. **OG images and logos served from holocron.so** — OG image rendering and logo generation moved to a dedicated Cloudflare Worker. This drops ~5 MiB from the vite plugin bundle.

9. **Sidebar nav animations disabled by default** — sidebar expand/collapse transitions are off by default, gated behind a `.sidebar-animate` CSS class for users who want them.

10. **Config types and schema exported from index** — `@holocron.so/vite` now exports config types and the JSON schema, useful for programmatic config validation.

11. **Darker dark mode** — dark mode background darkened from `0.21` to `0.16` oklch lightness for better contrast.

12. **Tab link style refinements** — removed lowercase transform, fixed indicator height to 2px, polished hover states.

13. **Scrollbar and search input polish** — thinner 4px scrollbar thumbs with subtler opacity, focus ring on search input.

14. **Fixed TOC heading highlight** — same-hash re-click and scrollbar drag edge cases now correctly update the active heading.

15. **Fixed sidebar heading click** — clicking a heading in the sidebar now highlights correctly after scroll.

16. **Fixed page overflow** — decorative grid dots no longer extend below the content container.

17. **Fixed title injection** — pages that already start with any heading level are left untouched (was only checking H1 before).

18. **Softer light mode borders** — border contrast reduced for a cleaner appearance.

## 0.4.0

1. **Agent discovery endpoints for every docs site** — Holocron now serves the well-known agent-skills discovery files automatically so coding agents can discover and install a docs-specific skill:

   ```txt
   /.well-known/agent-skills/index.json
   /.well-known/agent-skills/{name}/SKILL.md
   /.well-known/skills/index.json
   /.well-known/skills/{name}/SKILL.md
   ```

   The generated skill points agents at `/sitemap.xml`, raw `.md` page URLs, and `/docs.zip`. Base-path deployments use relative URLs, and AI-user-agent redirects skip the well-known routes so JSON discovery stays machine-readable.

2. **Added `/llms.txt`** — every docs site now exposes a standard agent entry point that links to `/docs.zip` first, then individual raw markdown pages:

   ```txt
   https://docs.example.com/llms.txt
   ```

   Rendered pages and raw markdown responses also include hidden discovery hints that point back to `/llms.txt` and `/docs.zip`.

3. **Imported MDX and Markdown snippets** — MDX pages can import local `.mdx` and `.md` snippets, including files outside the docs root, and Holocron resolves them through the same safe-mdx rendering pipeline as normal pages:

   ```mdx
   import Intro from './snippets/intro.mdx'
   import Readme from '../../README.md'

   <Intro />
   <Readme />
   ```

4. **Added Mintlify-compatible `<Visibility>`** — docs can render content only for humans or only for agent-facing markdown output:

   ```mdx
   <Visibility for="humans">
   This appears on the website.
   </Visibility>

   <Visibility for="agents">
   This appears in `.md` routes and docs.zip.
   </Visibility>
   ```

   Frontmatter is preserved in raw markdown output, and expression props like `for={"agents"}` are supported.

5. **More Mintlify-compatible MDX components** — callouts, badges, cards, expandables, frames, tooltips, trees, accordions, and tabs accept more Mintlify props without requiring docs rewrites. Tabs now include proper IDs, ARIA wiring, tab panel linkage, and keyboard navigation.

6. **HTML `<details>` support** — copied docs that use native HTML details/summary blocks are normalized into Holocron's existing `Expandable` component. Markdown inside the summary and body keeps Holocron styling.

7. **GitHub-style callout quotes** — Markdown alerts like `> [!NOTE]`, `> [!TIP]`, and `> [!WARNING]` now render as Holocron callouts.

8. **Search shortcut changed to Cmd/Ctrl+K** — docs search now uses the standard docs-site shortcut. The sidebar renders separate key pills for `⌘ K` on Mac and `Ctrl K` on Windows/Linux.

9. **Page-level grid gap overrides** — pages can override the editorial grid gap through frontmatter, and generated OpenAPI pages use tighter spacing automatically.

10. **Client-side routing is used consistently** — navigation links, configured links, footer links, MDX links, and TOC hash links now go through Spiceflow `Link` where appropriate while preserving external-link behavior.

11. **Docs chat uses the hosted typed API** — the vite package no longer bundles the local AI SDK/bash implementation. Chat requests go through the hosted Holocron API, with preserved model history for tool calls and local-development support for inline docs content.

12. **Temporary AI fallback for previews** — preview docs can use a low-cost temporary model when no Holocron API key is configured. The chat shows a one-time setup notice instead of repeating it on every message.

13. **New docs pages hot-reload in dev** — adding Markdown or MDX files now invalidates the relevant virtual modules and refreshes navigation without needing a server restart.

14. **Better code highlighting for MDX snippets** — `mdx` fences now reuse Prism's Markdown grammar so nested fenced code blocks inside MDX examples get syntax highlighting.

15. **Smaller server bundles for Mermaid sites** — Mermaid is resolved through an SSR stub and loaded only in the browser, reducing the SSR bundle for the real-world Polar fixture from about 7.55 MiB to 2.17 MiB. Mermaid browser chunks are still lazy-loaded when diagrams render.

16. **Cleaner build output for Mermaid** — Mermaid's dynamic diagram dependencies are grouped into one lazy chunk instead of dozens of tiny files.

17. **Table and layout polish** — Markdown tables use lighter row dividers, stay inside the content column, and preserve visible borders. Footers now sit inside the documentation content column and stay near the bottom on short pages.

18. **Sidebar and scrollbar polish** — navigation spacing, scrollbar thumbs, page breathing room, and border contrast were tuned for better readability in light and dark mode.

19. **Fixed sidebar hydration state** — sidebars now use loader-provided route state for the first render, preventing hydration mismatches on non-default tabs.

20. **Fixed active TOC tracking** — the active heading now updates when a section reaches the top reading position instead of using the viewport center.

## 0.3.0

1. **OpenAPI auto-generated API reference pages** — add `"openapi": "spec.yaml"` to any navigation tab and Holocron processes the spec at build time, extracts all operations grouped by tag, and generates virtual pages with full endpoint documentation:

   ```json
   {
     "navigation": {
       "tabs": [
         { "tab": "Docs", "pages": ["index"] },
         { "tab": "API Reference", "openapi": "openapi.yaml" }
       ]
     }
   }
   ```

   Each endpoint page includes parameter tables, request/response bodies with JSON Schema types, cURL examples, and response code expandables. Code examples render in a sticky right sidebar.

2. **Configurable `openapiBase` slug prefix** — control the URL prefix for generated OpenAPI pages (defaults to `"api"`). Set to `""` for no prefix:

   ```json
   { "tab": "API", "openapi": "spec.yaml", "openapiBase": "reference" }
   ```

3. **VirtualTabProvider plugin interface** — internal architecture for pluggable virtual page sources. Adding a future virtual content source (GitHub releases, MCP definitions, etc.) means implementing one interface and adding it to the providers array.

4. **Mermaid dark mode** — Mermaid diagrams now detect `<html class="dark">` and re-render with the correct theme when the user toggles dark/light mode. Uses a hydration-safe `useSyncExternalStore` pattern with MutationObserver.

5. **Auto-inject H1 from frontmatter title** — when an MDX page has a frontmatter `title` but no H1 in the body, a heading is automatically injected. Pages that already have their own H1 are left untouched.

6. **Uniform 16px heading sizes and code-font-size utility** — editorial typography uses consistent heading sizes. Monospaced text inside headings and UI chrome uses the `--code-font-size` variable for optical matching.

7. **Narrower, more focused content column** — max page width and content column reduced for better reading experience. Content width is now derived from grid tokens via CSS `calc()`.

8. **Sidebar typography improvements** — sidebar and tab bar use parent-level `text-sm` instead of `text-xs` for better readability. H1 headings restored to sidebar TOC.

9. **Tabs component restyled** — replaced `bg-foreground/8` with `bg-accent` for a cleaner tab panel appearance.

10. **OpenAPI field styling** — divider lines between fields, proper spacing, copy button on request examples, Mintlify-style rounded `CodeCard` containers.

11. **Fixed `@tailwindcss/vite` and `tailwindcss` moved to dependencies** — these were incorrectly in devDependencies, causing missing styles in production.

12. **Fixed OpenAPI active tab matching** — navigating between OpenAPI pages now correctly highlights the active tab.

13. **Fixed H1 headings filtered from TOC** — page title no longer duplicates in the table of contents.

14. **Fixed OpenAPI description color and default response label** — muted description text and "Default" label for unspecified response codes.

## 0.2.0

1. **MDX import support** — import components from anywhere in your project using standard MDX import syntax:

   ```mdx
   import { Greeting } from '/snippets/greeting'
   import { Badge } from '../components/badge'
   ```

   Imports are discovered at build time and resolved at render time. No magic directories — any local file can be imported from any location.

2. **Auto-detect user global CSS** — Holocron automatically discovers and loads user global CSS files, making Mintlify migration smoother.

3. **AI Assistant control** — new `assistant.enabled` config field to disable the AI chat widget entirely.

4. **Default icon library switched from Lucide to FontAwesome** — all plain icon strings now resolve to FontAwesome by default. Use explicit `lucide:icon-name` syntax to keep using Lucide icons.

5. **Wider content column with flexible grid** — better use of horizontal space. Tables and tabs now bleed properly. Table cells get a minimum width of 150px with horizontal scroll on overflow.

6. **H3 headings** now use the same foreground color as h1/h2 (no longer muted).

7. **Unified vertical spacing** — Steps, lists, and all container components now use the `--prose-gap` token for consistent vertical rhythm. This replaces ad-hoc margins and gaps across the component library.

8. **Code block line numbers** now use `--text-tertiary` for a more subtle appearance.

9. **Component rename: `<Hero>` → `<Above>`** — update your MDX files if you use the Hero component directly.

10. **Tab panels** now have proper padding and no-bleed scope. External link indicators shown on anchor tabs.

11. **Fixed phantom 48px gap** from empty first section in the editorial page grid.

12. **Fixed imported components inside `<Above>`** — components in this section now render correctly. MDX errors surface in the dev terminal.

13. **Fixed sticky sidebar** — sidebar now sticks below the navbar even when no tab bar is present.

14. **Fixed active TOC tracking** — uses 50% viewport scroll threshold with hash-change detection for pushState navigation. More reliable heading highlighting.

15. **Fixed heading text rendering** — heading text is no longer wrapped in a prose-styled `<p>` element (was causing incorrect visual weight on headings).

16. **Fixed callout content** — no longer split incorrectly during MDX serialization.

17. **Fixed spiceflow dual-instance crash** — deduplicated `@types/node` in dependency graph to prevent duplicate React instance errors.

18. **Chat/AI fixes** — fixed stale text propagation in drawer, textarea preservation after submit/close, and split vanilla store from React hook boundary for hydration safety.

19. **Scrollbar gutter prevention** — `scrollbar-gutter: stable` prevents layout shift in scrollable panels.

20. **Performance** — pre-parsed mdast tree is shared between module resolution and page rendering, reducing redundant parsing.

21. **Improved sidebar link contrast** — page link opacity increased from 0.45 to 0.65 for better readability.

22. **Fixed implicit "Docs" tab visibility** — when versions + anchors are both configured, the implicit Docs tab now shows correctly.

23. **Fixed nested index slugs** — loader titles resolve correctly for pages with nested directory structures.

24. **Fixed tab indicator** — height set to 2px for consistency. Zustand import path fixed.

## 0.1.0

Initial release — drop-in Mintlify replacement as a Vite plugin. Point your `vite.config.ts` at holocron and get a full documentation site from MDX files + a `docs.json` config file.

1. **Full Mintlify-compatible docs site from MDX** — reads `docs.json` (or `holocron.jsonc`) for navigation, tabs, groups, anchors, redirects, footer, banner, fonts, colors, SEO metadata, and favicon. Renders MDX pages with editorial typography, code blocks (Prism with all languages), callouts, tables, accordions, expandable fields, cards, steps, frames, panels, badges, tooltips, and more.

2. **React Server Components on Vite 8** — powered by spiceflow. Server-rendered pages with full client hydration, client-side navigation, and per-page loaders. No static site generation step required.

3. **Navigation with tabs, versions, and dropdowns** — supports `navigation.tabs` for switching sidebar content, `navigation.versions` for a version selector dropdown, and `navigation.dropdowns` (or `navigation.products`) for product-scoped navigation. Each switcher owns its own inner tab/group tree.

4. **Custom entry point support** — mount holocron as a child of your own spiceflow app to add custom API routes, middleware, and pages alongside your docs:
   ```ts
   import { createHolocronApp } from '@holocron.so/vite/app'
   const holocronApp = await createHolocronApp()
   const app = new Spiceflow().use(holocronApp)
   ```

5. **HMR for config and MDX** — editing MDX content, adding/removing pages, and changing `docs.json` all hot-reload without a full page refresh.

6. **AI agent support** — serves raw markdown at `/<page>.md` URLs, redirects AI user-agents (ClaudeBot, ChatGPT-User, etc.) to `.md` endpoints, exposes `/sitemap.xml` with `.md` hints, and bundles all docs as `/docs.zip` for bulk ingestion.

7. **Built-in icon atlas** — resolves Lucide and Font Awesome icons at build time into a virtual module. Icons render inline as SVGs that inherit `currentColor`. Supports emoji, URL, and structured `{ name, library }` icon objects.

8. **Image processing with pixelated placeholders** — local images get dimensions extracted and compact WebP placeholders generated at build time. Images render with a blur-to-sharp transition and click-to-zoom via `react-medium-image-zoom`.

9. **OG image generation** — auto-generates Open Graph PNG images per page using Takumi. Emits `og:image` and `twitter:image` meta tags.

10. **Generated fallback logo** — when no logo is configured, uses the hosted Holocron AI logo generator so fallback logos share the same Flux-based style as the dashboard.

11. **Sidebar search** — Orama full-text index over all pages with keyboard navigation, wrap-around, and visual highlight. Custom placeholder text via `search.prompt` config.

12. **Dark mode** — class-based dark mode with cookie persistence and a blocking `<script>` that prevents flash of wrong theme. Respects OS preference as fallback. Theme toggle button in navbar.

13. **CSS `@layer holocron`** — all Holocron styles are wrapped in a CSS layer so user styles can override without specificity fights. Uses shadcn v2 CSS variable convention (`--foreground`, `--primary`, `--border`, etc.) for full theme customization.

14. **Redirects** — config-driven URL redirects supporting exact match, named parameters (`:id`), and trailing wildcards (`*`). Query strings are preserved. Emits 301 status.

15. **Base path support** — set `base` in Vite config to mount the docs site under a subpath like `/docs`.

16. **Footer with socials** — configurable footer with logo, social icons (GitHub, Twitter/X, Discord, LinkedIn, etc.), and up to 4 link columns.

17. **Banner** — dismissible top banner with MDX content rendering and configurable background/text colors.

18. **Custom virtual modules** — override `virtual:holocron-config` and `virtual:holocron-pages` for programmatic control over navigation and page content.

19. **Sticky per-section asides** — `<Aside>` components scope their sticky behavior to the section they belong to. `<Aside full>` spans multiple sections. `RequestExample`/`ResponseExample` auto-widen the sidebar grid.

20. **404 page** — renders a styled 404 inside the editorial layout with the missing path, a link home, and `noindex` meta.
