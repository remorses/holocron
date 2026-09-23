## 0.22.5

1. **`holocron maintain` streams what OpenCode does.** Before, the log showed only `Starting OpenCode...` until the run ended. Now it prints task sessions, assistant messages, and every finished tool call with its duration. Failed tool calls show the error inline, and OpenCode server warnings and errors (for example provider rate limits) are printed too:

   ```
     ◆ task 1 Update index.mdx (@general subagent)
     [task 1] └ read cli/src/maintain.ts 34ms
     [task 1] └ edit website/src/pages/maintain/index.mdx 2ms
     └ bash holocron maintain-open-pr --title "[holocron] Update maintain docs" … 13ms
     opencode ERROR stream error agent=general error.error=AI_APICallError: Rate limit exceeded.
   ✓ holocron Opened https://github.com/owner/repo/pull/110
   ```

2. **The maintain pull request targets the checked-out branch.** Before, the branch came from the event payload, so `workflow_dispatch` on another branch or `actions/checkout` with `ref: docs` still opened the PR into the default branch. A detached HEAD uses the release target branch on `release` events, else the repository default branch.

   ```yaml
   - uses: actions/checkout@v4
     with:
       ref: docs            # the maintain pull request targets docs
       fetch-depth: 0
       persist-credentials: false
   ```

3. **OpenCode gets relaxed permissions, but no GitHub credentials.** The model can run any shell command, read any file, and fetch any URL, so it no longer fails on denied helper commands. `GITHUB_TOKEN`, `GH_TOKEN`, `HOLOCRON_KEY`, and the GitHub OIDC request token are removed from its environment. The CLI pushes with the token itself, so set `persist-credentials: false` on `actions/checkout`. Maintain still fails the run if files outside the selected pages change.

4. **Checks run before OpenCode starts, and again before the push.** A missing `GITHUB_TOKEN`, a `pull_request` event, a checkout on a `holocron/maintain-*` branch, a shallow clone, a missing `origin/<base>` ref, or a checkout that is not on the base branch fail right away with a clear message, before any model cost. Right before the push, the CLI checks the branch again instead of trusting the model. If the pull request cannot be opened, the CLI deletes the branch it pushed and tells you which permission to check.

## 0.22.4

1. **`holocron maintain` in GitHub Actions opens the pull request reliably.** Before, the model had to commit, push, and open the PR itself. It sometimes stopped after the edits, so runs failed with `OpenCode updated pages but left them uncommitted` or passed with no PR. The work is now split:

   - The CLI creates `holocron/maintain-<timestamp>` before OpenCode starts.
   - When pages changed, OpenCode commits them and runs a hidden command with the PR title and body:

     ```bash
     holocron maintain-open-pr --title "[holocron] Update docs" <<'EOF'
     - Document the new flag
     EOF
     ```

     The command checks the branch and tells the model what to fix (for example, uncommitted pages).
   - After the session the CLI pushes the branch and opens the pull request with the Octokit REST client. If pages changed but the model never ran the command, the job fails and prints the model's last message. When no page changed, nothing is committed and no PR is opened.

   OpenCode no longer gets `git push` or `gh` permissions. Commits are still authored by `holocron.so <bot@holocron.so>`.

## 0.22.3

1. **`holocron maintain` no longer fails with `fetch failed` after five minutes.** Node's `fetch` gave up on OpenCode's blocking prompt response after 5 minutes, so long runs on hosted models never finished. The OpenCode client now disables the undici headers and body timeouts, so runs can use the full 25 minute budget. A run that exceeds 25 minutes reports the timeout instead of a generic failure.

2. **`holocron maintain` no longer hangs after finishing.** The OpenCode server was started through pnpm's `.bin/opencode` shell shim, so stopping it left the real process running and the CI job hung until timeout. The CLI now spawns the pinned `opencode` binary directly and waits for it to exit.

3. **Provider errors fail the run.** When the OpenCode turn ends with an auth, rate limit, context overflow, or API error, `holocron maintain` now fails with a clear error. Before, it printed "Documentation is already current." and exited 0.

4. **Maintain verifies the pull request in GitHub Actions.** If pages were updated but not committed, the branch was not pushed, or no pull request was opened, the job fails with a clear message. On success it prints the pull request URL.

   Pull request events now open the docs PR into the PR head branch instead of always `main`. Schedule and manual runs target the repository default branch instead of a hard-coded `main`.

5. **Tighter permissions in GitHub Actions.** OpenCode may only push the `holocron/maintain-*` branch it creates. `gh` is limited to `gh pr create`, `gh pr view`, `gh pr list`, and `gh auth status`.

6. **Maintain commits are authored by `holocron.so <bot@holocron.so>`.** The identity is set through `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars, so it never falls back to `github-actions[bot]` and the repo git config is untouched. PR bodies end with `*PR opened by [holocron.so](https://holocron.so)*`.

## 0.22.2

1. **Print the real OpenCode error when Maintain fails**, instead of `{}`.

   Hosted Maintain runs now use a **25-minute** provider timeout, matching the CLI run timeout. The previous OpenCode default of 5 minutes aborted long documentation updates with an empty error object.

   Maintain also puts the bundled `opencode-ai` binary first on `PATH` before starting the OpenCode server, so a global `opencode` install does not win.

2. **Fix `holocron diagrams fix` nested fences.** A wrapping ````mdx` fence no longer swallows later prose.

   CommonMark closing fences must match the opening fence length. A nested ` ```diagram ` inside ````mdx` was treated as the closer, so the rest of the file was scanned as one diagram and long prose lines failed the 94-column check.

   ASCII diagrams in the public docs now use the `diagram` language hint, including the [subpath hosting](https://holocron.so/docs/deploy/base-path) page.

## 0.22.1

1. **Fix `holocron maintain --model` examples and error text.** The BYOK example is now a real OpenCode id, `anthropic/claude-sonnet-4-5`. Failed OpenCode calls print the provider error instead of always saying the API key is missing. Unknown hosted ids hint at the `provider/model` form. Docs name the hosted models (`deepseek-v4-flash` default, `glm-5.3-flash`) and point at `opencode auth login` for keys:

   ```bash
   npx -y "@holocron.so/cli" maintain --model glm-5.3-flash
   npx -y "@holocron.so/cli" maintain --model anthropic/claude-sonnet-4-5
   ```

## 0.22.0

1. **New `holocron maintain` command** — keep documentation in sync with the source files, folders, and URLs that generated each page.

   Add a generation prompt to page frontmatter:

   ```yaml
   ---
   $schema: https://holocron.so/frontmatter.json
   prompt: |
     Write the authentication guide from @/src/auth/.
     Use @https://github.com/example/project/releases for recent behavior.
     Explain sessions, API keys, and GitHub Actions OIDC.
   ---
   ```

   `holocron maintain` finds pages whose referenced sources changed, runs one OpenCode session, and validates the resulting MDX. `@/path` refs resolve from the repo root, including files inside git submodules. `@https://` refs match changed remote URLs.

   ```bash
   npx -y "@holocron.so/cli" maintain --since origin/main
   npx -y "@holocron.so/cli" maintain --since origin/main --dry-run
   npx -y "@holocron.so/cli" maintain --all --prompt-file .holocron/prompts/weekly-review.md
   ```

   By default Maintain uses a **Holocron-hosted model** and bills the site's Pro subscription. Pass a hosted id such as `glm-5.3-flash`, or `provider/model` to use your own OpenCode keys with no Holocron auth or credits:

   ```bash
   npx -y "@holocron.so/cli" maintain --model glm-5.3-flash
   npx -y "@holocron.so/cli" maintain --model anthropic/claude-sonnet-4
   ```

   ```
   holocron maintain
          │
          ├── no --model / glm-5.3-flash ──► Holocron-hosted model (Pro bill)
          │
          └── --model anthropic/claude-sonnet-4
                    │
                    └──► OpenCode provider + your ANTHROPIC_API_KEY
   ```

   In **GitHub Actions**, no-args `holocron maintain` diffs the whole push from `GITHUB_EVENT_PATH`. The session prompt tells OpenCode to create `holocron/maintain-<timestamp>` and open a pull request when MDX files changed. It never updates `main` or other existing branches. Actions authenticates through OIDC, so the workflow does not need a stored Holocron key. Local runs only edit MDX; they do not create a branch or pull request.

   Use `--all` with `--prompt` or `--prompt-file` for scheduled grammar, SEO, link, translation, and style reviews.

2. **Copy-paste commands on deploy and subscribe errors** — a missing Pro subscription, missing `--project`, org-scoped key, or GitHub OIDC 401 now prints the exact `holocron` command to run, plus the billing URL when a subscription is required.

## 0.21.1

1. **Update the bundled Spiceflow RSC runtime** to `1.26.0-rsc.18`, including the latest Vite RSC plugin fixes.

## 0.21.0

1. **`holocron diagrams fix` now formats GFM tables in place**, not just box-drawing diagrams:

   ```bash
   npx -y "@holocron.so/cli" diagrams fix docs/**/*.mdx
   ```

   Before:

   ```md
   |Name|Age|City|
   |---|---|---|
   |Alice|30|NYC|
   |Bob|2|SF|
   ```

   After:

   ```md
   | Name  | Age | City |
   | ----- | --- | ---- |
   | Alice | 30  | NYC  |
   | Bob   | 2   | SF   |
   ```

   Each table is found via the mdast AST, stringified with the same `mdast-util-gfm` path used by Holocron `.md` / `.mdx` handlers (padded columns, aligned pipes), then spliced back into the original source. The full MDX document is never re-serialized, so prose, JSX, and code fences stay untouched. It also normalizes a blank line above and below each table, and peels trailing prose that GFM would otherwise absorb when a table is missing its closing blank line. `--check` fails on unformatted tables the same way it does for misaligned diagrams.

2. **`holocron deploy` auto-detects the Vite `base` path** — previously a site built with `base: '/docs'` emitted HTML referencing `/docs/assets/*`, but the deployment metadata had no base path, so the hosting worker looked up assets at root and every CSS/JS request 404ed. The base is now read from the build output and forwarded as the deployment `basePath` (equivalent to passing `--base-path`). An explicit `--base-path` flag still takes precedence.

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
