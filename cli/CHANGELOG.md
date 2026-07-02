## 0.20.1

1. **Diagram fixer handles cross junctions and mixed borders** — `holocron diagrams fix` now correctly detects boxes with cross junctions (`┼`, `╬`, `╋`, `╪`, `╫`) on borders, mixed single/double corners (`╒`, `╓`, `╕`, `╖`, `╘`, `╙`, `╛`, `╜`), and mixed junctions (`╤`, `╥`, `╧`, `╨`, `╞`, `╟`, `╡`, `╢`). Previously these characters broke border scanning and prevented box detection entirely.
2. **Trailing whitespace stripped from fixed diagrams** — `fixDiagramLines` now trims trailing spaces left by the splice logic when padding adjustments leave no real suffix content.
3. **Diagram fixer preserves language identifier on fenced code blocks** — opening fence lines like `` ```diagram `` are left untouched during fixing.

## 0.20.0

1. **Ambiguous Unicode character detection and auto-replacement** — `holocron diagrams fix` now detects characters like `▶`, `◀`, `▲`, `▼`, `★`, `●`, `■` that have Unicode East Asian Width "Ambiguous". These render as 1 cell on macOS/Linux but 2 cells on many Windows monospaced fonts (Consolas, Lucida Console), breaking diagram alignment. The fixer auto-replaces 18 known-ambiguous characters with safe ASCII equivalents (`▶` → `>`, `▼` → `v`, `●` → `*`, etc.) as a first pass before box detection.

   `--check` mode also warns about unreplaceable ambiguous characters that need manual intervention.

## 0.19.0

1. **New `holocron diagrams fix` command** — detects and fixes misaligned Unicode box-drawing characters in markdown files. The top border (`┌─┐`) is the source of truth for box width; content lines and bottom borders are adjusted to match. Supports light (`┌┐└┘─│`), heavy (`┏┓┗┛━┃`), double (`╔╗╚╝═║`), and rounded (`╭╮╯╰`) character sets. Column-level splice ensures side-by-side and nested boxes on shared rows don't clobber each other.

   ```bash
   holocron diagrams fix docs/**/*.md
   ```

## 0.18.0

1. **Custom domain support** — point your own domain (e.g. `docs.mycompany.com`) at your Holocron-deployed docs site. Cloudflare SSL for SaaS handles certificate provisioning automatically. Custom domains require a Pro subscription.

   ```bash
   # Add a custom domain
   holocron domain add --project <projectId> --hostname docs.mycompany.com

   # List domains
   holocron domain list --project <projectId>

   # Check DNS/SSL status
   holocron domain status --project <projectId>

   # Remove a domain
   holocron domain remove --project <projectId> --hostname docs.mycompany.com
   ```

   All custom domains CNAME to `cname.holocron.so`. SSL certificates are provisioned automatically once DNS is configured. The hosting worker activates the mapping only when both hostname and SSL validation are complete, preventing domain front-running.

## 0.17.0

1. **New `holocron subscribe` command** — subscribe a project to Holocron Pro directly from the CLI. Opens Stripe Checkout in the browser. Prompts interactively for project and billing interval when flags are omitted:

   ```bash
   # Interactive mode
   holocron subscribe

   # Non-interactive
   holocron subscribe --project <projectId> --interval yearly
   ```

   If the project already has an active subscription, opens the Stripe billing portal instead.

2. **New `holocron subscription status` command** — check the current subscription state for a project. Works with both session auth and API key auth (`HOLOCRON_KEY`):

   ```bash
   holocron subscription status --project <projectId>
   ```

## 0.16.0

1. **New `--base-path` flag for `holocron deploy`** — deploy your docs at a subpath on your own domain instead of a separate subdomain:

   ```bash
   npx -y @holocron.so/cli deploy --base-path /docs
   ```

   The flag sets Vite's `base` option at build time so all routes and assets are prefixed under the given path. Configure a rewrite or reverse proxy in your framework to forward `/docs/*` requests to the deployed holocron.so URL. Requires a Holocron Pro subscription.

2. **Fixed device flow login on some servers** — the poll response body was being read twice (once for success check, once for error handling). The second read silently failed, masking expired-token and access-denied errors. Now the body is read once and both branches reference the same parsed object.

3. **Allow `holocron login` from AI agent contexts** — removed the `isAgent` guard that blocked login inside agent terminals. The device flow only needs a browser, not interactive stdin. The PTY requirement for the spinner output is already covered by the existing `isTTY` check.

4. **Removed `dotenv` dependency** — the CLI gets `HOLOCRON_KEY` from CI env vars or sigillo, not `.env` files, so the dynamic dotenv import was unnecessary.

## 0.15.1

1. **`HOLOCRON_TOKEN` accepted as env var alias for `HOLOCRON_KEY`** — deploy and all API commands now check both `HOLOCRON_TOKEN` and `HOLOCRON_KEY` (first defined wins). Useful when your CI already has a `HOLOCRON_TOKEN` secret and you don't want to rename it.

## 0.15.0

1. **Clear deploy error when a subscription is required** — when a deploy exceeds the free plan (a preview deploy, or a 2nd production deploy on the free tier), the server returns a `SUBSCRIPTION_REQUIRED` error. The CLI now surfaces the server's actionable message plus the upgrade URL instead of a generic `Failed to create deployment`:

   ```bash
   npx -y @holocron.so/cli deploy
   # A Holocron Pro subscription is required for this deployment.
   # Subscribe to continue: https://holocron.so/...
   ```

2. **Clearer expired-session message on `login`** — when a saved session token is expired or invalid, the CLI now tells you to run the login command again instead of failing with a confusing error.

3. **Updated spiceflow to 1.26.0-rsc.3**

## 0.14.1

1. **Updated spiceflow to 1.26.0-rsc.0**

## 0.14.0

1. **Rich `whoami` command with multi-org support** — `holocron whoami` now shows your user info, all organizations with IDs and roles, and projects grouped per org:

   ```bash
   npx -y @holocron.so/cli whoami
   ```

2. **Multi-org project creation** — `holocron projects create` now accepts `--org [orgId]` to target a specific organization. When you belong to multiple orgs and don't pass `--org`, an interactive picker appears.

3. **Deploy project picker shows org names** — when deploying with multiple projects across orgs, the interactive picker now displays the org name alongside each project for easier identification.

## 0.13.0

1. **New `--key` option for `holocron create`** — pass an existing API key to skip the entire cloud setup flow (no device flow login, no project creation, no API key creation). The key is written directly to `.env`:

   ```bash
   npx -y @holocron.so/cli create my-docs --key holo_xxxxxxxxxxxx
   ```

   This enables one-step scaffolding when the key is already known, e.g. from the holocron.so dashboard.

## 0.12.2

1. **Fixed `$schema` URL in scaffolded projects** — `holocron create` now writes `"$schema": "https://holocron.so/docs.json"` instead of the old unpkg URL that depended on npm publish timing and internal file paths.

## 0.12.1

1. **Upgraded Spiceflow to 1.25.3-rsc.0** — aligns with the latest RSC build used by `@holocron.so/vite`, avoiding duplicate framework versions at runtime.

## 0.12.0

1. **Scaffolded projects now use `docs.jsonc`** — `holocron create` generates the starter config as JSONC, so new projects can keep comments and trailing commas in the same config file Holocron reads by default.

   ```bash
   npx -y @holocron.so/cli create my-docs
   ```

   The create command now parses the template as JSONC before writing the project name and schema URL, so custom starter templates can use JSONC syntax safely.

## 0.11.1

1. **Deploy auth check runs before build** — credentials are validated upfront so missing auth fails immediately instead of after a full Vite build.
2. **Deploy output separated from normal build** — `holocron deploy` now writes to `dist/.holocron` instead of `dist/`, keeping deploy artifacts isolated from platform-specific Vite builds (Cloudflare vs Node.js).
3. **Removed `--skip-build` flag** — builds always run during deploy. The separate output dir makes the flag unnecessary.

## 0.11.0

1. **Keyless deploys from GitHub Actions via OIDC** — `holocron deploy` now supports GitHub Actions OIDC authentication natively. No `HOLOCRON_KEY` secret needed; just set `permissions: id-token: write` in your workflow:

   ```yaml
   permissions:
     id-token: write
     contents: read
   steps:
     - uses: actions/checkout@v4
     - run: npx -y @holocron.so/cli deploy
   ```

   The CLI mints a fresh OIDC token for each deploy step (create, upload, finalize) and the server derives project, branch, and preview state from the verified JWT claims. API key and session auth continue to work as before.

2. **Scaffold no longer lists `spiceflow` as a direct dependency** — `holocron create` generates a leaner `package.json`. Spiceflow is a transitive dependency of `@holocron.so/vite` so users don't need to install it separately.

3. **Improved deploy error messages** — auth failure now suggests all three auth methods (env var, `holocron login`, or GitHub Actions OIDC) instead of only the first two.

## 0.10.0

1. **New `holocron deploy` command** — build and deploy your docs site to holocron.so with a single command. Content-addressable uploads skip unchanged files across deploys:

   ```bash
   holocron deploy
   ```

   Features:
   - Auto-detects branch from git, GitHub Actions, or `--branch` flag
   - Zip-batched parallel uploads with progress reporting
   - SHA-256 content hashing; only new/changed files are uploaded
   - Auto-sets `holocron_url` and `holocron_deployment_id` as GitHub Actions step outputs
   - Reads project name from `docs.json` and syncs it server-side
   - Supports `--skip-build` to deploy an existing `dist/`
   - Auth via `HOLOCRON_KEY` env var or `holocron login` session

2. **Multi-environment auth** — CLI now stores session tokens keyed by server URL, so you can be logged into production and preview simultaneously:

   ```bash
   holocron login                              # logs into holocron.so
   holocron --api-url https://preview.holocron.so login  # separate session
   holocron whoami                              # shows current server's user
   ```

3. **Global `--api-url` flag** — all commands now respect a top-level `--api-url` option instead of per-command `-u`/`--url` flags. Sets `HOLOCRON_API_URL` for the session.

4. **Improved `create` command UX** — reuses existing login session instead of re-authenticating, appends `-docs` to the generated folder name, and skips the "start dev server?" prompt when dependencies weren't installed.

5. **Colored CLI output** — all commands use a centralized logger with color-coded status icons (✓ success, ● step, ✗ error, ▲ warning) for better readability.

6. **Non-TTY safety** — `holocron login` fails fast with a clear message in non-interactive environments instead of hanging on stdin.

7. **Fixed ambient type stubs** — CLI now resolves Cloudflare Workers types from the website source without requiring wrangler installed locally.

## 0.9.0

1. **New `holocron create` command** — scaffold a new docs project from a starter template with interactive setup. Optionally connects to holocron.so for AI chat and analytics:

   ```bash
   holocron create my-docs --name "My Docs"
   ```

   Non-interactive mode is supported for CI/agent use. The scaffold includes `docs.json`, MDX pages, `vite.config.ts`, and `.env` with your API key.

2. **New `projects list` and `projects create` commands** — manage projects for your org:

   ```bash
   holocron projects create --name "My Docs"
   holocron projects list
   ```

3. **API keys are now project-scoped** — each key is tied to a project. The key alone identifies which project a deployment belongs to, so `HOLOCRON_PROJECT` is no longer needed. Just set `HOLOCRON_KEY`:

   ```bash
   holocron keys create --name production --project <projectId>
   ```

4. **Renamed `HOLOCRON_API_KEY` to `HOLOCRON_KEY`** — shorter env var name. Update your `.env` and CI secrets.

5. **Simplified API routes** — the CLI no longer manages org IDs client-side. Org resolution and auto-creation happen server-side.

6. **`docs.jsonc` config support** — the scaffold now outputs `docs.json` with a `$schema` URL pointing to the published npm package for IDE autocomplete.

## 0.6.0

1. **New `login`, `logout`, `whoami` commands** — authenticate with holocron.so via BetterAuth device flow. The CLI opens your browser, you approve, and the session token is saved locally:

   ```bash
   holocron login
   holocron whoami
   holocron logout
   ```

2. **New `keys create`, `keys list`, `keys delete` commands** — manage API keys for deploying docs sites. Keys are scoped to your org and can authenticate the hosted AI proxy via `HOLOCRON_KEY`:

   ```bash
   holocron keys create --name production
   holocron keys list
   holocron keys delete <keyId>
   ```

3. **Typed API client** — all API calls go through `spiceflow/client` with types auto-derived from the website routes and safe error handling via `errore` patterns.
