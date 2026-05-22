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

## Relevant docs pages

Fetch `https://holocron.so/sitemap.xml` to see all available pages. Append `.md` to any page URL
to get raw markdown. Never pipe curl output through `head`, `tail`, `sed -n`, or any truncation
command. Read the full output every time.

```bash
curl -s https://holocron.so/sitemap.xml
curl -s https://holocron.so/docs/quickstart.md
```

When the user asks about a specific workflow, fetch the matching page directly:

- **Overview**: https://holocron.so/llms.txt
- **Quickstart**: https://holocron.so/docs/quickstart.md
- **What Holocron is**: https://holocron.so/docs/what-is-holocron.md
- **Create pages**: https://holocron.so/docs/create/pages.md
- **MDX syntax**: https://holocron.so/docs/create/mdx.md
- **Local imports**: https://holocron.so/docs/create/local-imports.md
- **Redirects**: https://holocron.so/docs/create/redirects.md
- **`docs.json` config**: https://holocron.so/docs/organize/docs-json.md
- **Config schema**: https://holocron.so/docs.json
- **Navigation**: https://holocron.so/docs/organize/navigation.md
- **Theme customization**: https://holocron.so/docs/customize/theme.md
- **Icons**: https://holocron.so/docs/customize/icons.md
- **Custom entry (Spiceflow)**: https://holocron.so/docs/custom-entry.md
- **Spiceflow integration**: https://holocron.so/docs/spiceflow.md
- **Cloudflare deploy**: https://holocron.so/docs/deploy/cloudflare.md
- **Node deploy**: https://holocron.so/docs/deploy/node.md
- **Holocron deploy**: https://holocron.so/docs/deploy/holocron.md
- **AI assistant docs**: https://holocron.so/docs/ai/assistant.md

```bash
curl -fsSL https://holocron.so/docs/quickstart.md
curl -fsSL https://holocron.so/docs/organize/docs-json.md
```

## Scaffolding a new project

Use the CLI to create a new docs site with a working template:

```bash
npx -y @holocron.so/cli create --name "My Docs" my-docs --skip-auth
```

The `--skip-auth` flag skips cloud setup & AI chat setup (suitable for agents and local-only
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
easier to maintain.

Always fetch the schema before adding uncommon config fields:

```bash
curl -fsSL https://holocron.so/docs.json
```

Simple `docs.jsonc`:

```jsonc
{
  "$schema": "https://holocron.so/docs.json",
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
links.

## Icons

Use **prefixed icon names** so the source library is explicit:

```jsonc
"icon": "lucide:rocket"
"icon": "fontawesome:brands:github"
```

Plain names resolve against the configured library. See
https://holocron.so/docs/customize/icons.md for the full reference.

If a group has an icon, do not use the same icon on the first page in that
group. It looks like a duplicate in the navigation tree.

## Local imports

MDX pages can import `.md`, `.mdx`, `.tsx`, or `.ts` files. Prefer **relative
imports** (`./` or `../`) over absolute `/` imports. For example, import a root
README as the index page:

```mdx
---
title: My Project
---

import Readme from '../../README.md'

<Readme />
```

See https://holocron.so/docs/create/local-imports.md for details.

## MDX JSX in README files

Do **not** use MDX JSX components (like `<Aside>`, `<Note>`, `<CardGroup>`,
`<Card>`, etc.) inside `README.md`. GitHub does not render markdown inside
unknown HTML tags; content inside them appears as raw unformatted text.

The README should use only standard markdown. MDX-specific components belong in
the `.mdx` file that imports the README, not in the README itself.

## Page frontmatter

Every MDX page can include YAML frontmatter. See
https://holocron.so/docs/create/pages.md for the full fields reference.

```mdx
---
$schema: https://holocron.so/frontmatter.json
title: Quickstart
description: Build and deploy your first Holocron docs site.
icon: lucide:rocket
tag: NEW
---
```

## Redirects

When restructuring docs, add redirects in `docs.json`. See
https://holocron.so/docs/create/redirects.md for the full reference.

## Broken link detection

Holocron warns about internal links pointing to non-existent pages during build
and dev. Links to redirect sources and static files (`.json`, `.pdf`, etc.) are
not flagged. The warning includes the **source page**, **line number**, and the
broken href so you can find and fix it quickly.

### Suppressing false positives with `knownPaths`

When docs are mounted alongside other routes (API endpoints, dashboards, blogs),
internal links to those non-MDX paths trigger false broken-link warnings. Use
the **`knownPaths`** field in `docs.json` to tell Holocron these paths are valid:

```jsonc
{
  "knownPaths": ["/api/*", "/dashboard", "/blog/*"]
}
```

**Supported patterns:**

- **Exact paths** — `"/dashboard"` matches only `/dashboard`.
- **Wildcard prefixes** — `"/api/*"` matches `/api/users`, `/api/v2/health`,
  and any other path starting with `/api/`.

Wildcards only work as a trailing `/*` suffix. Glob patterns like `/api/*/users`
are not supported.

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

### Where to put new content

The real docs live in **`website/src/pages/docs/`**, not `example/src/`. The `example/`
folder is a demo fixture, not the published docs site.

Before adding or editing docs content, **always read `website/docs.json`** first
to see the full navigation tree and existing pages. Then decide:

1. Does an existing page already cover this topic? Add a section there.
2. Is the topic distinct enough for its own page? Create a new `.mdx` file and
   add it to the best group in `website/docs.json`.

Never append unrelated sections to a page just because it was the last file you
had open. Match the topic to the right page or create a new one.

## Feedback loop

After editing MDX pages, `docs.json` navigation, or frontmatter, always **build the site** to
catch issues early. The build surfaces broken internal links, MDX parsing errors, missing pages
referenced in navigation, and rendering problems that the dev server may not show until a page
is visited.

```bash
pnpm build
```

Fix any warnings or errors before considering the changes done. Common issues:

- **Broken links** — an internal `[link](/some-page)` pointing to a slug not in navigation.
- **MDX parse errors** — malformed JSX, unclosed tags, or invalid frontmatter YAML.
- **Missing pages** — a slug listed in `docs.json` navigation but no matching `.mdx` file exists.
- **Rendering errors** — components used incorrectly (e.g. wrong props, missing children).

If the build warns about links to paths that are **not MDX pages but do exist** at runtime (API
routes, external apps mounted alongside docs, dashboard pages), suppress those warnings with
the `knownPaths` field in `docs.json`. See the [Broken link detection](#broken-link-detection)
section above.

## CLI overview

Run `--help` to see all available commands. Never truncate the output.

```bash
npx -y @holocron.so/cli --help
```

Key commands: `login`, `logout`, `whoami`, `deploy`, `projects list`,
`projects create`, `keys list`, `keys create`, `keys delete`, `create`.

Before logging in, always check if the user is already authenticated:

```bash
npx -y @holocron.so/cli whoami
```

If `whoami` succeeds and shows user, orgs, and projects, skip login. Only run
`npx -y @holocron.so/cli login` if `whoami` fails.

## Deploy

`holocron deploy` builds the docs site and uploads it to holocron.so hosting.
It is the fastest way to publish without managing your own server.

```bash
npx -y @holocron.so/cli deploy
```

The command runs the build, uploads only changed files, finalizes the deployment,
and prints the live URL. Use `--project prj_xxx` if the account has multiple
projects and you are using session auth. Use `--branch <name>` to override
branch detection for preview deploys.

**Auth priority:** `HOLOCRON_KEY` env var > session token from `holocron login` >
GitHub Actions OIDC token (automatic in GitHub Actions with `id-token: write`).

See https://holocron.so/docs/deploy/holocron.md for the full reference including
deployment URLs, GitHub Actions OIDC setup, and org/project resolution.

Always deploy preview before production. If preview fails, stop.

## Icon consistency

When adding icons to any element in `docs.json` or MDX frontmatter, apply them **consistently across all siblings** at the same level. Inconsistent icon usage looks unfinished and breaks visual rhythm.

**Rules:**

- **Tabs**: if one tab has an icon, every tab must have an icon.
- **Groups**: if one sidebar group has an icon, every sibling group in the same tab should have one.
- **Anchors**: if one anchor in `navigation.global.anchors` has an icon, all anchors must.
- **Pages**: if one page in a group has a frontmatter `icon`, all pages in that group should. Exception: a group with only 1-2 pages where icons add no navigational value.
- **Cards / CardGroup**: if one `<Card>` in a `<CardGroup>` has an `icon` prop, every card in that group must.
- **Accordion / AccordionGroup**: same rule. Either all items have icons or none do.

When reviewing or creating navigation and MDX content, scan siblings and fill in missing icons before finishing. Pick icons from the same library (usually Lucide) and choose semantically distinct icons for each item.

## Writing style for MDX pages

### Bold keywords for skimmability

Every section and every paragraph must have at least **one bold keyword or phrase**. Readers skim docs pages; they do not read every word. Bold text acts as anchor points that let the eye jump to the relevant paragraph.

Pick the word or phrase that captures the core idea. Do not bold entire sentences or generic filler words. Bold the specific term, API name, or concept that a reader would scan for.

### Use Aside frequently for side content

Use `<Aside>` often to place supplementary content in the right sidebar column. Asides break the monotony of a single-column text flow and give readers contextual notes exactly where they are relevant. A page with zero asides looks flat and underuses the layout.

Good candidates for Aside content:

- **Tips and gotchas** that relate to the current section but are not part of the main narrative
- **Version notes** or compatibility warnings
- **Links to related pages** or external references
- **Short code snippets** showing an alternative approach or edge case
- **Definitions or clarifications** of a term introduced in the main text

Always wrap Aside content in a framed component (`Note`, `Tip`, `Info`, `Warning`, `Callout`).

```mdx
## Authentication

The deploy command authenticates via **GitHub Actions OIDC** when running in CI.

<Aside>
<Info>
If OIDC is not available, fall back to a **`HOLOCRON_KEY`** environment variable
or a session token from `holocron login`.
</Info>
</Aside>
```

Aim for roughly **one Aside per major section** (per `##` heading). Not every section needs one, but if a page has more than three `##` sections without a single Aside, look for opportunities.

### Use diagrams to explain architecture and flows

Use ASCII diagrams frequently in MDX pages. Always use the **`diagram`** language hint on the code fence. Holocron renders `diagram` fences with special styling; Unicode box-drawing characters and arrows get colored differently from labels.

**Layout rules:**

- Diagrams should try to cover the **full width of the content column**, roughly **94 characters** wide.
- Never exceed 94 characters per line.
- Prefer a **varied, organic layout**. Mix plain text labels, boxes for major components, and directional arrows.
- All connections must use **directional arrows**. Never use plain lines without an arrowhead.
- Verify alignment by counting characters precisely.

````mdx
```diagram
                     ┌───────────────┐
   docs.jsonc ──────►│  Vite Plugin  │──────► Build Output
                     └───────┬───────┘
                             │
                     ┌───────▼───────┐
                     │   sync.ts     │       MDX files ──► parsed sections
                     │  (walk nav)   │       git SHA diff ──► cache hit/miss
                     └───────┬───────┘
                             │
               ┌─────────────┼─────────────┐
               ▼             ▼             ▼
          navigation     page cache    virtual modules
          tree.json      holocron-     holocron-pages
                         mdx.json     holocron-config
```
````

## Agent rules

- Prefer the latest fetched docs over anything remembered from previous sessions.
- Keep rule-like project behavior in this skill so agents see it even before
  fetching the full docs.
- All ASCII diagrams in MDX pages must use the `diagram` language hint on the
  code fence (` ```diagram `). This renders them with proper styling on the
  website instead of plain monospace.
- Never pipe curl or `--help` output through `head`, `tail`, or any truncation
  command. Always read the full output.
