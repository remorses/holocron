---
name: bump-holocron-consumers
repo: remorses/holocron
description: >
  Bump @holocron.so/vite and @holocron.so/cli in Tommy's other GitHub repos.
  Use when asked to update holocron versions across remorses consumer sites,
  find repos that depend on holocron.so/vite or holocron.so/cli, or sync
  docs-site packages after a holocron release.
---

# Bump Holocron in consumer repos

After a holocron npm release, bump **@holocron.so/vite** and **@holocron.so/cli** in Tommy's other repos. Do this on **local clones**. Do not clone missing repos unless asked. Do not commit unless asked.

Load the **pnpm** skill before running any `pnpm update`.

## 1. Read the latest versions

```bash
npm view @holocron.so/vite version
npm view @holocron.so/cli version
```

Confirm they match `vite/package.json` and `cli/package.json` in this repo. Never guess.

## 2. Search GitHub

```bash
gh search code '@holocron.so/vite' --owner remorses --filename package.json --limit 100 --json repository,path,textMatches

gh search code '@holocron.so/cli' --owner remorses --filename package.json --limit 50 --json repository,path,textMatches
```

Read the **full** JSON. Never pipe to `head` or `tail`.

Treat a hit as a real dependency only when it is in `dependencies` or `devDependencies`. Skip `packageExtensions`, the holocron package's own `"name"` field, and `workspace:^`.

## 3. Skip these

- **remorses/holocron** itself (`workspace:^`)
- Specifiers already set to **`latest`** (template, throwaway test sites)
- Empty directories and non-git folders
- Repos not on this machine, unless the user asks to clone them

Typical `latest` skips: `holocron-template`, `context-dev-docs`, `palmier-pro-docs`, `example-holocron-again`, `holocron-testing-again`, `holocron-example-againagain`, `holocron-test-antoher`, `holocron-docs-new-again`, `holocron-test-2`.

## 4. Map GitHub repo to a local folder

Search these roots, in order:

1. `/Users/morse/Documents/GitHub/<name>`
2. `/Users/morse/Documents/<name>`
3. The alias table below
4. `git remote -v` on nearby folders when the folder name differs from the GitHub name

```bash
for d in /Users/morse/Documents/GitHub/*/ /Users/morse/Documents/*/; do
  url=$(git -C "$d" remote get-url origin 2>/dev/null) || continue
  case "$url" in
    *remorses/kimaki*) echo "kimaki -> $d" ;;
    *remorses/gpuix*) echo "gpuix -> $d" ;;
    *remorses/opensession*) echo "opensession -> $d" ;;
    *remorses/traforo*) echo "traforo -> $d" ;;
    *remorses/spiceflow*) echo "spiceflow -> $d" ;;
  esac
done
```

**Known aliases** (verify `origin` if a path is missing):

| GitHub | Local path | Notes |
|---|---|---|
| remorses/kimaki | `/Users/morse/Documents/GitHub/kimakivoice` | `/GitHub/kimaki` is an empty dir. Dep lives in `website/` |
| remorses/gpuix | `/Users/morse/Documents/GitHub/gpuixlocal` | `website/` is **not** in bun workspaces. Update from that folder |
| remorses/opensession | `/Users/morse/Documents/GitHub/opensessions` | vite + cli |
| remorses/traforo | `/Users/morse/Documents/GitHub/kimakivoice/traforo` | git submodule. kimaki workspace also includes `./traforo/website` |
| remorses/spiceflow | `/Users/morse/Documents/spiceflow` | Not under GitHub/. Local HEAD can lag origin and omit `website/` |
| remorses/playwriter | `/Users/morse/Documents/GitHub/playwriter` | `website/` |
| remorses/termcast | `/Users/morse/Documents/GitHub/termcast` | `website/` |
| remorses/egaki | `/Users/morse/Documents/GitHub/egaki` | `website/` |
| remorses/sigillo | `/Users/morse/Documents/GitHub/sigillo` | Dep is in **`app/`**, not website/ |
| remorses/subrouter | `/Users/morse/Documents/GitHub/subrouter` | Prefer this clone over `kimakivoice/subrouter` |
| remorses/strada | `/Users/morse/Documents/GitHub/strada` | `website/` |
| remorses/notaku | `/Users/morse/Documents/GitHub/notaku` | `website/` |

Repos often **not** on disk: `akarso-private`, `dmcafreemusic`. Skip them. Report them.

If `website/` is missing locally, do not `git pull` to create it unless asked. Report that the clone is behind.

## 5. Update

Pick the package manager from the lockfile at the **repo root** (`pnpm-lock.yaml` vs `bun.lock`).

**pnpm workspace** (run at repo root):

```bash
pnpm update -r --latest @holocron.so/vite
pnpm update -r --latest @holocron.so/cli
```

**bun**, from the folder whose `package.json` lists the dep (often `website/`):

```bash
bun update --latest @holocron.so/vite
bun update --latest @holocron.so/cli
```

Never hand-edit `package.json` to bump a version. Never use `pnpm add` to update. Never add `pnpm.overrides`.

If the dep folder is **not** a workspace member (gpuix `website/`), run the update **inside that folder**, not at the repo root.

Keep the existing specifier style. Exact `0.33.0` stays exact. Caret `^0.30.0` stays caret.

## 6. Same-day publish / minimum release age

Global pnpm `minimumReleaseAge` is **1440** minutes. `@holocron.so/*` is already on the exclude list. If install still fails with:

```text
ERR_PNPM_NO_MATCHING_VERSION  No matching version found for @holocron.so/cli@^X.Y.Z
The latest release of @holocron.so/cli is "X.Y.Z".
```

the project is pinned to an older pnpm via `packageManager` (notaku uses `pnpm@10.16.1`) and the exclude glob is ignored. Retry with:

```bash
npm_config_minimum_release_age=0 pnpm --filter website update @holocron.so/vite@<latest>
```

Do not write `minimum-release-age=0` into the consumer's `.npmrc`.

## 7. Verify, then stop

Read each touched `package.json` and confirm the specifier is the latest. Then stop. Do not commit. Do not push. Do not deploy.

If the user asks to commit, commit **only** the holocron package.json + lockfile hunks in each consumer repo. Use that repo's own git. Never commit unrelated dirty files.

When a new GitHub-to-folder alias is discovered, add it to the table in this skill.
