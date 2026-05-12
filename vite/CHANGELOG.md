# @holocron.so/vite

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
     - run: npx holocron deploy
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
