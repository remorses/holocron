import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { holocron } from "@holocron.so/vite/vite";

/**
 * Scope Vite's dep-optimizer cache to the current project root AND
 * delete it on startup so each test run starts fresh.
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
 * Deleting the scoped cache on startup eliminates stale-cache flakes
 * (e.g. after upgrading Vite or changing the holocron plugin) and
 * ensures full isolation between test runs.
 *
 * Plugin-scoped via `config()` so it uses Vite's already-resolved root
 * no matter how the shared config is reused across fixtures.
 */
function scopedCacheDir(): Plugin {
  return {
    name: "integration-tests:scoped-cache-dir",
    enforce: "pre",
    config(viteConfig) {
      const root = path.resolve(process.cwd(), viteConfig.root || ".");
      const cacheDir = path.join(root, "node_modules/.vite");
      // Nuke stale cache from previous runs so tests are fully isolated
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      }
      return { cacheDir };
    },
  };
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
  plugins: [
    scopedCacheDir(),
    ...(process.env.E2E_SKIP_PRERENDER === "1" ? [skipSpiceflowPrerender()] : []),
    holocron(),
  ],
});
