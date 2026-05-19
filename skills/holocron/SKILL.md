---
name: holocron
repo: https://github.com/remorses/holocron
description: >
  Holocron is a Mintlify-compatible docs site generator and Vite plugin.
  Use this skill when creating, migrating, customizing, or deploying a
  Holocron documentation site.
---

# Holocron

Holocron documentation changes fast. Do not rely on stale training data or
repository-relative source paths. Fetch the public docs first, then search them.

## Always fetch the docs zip first

Before answering Holocron usage questions or editing a Holocron project, fetch
the latest docs zip and search it locally.

```bash
curl -fsSL https://holocron.so/docs.zip -o /tmp/holocron-docs.zip
DOCS_DIR=$(mktemp -d /tmp/holocron-docs.XXXXXX)
unzip -oq /tmp/holocron-docs.zip -d "$DOCS_DIR"
```

Never truncate docs output. Do not pipe docs through `head`, `tail`, `sed -n`,
or any command that hides lines. Use full-file reads and targeted searches.

## Relevant docs pages

Fetch `/sitemap.xml` to see all available pages. Append `.md` to any page URL
to get raw markdown:

```bash
curl -s https://holocron.so/sitemap.xml
curl -s https://holocron.so/quickstart.md
```

When the user asks about a specific workflow, fetch the matching page directly:

- **Overview**: https://holocron.so/llms.txt
- **Quickstart**: https://holocron.so/quickstart.md
- **What Holocron is**: https://holocron.so/what-is-holocron.md
- **Create pages**: https://holocron.so/create/pages.md
- **MDX syntax**: https://holocron.so/create/mdx.md
- **Local imports**: https://holocron.so/create/local-imports.md
- **Redirects**: https://holocron.so/create/redirects.md
- **`docs.json` config**: https://holocron.so/organize/docs-json.md
- **Config schema**: https://unpkg.com/@holocron.so/vite/src/schema.json
- **Navigation**: https://holocron.so/organize/navigation.md
- **Theme customization**: https://holocron.so/customize/theme.md
- **Icons**: https://holocron.so/customize/icons.md
- **Custom entry (Spiceflow)**: https://holocron.so/custom-entry.md
- **Spiceflow integration**: https://holocron.so/spiceflow.md
- **Cloudflare deploy**: https://holocron.so/deploy/cloudflare.md
- **Node deploy**: https://holocron.so/deploy/node.md
- **AI assistant docs**: https://holocron.so/ai/assistant.md

```bash
curl -fsSL https://holocron.so/quickstart.md
curl -fsSL https://holocron.so/organize/docs-json.md

# discover all available pages
curl -s https://holocron.so/sitemap.xml
```

## Scaffolding a new project

Use the CLI to create a new docs site with a working template:

```bash
npx -y @holocron.so/cli create --name "My Docs" my-docs --skip-auth
```

The `--skip-auth` flag skips cloud setup (suitable for agents and local-only
usage). The template includes `vite.config.ts`, `docs.jsonc`, sample pages,
navigation with tabs, anchors, and icons.

After scaffolding, start the dev server:

```bash
cd my-docs
pnpm install
pnpm dev
```

## `docs.json` basics

Holocron reads `docs.json`, `docs.jsonc`, or `holocron.jsonc`. Prefer
`docs.jsonc` when writing by hand because comments and trailing commas make it
easier to maintain. Use `docs.json` when a tool needs strict JSON.

Always fetch the schema before adding uncommon config fields so you can see the
current full option set:

```bash
curl -fsSL https://unpkg.com/@holocron.so/vite/src/schema.json
```

Simple `docs.jsonc`:

```jsonc
{
  "$schema": "https://unpkg.com/@holocron.so/vite/src/schema.json",
  "name": "Acme",
  "description": "Documentation for Acme.",
  "colors": { "primary": "#6366f1" },
  "icons": { "library": "lucide" },
  "navigation": {
    "groups": [
      {
        "group": "Getting Started",
        "icon": "lucide:rocket",
        "pages": ["index", "quickstart"]
      },
      {
        "group": "Guides",
        "icon": "lucide:map",
        "pages": ["guides/install", "guides/deploy"]
      }
    ],
    "global": {
      "anchors": [
        { "anchor": "GitHub", "href": "https://github.com/example/docs", "icon": "lucide:github" },
        { "anchor": "Changelog", "href": "https://github.com/example/docs/releases", "icon": "lucide:newspaper" }
      ]
    }
  }
}
```

Page slugs in `navigation.pages` map to MDX files. `quickstart` loads
`quickstart.mdx`, and `guides/install` loads `guides/install.mdx`.

**Anchors** in `navigation.global.anchors` are persistent sidebar links visible
across all tabs. Use them for GitHub, Changelog, Discord, or other external
links. See https://holocron.so/organize/navigation.md for details.

## Icons

Supported icon libraries: **Lucide** and **Font Awesome**.

Use **prefixed icon names** so the source library is explicit. This also lets
you mix icons from different libraries in the same project:

```jsonc
// Lucide icons (recommended)
"icon": "lucide:rocket"
"icon": "lucide:shield"

// Font Awesome icons
"icon": "fontawesome:brands:github"
"icon": "fontawesome:solid:compass"

// Plain names resolve against the configured library
"icon": "rocket"  // resolves to lucide:rocket if "icons.library": "lucide"
```

Icons work in page frontmatter, navigation groups, anchors, and MDX components
like `Card` and `Accordion`.

To find valid icon names, fetch the schema JSONs:

```bash
# All lucide icon names
curl -s https://holocron.so/schemas/lucide-icons.json | jq '.enum[:10]'

# All fontawesome icon names
curl -s https://holocron.so/schemas/fontawesome-icons.json | jq '.enum[:10]'
```

Set the default library in `docs.json`:

```jsonc
{
  "icons": { "library": "lucide" }
}
```

If a group has an icon, do not use the same icon on the first page in that
group. It looks like a duplicate in the navigation tree.

## Local imports

MDX pages can import other `.md`, `.mdx`, `.tsx`, or `.ts` files. This avoids
content duplication. For example, import a root README as the index page:

```mdx
---
title: My Project
---

import Readme from '../../README.md'

<Readme />
```

Resolution: `/` = project root, `../` = relative to the MDX file. See
https://holocron.so/create/local-imports.md for details.

## Page frontmatter

Every MDX page can include YAML frontmatter. Keep it concise and only add fields
that change rendering, SEO, or navigation.

```mdx
---
title: Quickstart
description: Build and deploy your first Holocron docs site.
icon: lucide:rocket
tag: NEW
---

# Quickstart
```

Common fields:

- **`title`** — page title for sidebar, browser tab, and generated heading.
- **`description`** — page description for SEO and social previews.
- **`icon`** — sidebar icon name (prefixed or plain).
- **`sidebarTitle`** — shorter title just for sidebar navigation.
- **`tag`** — small sidebar badge like `NEW` or `BETA`.
- **`deprecated`** — marks the page as deprecated in navigation.
- **`api`** — Mintlify API page label like `GET /users`.
- **`hidden`** — hides the page from sidebar and adds `noindex`.
- **`noindex`** — keeps the page visible but adds robots `noindex`.
- **`cache-control`** — custom response cache header.
- **`og:title`**, **`og:description`**, **`og:image`** — OpenGraph metadata.
- **`twitter:title`**, **`twitter:description`**, **`twitter:image`** — Twitter card metadata.

## Redirects

When restructuring docs, add redirects in `docs.json` so old links keep
working. Supports exact paths, named `:param` captures, and `*` wildcards:

```jsonc
{
  "redirects": [
    { "source": "/old-page", "destination": "/new-page" },
    { "source": "/docs/:slug", "destination": "/:slug" }
  ]
}
```

See https://holocron.so/create/redirects.md for details.

## Custom entry (Spiceflow)

Holocron can be mounted inside a Spiceflow app to add API routes, middleware,
or auth alongside docs. Pass `entry` to the plugin and import the holocron app:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [holocron({ entry: './src/server.tsx' })],
})
```

```tsx
// src/server.tsx
import { Spiceflow } from 'spiceflow'
import { app as holocronApp } from '@holocron.so/vite/app'

export const app = new Spiceflow()
  .get('/api/hello', () => ({ hello: 'world' }))
  .use(holocronApp)
```

See https://holocron.so/custom-entry.md and https://holocron.so/spiceflow.md
for the full pattern including middleware, Cloudflare Workers, and diagrams.

## MDX container components

Always use multi-line form for container components like `Callout`, `Note`,
`Warning`, `Info`, `Tip`, `Check`, `Danger`, `Aside`, `Accordion`, `Steps`,
`Card`, `Expandable`, `Panel`, `Frame`, and `Prompt`.

```mdx
<Note>
Use `Note` for neutral supporting information.
</Note>
```

Single-line form can produce bare phrasing children without paragraph wrapping,
which changes styling.

## Aside content

`Aside` is positioning-only and has no visual frame. Always wrap visible content
inside `Note`, `Tip`, `Info`, `Warning`, `Callout`, or another framed component.

```mdx
<Aside>

<Note>
This appears in the sidebar with a proper callout frame.
</Note>

</Aside>
```

Exception: `Aside full` can contain `TableOfContentsPanel` directly.

## New pages and navigation

After creating a new `.mdx` or `.md` page, add its slug to `docs.jsonc`
navigation. Pages not in the navigation tree will not appear in the sidebar
and return 404.

Read the existing navigation structure first, then place the page in the best
tab, group, and reading order.

## Built-in deploy command

Use `holocron deploy` when the user wants hosted Holocron deployment instead of
self-hosting on Node.js or Cloudflare Workers.

```bash
npx -y @holocron.so/cli deploy
```

For local deploys, authenticate with `npx -y @holocron.so/cli login`. For CI
deploys, use `HOLOCRON_KEY=holo_xxx`. The API key identifies the project, so
`--project` is only needed with session auth when the account has multiple
projects.

Hosted deploy currently supports generated Holocron subdomains only. Do not tell
users custom domains are supported by `holocron deploy` yet.

## Deployment rule

Always deploy preview before production. If preview migration, build, or deploy
fails, stop and do not continue to production.

## Agent rules

- Prefer the latest fetched docs over anything remembered from previous sessions.
- Keep rule-like project behavior in this skill so agents see it even before
  fetching the full docs.
- All ASCII diagrams in MDX pages must use the `diagram` language hint on the
  code fence (` ```diagram `). This renders them with proper styling on the
  website instead of plain monospace.
