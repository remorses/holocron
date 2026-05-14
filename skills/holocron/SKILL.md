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

Useful searches:

```bash
grep -R "project" "$DOCS_DIR"
grep -R "docs.json" "$DOCS_DIR"
grep -R "deploy" "$DOCS_DIR"
grep -R "navigation" "$DOCS_DIR"
grep -R "OpenAPI" "$DOCS_DIR"
```

## Always fetch the relevant how-to page

When the user asks about a specific workflow, fetch the matching markdown page
directly in addition to the docs zip.

- **Overview**: https://holocron.so/llms.txt
- **Quickstart / create a docs site**: https://holocron.so/quickstart.md
- **What Holocron is**: https://holocron.so/what-is-holocron.md
- **Create pages**: https://holocron.so/create/pages.md
- **MDX syntax**: https://holocron.so/create/mdx.md
- **Local imports**: https://holocron.so/create/local-imports.md
- **`docs.json` config**: https://holocron.so/organize/docs-json.md
- **Config schema**: https://unpkg.com/@holocron.so/vite/src/schema.json
- **Navigation**: https://holocron.so/organize/navigation.md
- **Navigation tabs**: https://holocron.so/organize/navigation.md
- **Theme customization**: https://holocron.so/customize/theme.md
- **Cloudflare deploy**: https://holocron.so/deploy/cloudflare.md
- **Node deploy**: https://holocron.so/deploy/node.md
- **AI assistant docs**: https://holocron.so/ai/assistant.md

Example:

```bash
curl -fsSL https://holocron.so/quickstart.md
curl -fsSL https://holocron.so/organize/docs-json.md
curl -fsSL https://unpkg.com/@holocron.so/vite/src/schema.json
```

## `docs.jsonc` basics

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
  "logo": {
    "light": "/logo-light.svg",
    "dark": "/logo-dark.svg"
  },
  "navigation": [
    {
      "group": "Get started",
      "pages": ["index", "quickstart"]
    },
    {
      "group": "Guides",
      "pages": ["guides/install", "guides/deploy"]
    }
  ]
}
```

Page slugs in `navigation.pages` map to MDX files. For example `quickstart`
loads `quickstart.mdx`, and `guides/install` loads `guides/install.mdx`.

## Page frontmatter

Every MDX page can include YAML frontmatter. Keep it concise and only add fields
that change rendering, SEO, or navigation.

```mdx
---
title: Quickstart
description: Build and deploy your first Holocron docs site.
icon: rocket
tag: NEW
---

# Quickstart
```

Common fields:

- **`title`** — page title for sidebar, browser tab, and generated heading.
- **`description`** — page description for SEO and social previews.
- **`icon`** — sidebar icon name. Supports configured icon library names.
- **`sidebarTitle`** — shorter title just for sidebar navigation.
- **`tag`** — small sidebar badge like `NEW` or `BETA`.
- **`deprecated`** — marks the page as deprecated in navigation.
- **`api`** — Mintlify API page label like `GET /users`.
- **`hidden`** — hides the page from sidebar and adds `noindex`.
- **`noindex`** — keeps the page visible but adds robots `noindex`.
- **`robots`** — custom robots meta value.
- **`keywords`** — search and metadata keywords.
- **`cache-control`** — custom response cache header.
- **`og:title`**, **`og:description`**, **`og:image`** — OpenGraph metadata.
- **`twitter:title`**, **`twitter:description`**, **`twitter:image`** — Twitter card metadata.

## Icons

The default icon library is **Font Awesome**. To use Lucide icons instead, set
the icon library in `docs.jsonc`:

```jsonc
{
  "icons": {
    "library": "lucide"
  }
}
```

Icon names like `home`, `zap`, `file-text`, and `panel-left` are Lucide names
and will not resolve with the default Font Awesome library.

If a group has an icon, do not use the same icon on the first page in that
group. It looks like a duplicate icon in the navigation tree.

If cards use icons, use icons for every card in the group. Mixing icon and
non-icon cards looks broken.

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
navigation. Pages not in the navigation tree will not appear in the sidebar.

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
