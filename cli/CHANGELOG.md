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
