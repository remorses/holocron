# Notaku deploy shell

Minimal Holocron site built with **`HOLOCRON_DEPLOY=1`** so Rolldown splits:

- `assets/holocron-stable*.js` — framework (shared across tenants)
- `assets/holocron-data.js` — config + navigation (swapped per Notaku site)
- `assets/holocron-page-*.js` — MDX pages (swapped per site)

## Build

```bash
# from holocron monorepo root
pnpm install
pnpm --filter notaku-shell build
```

Output: `notaku-shell/dist/.holocron/` (`rsc/` + `client/`).

## Copy into Notaku

```bash
# from notaku repo
rm -rf website/holocron-shell/*
cp -R ../holocron/notaku-shell/dist/.holocron/* website/holocron-shell/
```

Or set `HOLOCRON_SHELL_DIR` to the absolute path of `notaku-shell/dist/.holocron`.

## Deploy mapping (Notaku)

| Shell path | Upload path |
|------------|-------------|
| `rsc/**` (except wrangler.json) | `worker/**` |
| `client/**` | `assets/**` |

Notaku then overwrites `assets/holocron-data.js` and `assets/holocron-page-*.js`
via `generateHolocronData()` before calling the Holocron deploy API.
