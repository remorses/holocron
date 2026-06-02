<div align='center' class="hidden">
    <br/>
    <br/>
    <h3>holocron</h3>
    <p>Delightful docs. Mintlify drop-in replacement as a Vite plugin.</p>
    <br/>
    <br/>
</div>

Holocron turns MDX pages and a `docs.json` config into a full documentation site. It runs as a **Vite plugin**, builds locally, and deploys anywhere.

Designed as a **Mintlify-compatible replacement**: same config shape, same MDX components, same frontmatter fields. If you have a Mintlify project, you can migrate in about 2 minutes.

## Install skill for AI agents

```bash
npx -y skills add remorses/holocron
```

This installs [skills](https://skills.sh) for AI coding agents like
Claude Code, Cursor, Windsurf, and others. Skills teach agents the
workflows, patterns, and tools specific to this project.

## Quickstart

Scaffold a new project with the CLI:

```bash
npx -y @holocron.so/cli create
```

This creates a working docs site with sample pages, navigation, and a `vite.config.ts`. Run `pnpm install && pnpm dev` and you're live.

### Manual setup

```bash
pnpm add @holocron.so/vite react react-dom vite
```

Create a `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import { holocron } from '@holocron.so/vite'

export default defineConfig({
  plugins: [holocron()],
})
```

The plugin auto-adds Spiceflow, Tailwind CSS, and React. No extra setup needed.

Create a `docs.json` at the project root:

```json
{
  "name": "My Docs",
  "colors": { "primary": "#6366f1" },
  "navigation": [
    {
      "group": "Getting Started",
      "pages": ["index"]
    }
  ]
}
```

Write your first page as `index.mdx`:

```mdx
---
title: Welcome
description: My documentation site.
---

# Welcome

This is my first Holocron page.
```

Run the dev server:

```bash
npx vite
```

Open `http://localhost:5173` and you should see your docs site.

Build for production:

```bash
npx vite build
node dist/rsc/index.js
```

## What you get

- **Local builds** with `vite build`, deploy the output anywhere
- **Mintlify-compatible** `docs.json` schema and MDX components
- **OpenAPI** reference pages generated from your spec
- **Search** powered by Orama, built into the sidebar
- **Dark mode** with system detection and manual toggle
- **AI exports** for agents: `.md` per page, `/llms.txt`, `/docs.zip`, skill discovery
- **React Server Components** under the hood via Spiceflow and Vite

## Holocron vs Mintlify

| Area | Mintlify | Holocron |
|------|----------|----------|
| **Hosting** | Cloud only | Self-hosted, or [holocron.so](/docs/deploy/holocron) managed hosting |
| **Build** | Cloud build on push | Local `vite build`, standard CI |
| **Pricing** | Starts at $150/mo | Free, open source ([MIT](./LICENSE)) |
| **Git workflow** | Mintlify-managed deploys | Standard git: PRs, branches, diffs |
| **Config** | `docs.json` | Same `docs.json` (compatible) |
| **Components** | Proprietary MDX set | Same components, open source |
| **API reference** | Interactive playground | Read-only API reference from OpenAPI |
| **Search** | Algolia / built-in | Orama (local, zero config) |
| **Custom domains** | Dashboard setting | Your hosting provider |
| **Analytics** | Built-in dashboard | Bring your own |
| **AI exports** | `/llms.txt`, `.md` routes | `/llms.txt`, `/docs.zip`, `.md` routes, skill discovery |
| **Custom routes** | Not possible | Mount alongside a Spiceflow app |
| **Framework** | Proprietary | Vite + React Server Components |

Holocron accepts unknown Mintlify fields via `.passthrough()`, so you can paste a full Mintlify `docs.json` without validation errors. Fields Holocron does not consume are silently ignored.

## Migration from Mintlify

In your existing Mintlify docs directory:

**1. Install dependencies**

```bash
pnpm add @holocron.so/vite react react-dom vite
```

**2. Create vite.config.ts**

```ts
import { defineConfig } from 'vite'
import { holocron } from '@holocron.so/vite'

export default defineConfig({
  plugins: [holocron()],
})
```

**3. Keep your docs.json**

Your existing `docs.json` works as-is. Holocron's schema accepts unknown Mintlify fields; the runtime ignores fields it does not consume.

**4. Run it**

```bash
npx vite
```

Your site should render at `http://localhost:5173`.

### What transfers directly

- **Navigation**: tabs, groups, pages, anchors, versions, dropdowns, products
- **MDX components**: Accordions, Cards, Callouts, Steps, Tabs, Code Groups, Expandables
- **Frontmatter**: `title`, `description`, `icon`, `sidebarTitle`, `tag`, `hidden`, `deprecated`
- **Config**: `colors`, `logo`, `favicon`, `navbar`, `footer`, `redirects`, `appearance`, `fonts`, `banner`
- **OpenAPI tabs**: `{ "tab": "API Reference", "openapi": "openapi.json" }` generates pages from your spec

### What is different

| Area | Mintlify | Holocron |
|------|----------|----------|
| Hosting | Mintlify cloud | Self-hosted (Node.js or Cloudflare Workers) |
| Build | Cloud build on push | Local `vite build` |
| API playground | Interactive playground | Read-only API reference |
| Analytics | Built-in dashboard | Bring your own |
| Custom domains | Dashboard setting | Your hosting provider |
| Search | Algolia/built-in | Orama (local, built-in) |

## How it works

```diagram
  docs.json + MDX files
          │
          ▼
  ┌────────────────┐
  │  Vite Plugin   │  reads config, syncs navigation tree, processes MDX
  │  (holocron())  │
  └───────┬────────┘
          │
          ▼
  ┌────────────────┐
  │   Spiceflow    │  React Server Components framework
  │   + Tailwind   │  auto-added by the plugin
  └───────┬────────┘
          │
          ▼
  Full docs site with search, OpenAPI, dark mode, AI exports
```

The plugin reads your config file, walks the navigation tree to discover MDX pages, and generates virtual modules that the Spiceflow app consumes at render time. Only changed files get re-parsed on subsequent builds thanks to a git-SHA-based cache.

## Deploy

### Holocron hosting

The fastest way to get a live URL. Builds and uploads your site to `holocron.so`:

```bash
npx -y @holocron.so/cli deploy
```

In **GitHub Actions**, the deploy command uses OIDC tokens automatically (no API key needed). Add `permissions: id-token: write` to your workflow.

### Node.js

```bash
npx vite build
node dist/rsc/index.js
```

The build output is a standard Node.js server. Deploy it to any platform that runs Node.

### Cloudflare Workers

```bash
npx vite build
npx wrangler deploy
```

See [Cloudflare deploy docs](/docs/deploy/cloudflare) for `wrangler.jsonc` setup.

## AI-readable docs

Every Holocron site generates AI-friendly endpoints out of the box:

- **`.md` routes**: append `.md` to any page URL to get raw markdown. `https://your-site.com/quickstart.md`
- **`/llms.txt`**: an index of all pages with titles and `.md` URLs. Agents read this to discover the site structure.
- **`/docs.zip`**: download every page as a `.md` file in one zip. Agents can grep it locally.
- **Skill discovery**: `/.well-known/agent-skills/index.json` exposes your docs as an installable AI skill.

```bash
curl https://your-site.com/llms.txt
curl -L https://your-site.com/docs.zip -o docs.zip
```

## Project structure

```diagram
my-docs/
├── index.mdx           # pages are MDX files
├── guides/
│   ├── install.mdx
│   └── deploy.mdx
├── docs.json           # navigation and config
├── vite.config.ts      # one-line plugin setup
├── package.json
└── public/             # static assets (logos, images)
```

## Explore

Full documentation at **[holocron.so](https://holocron.so)**.

- [Quickstart](/docs/quickstart)
- [Navigation](/docs/organize/navigation): tabs, groups, pages, anchors, versions, dropdowns
- [Theme and Colors](/docs/customize/theme): shadcn-compatible CSS variables
- [OpenAPI Reference](/docs/api-docs/openapi): generate API docs from a spec
- [MDX Components](/docs/components): Accordions, Cards, Callouts, Steps, Tabs, and more
- [Deploy](/docs/deploy/node): Node.js, Cloudflare Workers, and holocron.so hosting

## License

[MIT](./LICENSE). If you use Holocron for your docs, please keep the "Powered by Holocron" footer link. It helps others discover the project.
