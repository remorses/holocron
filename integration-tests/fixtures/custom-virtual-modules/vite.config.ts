/** Fixture-local Vite config that overrides Holocron virtual modules with hardcoded providers. */

import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { holocron } from "@holocron.so/vite/src/vite-plugin.ts";
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

const mdxVirtualModule = `
const pages = {
  index: String.raw\`# Virtual Home\n\nThis came from custom virtual modules.\`,
  "getting-started": String.raw\`# Virtual Getting Started\n\nThis also came from custom virtual modules.\`,
}

export async function getMdxSlugs() {
  return Object.keys(pages)
}

export async function getMdxSource(slug) {
  return pages[slug]
}

export async function getPageIconRefs() {
  return []
}
`;

const navigationVirtualModule = `
import { buildNavigationData } from "@holocron.so/vite/src/build-navigation-data.ts"
import { getConfig } from "virtual:holocron-config"
import { getMdxSource } from "virtual:holocron-mdx"

export async function getNavigationData() {
  const config = await getConfig()
  return await buildNavigationData({ config, getMdxSource })
}
`;

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
  plugins: [
    holocron({
      virtualModules: {
        mdx: mdxVirtualModule,
        navigation: navigationVirtualModule,
      },
    }),
  ],
});
