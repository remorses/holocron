# @holocron.so/vite

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

10. **Generated fallback logo** — when no logo is configured, generates a text-based logo PNG using the Bagnard font via Takumi, with light and dark variants.

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
