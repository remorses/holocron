---
title: Holocron
description: Mintlify drop-in open source replacement as a Vite plugin. Use it to create documentation websites.
---

## Page frontmatter reference

Every MDX page supports YAML frontmatter. The schema uses `.passthrough()` so unknown fields are preserved. Source of truth: `vite/src/lib/page-frontmatter.ts`.

- **`title`** (string) — Page title for sidebar, browser tab, and auto-injected `<h1>`. Falls back to first heading, then `"Untitled"`.
- **`description`** (string) — Page description for `<meta name="description">` and OpenGraph. Falls back to site-level description.
- **`icon`** (string) — Icon name shown next to the page in the sidebar. Uses the configured library (Font Awesome or Lucide). Supports `library:name` format like `fontawesome:brands:discord`.
- **`sidebarTitle`** (string) — Overrides the title shown in sidebar navigation (useful when the full title is too long).
- **`tag`** (string) — Small badge next to the page in sidebar (e.g. `BETA`, `NEW`). Only shows when `api` is not set.
- **`deprecated`** (boolean) — Adds a `Deprecated` badge next to the page in the sidebar.
- **`api`** (string) — Mintlify API page convention. Set to `"METHOD /path"` (e.g. `"GET /users"`). The HTTP method renders as a colored badge in the sidebar.
- **`hidden`** (boolean) — Hides the page from sidebar and adds `noindex` robots tag. Page remains routable by URL.
- **`noindex`** (boolean) — Adds `<meta name="robots" content="noindex">` but keeps the page visible in sidebar.
- **`robots`** (string) — Custom `<meta name="robots">` value (e.g. `noarchive`, `nofollow`).
- **`keywords`** (string[]) — Rendered as `<meta name="keywords">`. Also boosts the page in Holocron sidebar search.
- **`gridGap`** (number) — Overrides horizontal gap (px) between content and sidebars. Default `60`, OpenAPI pages use `30`.
- **`cache-control`** (string) — Custom `Cache-Control` header on page response. Default: `s-maxage=300, stale-while-revalidate=86400`.
- **`og:title`** (string) — OpenGraph title. Defaults to `{title} — {siteName}`.
- **`og:description`** (string) — OpenGraph description. Defaults to page `description`.
- **`og:image`** (string) — OpenGraph image URL. Defaults to auto-generated OG image.
- **`og:url`** (string) — Canonical URL for the page.
- **`og:type`** (string) — OpenGraph type (e.g. `article`).
- **`og:image:width`** (string | number) — OG image width in pixels.
- **`og:image:height`** (string | number) — OG image height in pixels.
- **`twitter:title`** (string) — Twitter card title. Defaults to `og:title`.
- **`twitter:description`** (string) — Twitter card description. Defaults to `og:description`.
- **`twitter:image`** (string) — Twitter card image. Defaults to `og:image`.
- **`twitter:card`** (string) — Card type: `summary` or `summary_large_image` (default).
- **`twitter:site`** (string) — Twitter handle for the site (e.g. `@mycompany`).
- **`twitter:image:width`** (string | number) — Twitter image width in pixels.
- **`twitter:image:height`** (string | number) — Twitter image height in pixels.

## Icons

The default icon library is **Font Awesome** (`fontawesome`). To use Lucide icons instead, set `"icons": { "library": "lucide" }` in `docs.json`. Icon names like `home`, `zap`, `file-text`, `panel-left` are Lucide names and won't resolve with the default Font Awesome library.

If you add an icon to a page group don't use the same icon to the first page. This will look like there are 2 duplicate icons in the navigation tree.

If you use icons in cards components use it for all items, not only some. Otherwise it will look bad.

## MDX authoring: multi-line container components

Always use multi-line form for container components (Callout, Note, Warning, Info, Tip, Check, Danger, Aside, Accordion, Steps, Card, Expandable, Panel, Frame, Prompt, etc.). Put content on its own line with a newline after the opening tag. Single-line form produces bare phrasing children without paragraph wrapping.

```mdx
<Note>
Use `Note` for neutral supporting information.
</Note>
```

## Aside must always contain a component

`<Aside>` is positioning-only with no visual frame. Always wrap content in `<Note>`, `<Tip>`, `<Info>`, `<Warning>`, `<Callout>`, or another framed component. Exception: `<Aside full>` with `<TableOfContentsPanel />`.

```mdx
<Aside>

<Note>
This appears in the sidebar with a proper callout frame.
</Note>

</Aside>
```

## New MDX pages must be added to docs.json navigation

After creating a new `.mdx` file, add its slug to `docs.json` navigation. Pages not in the navigation tree won't appear in the sidebar. Read the existing structure and pick the best tab, group, and position within reading order.

## Deployment

Use **Sigillo** for deployment secrets. Deployment scripts for D1-backed Cloudflare Workers must run the remote D1 migration before building or deploying the worker, and the migration script must print a Unix timestamp first so D1 time travel has a known restore point if something goes wrong.

```json
{
  "scripts": {
    "db:migrate:prod": "echo \"D1 pre-migration timestamp: $(date +%s)\" && CI=1 wrangler d1 migrations apply DB --remote",
    "db:migrate:preview": "echo \"D1 pre-migration timestamp: $(date +%s)\" && CI=1 wrangler d1 migrations apply DB --remote --env preview",
    "deployment": "CLOUDFLARE_ENV=preview sigillo run -c preview --command 'pnpm db:migrate:preview && vite build && wrangler deploy --env preview'",
    "deployment:prod": "sigillo run -c prod --command 'pnpm db:migrate:prod && vite build && wrangler deploy'"
  }
}
```

Always deploy **preview before production**. If preview migration or deploy fails, stop and do not continue to production.

`CI=1` is intentional for remote D1 migrations. Wrangler skips the interactive confirmation prompt in non-interactive/CI mode while still creating the pre-migration backup.
