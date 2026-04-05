import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import { holocron } from "@holocron.so/vite/vite";

/**
 * Scope Vite's dep-optimizer cache to the current project root.
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
 * Plugin-scoped via `config()` so it uses Vite's already-resolved root
 * no matter how the shared config is reused across fixtures.
 */
function scopedCacheDir(): Plugin {
  return {
    name: "integration-tests:scoped-cache-dir",
    enforce: "pre",
    config(viteConfig) {
      const root = path.resolve(process.cwd(), viteConfig.root || ".");
      return { cacheDir: path.join(root, "node_modules/.vite") };
    },
  };
}

export default defineConfig({
  clearScreen: false,
  plugins: [scopedCacheDir(), holocron()],
});
