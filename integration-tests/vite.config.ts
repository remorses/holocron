import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { holocron } from "@holocron.so/vite/vite";
import { getFixtureCacheDir, getFixtureOutDir } from "./scripts/fixtures.ts";

/**
 * Scope Vite's dep-optimizer cache and build output to the current fixture
 * root AND the current test run id.
 *
 * By default Vite writes to
 * `<firstAncestorWithNodeModules>/node_modules/.vite/`. Every fixture
 * (run with `vite fixtures/<name> --config vite.config.ts`) walks up to
 * the same `integration-tests/node_modules/.vite/` because the fixture
 * dirs have no `node_modules/` of their own. When Playwright spawns
 * basic + tabs servers simultaneously they race on that shared cache
 * and corrupt each other's optimized deps → flaky tests, ECONNREFUSED,
 * "Failed to fetch dynamically imported module" errors.
 *
 * Different agents can still collide if they run the SAME fixture root at the
 * same time, so the cache path also includes `E2E_RUN_ID`. Build-mode tests
 * need the same treatment for `outDir`, otherwise concurrent `vite build`
 * runs race on the fixture's shared `dist/`.
 *
 * Spiceflow reads `build.outDir` from the user config during its own
 * `config()` hook, so the run-scoped paths must be present in the exported
 * Vite config object itself, not only in another plugin's later override.
 */
const fixtureRoot = process.env.E2E_FIXTURE_ROOT
  ? path.resolve(process.env.E2E_FIXTURE_ROOT)
  : undefined;
const runScopedCacheDir = fixtureRoot ? getFixtureCacheDir(fixtureRoot) : undefined;
const runScopedOutDir = fixtureRoot ? getFixtureOutDir(fixtureRoot) : undefined;

if (runScopedCacheDir && fs.existsSync(runScopedCacheDir)) {
  fs.rmSync(runScopedCacheDir, { recursive: true, force: true });
}
if (runScopedOutDir && fs.existsSync(runScopedOutDir)) {
  fs.rmSync(runScopedOutDir, { recursive: true, force: true });
}

function skipSpiceflowPrerender(): Plugin {
  return {
    // Spiceflow skips prerender when a Cloudflare plugin is present.
    // Integration tests only need the built server bundle, not static
    // prerender artifacts, so this keeps exact copied fixture package.json
    // files from breaking build output assumptions (`.js` vs `.mjs`).
    name: "vite-plugin-cloudflare:integration-tests-skip-prerender",
  };
}

export default defineConfig({
  clearScreen: false,
  ...(runScopedCacheDir ? { cacheDir: runScopedCacheDir } : {}),
  ...(runScopedOutDir
    ? {
        build: {
          outDir: runScopedOutDir,
          emptyOutDir: true,
        },
        environments: {
          client: { build: { outDir: path.join(runScopedOutDir, "client") } },
          rsc: { build: { outDir: path.join(runScopedOutDir, "rsc") } },
          ssr: { build: { outDir: path.join(runScopedOutDir, "ssr") } },
        },
      }
    : {}),
  plugins: [
    ...(process.env.E2E_SKIP_PRERENDER === "1" ? [skipSpiceflowPrerender()] : []),
    holocron(),
  ],
});
