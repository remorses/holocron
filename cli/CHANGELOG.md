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
