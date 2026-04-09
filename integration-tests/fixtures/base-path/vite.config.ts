import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { holocron } from "@holocron.so/vite/vite";
import { getFixtureCacheDir, getFixtureOutDir } from "../../scripts/fixtures.ts";

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
  base: "/docs",
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
