import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
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
 * Spiceflow now normalizes its per-environment output dirs from the top-level
 * `build.outDir`, so the shared config only needs to set one run-scoped root.
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

export default defineConfig({
  clearScreen: false,
  ...(runScopedCacheDir ? { cacheDir: runScopedCacheDir } : {}),
  ...(runScopedOutDir
    ? {
        build: {
          outDir: runScopedOutDir,
          emptyOutDir: true,
        },
      }
    : {}),
  plugins: [holocron()],
});
