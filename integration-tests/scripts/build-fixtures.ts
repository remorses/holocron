/**
 * Build every fixture's `dist/` in parallel.
 *
 * Used by `pretest-e2e-start` to produce one production build per fixture
 * before Playwright spins up the `start` web servers.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { discoverFixtures, integrationTestsDir } from "./fixtures.ts";

function cleanFixtureDist(rootDir: string): void {
  const distDir = path.join(rootDir, "dist");
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  const tsbuildinfo = path.join(rootDir, "tsconfig.tsbuildinfo");
  if (fs.existsSync(tsbuildinfo)) {
    fs.rmSync(tsbuildinfo);
  }
}

function writeMjsCompatibilityAliases(rootDir: string): void {
  for (const relativeEntry of ["dist/rsc/index", "dist/ssr/index"]) {
    const mjsPath = path.join(rootDir, `${relativeEntry}.mjs`);
    const jsPath = path.join(rootDir, `${relativeEntry}.js`);
    if (fs.existsSync(mjsPath) && !fs.existsSync(jsPath)) {
      fs.copyFileSync(mjsPath, jsPath);
    }
  }
}

function rewriteMjsEntryImports(rootDir: string): void {
  const rewrites = [
    {
      filePath: path.join(rootDir, "dist/rsc/index.mjs"),
      from: '../ssr/index.js',
      to: '../ssr/index.mjs',
    },
    {
      filePath: path.join(rootDir, "dist/ssr/index.mjs"),
      from: '../rsc/index.js',
      to: '../rsc/index.mjs',
    },
  ] as const;

  for (const rewrite of rewrites) {
    if (!fs.existsSync(rewrite.filePath)) continue;
    const content = fs.readFileSync(rewrite.filePath, "utf8");
    if (!content.includes(rewrite.from)) continue;
    fs.writeFileSync(rewrite.filePath, content.replaceAll(rewrite.from, rewrite.to));
  }
}

function buildFixture(rootRel: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n[build-fixtures] → ${rootRel}`);
    const fixtureConfig = path.join(rootRel, "vite.config.ts");
    const configPath = fs.existsSync(path.join(integrationTestsDir, fixtureConfig))
      ? fixtureConfig
      : "vite.config.ts";
    // Vite 8 uses `root` as a positional arg (not --root). Config path is
    // resolved from cwd, so relative `vite.config.ts` works here.
    const child = spawn(
      "pnpm",
      ["exec", "vite", "build", rootRel, "--config", configPath],
      {
        cwd: integrationTestsDir,
        stdio: "inherit",
        env: {
          ...process.env,
          // Integration tests run the built server from the local workspace,
          // so they do not need Spiceflow's standalone node_modules tracing.
          // Skipping it also avoids hard-coding the server entry extension
          // (`index.js` vs `index.mjs`) when fixtures copy real package.json files.
          E2E_SKIP_PRERENDER: "1",
          SPICEFLOW_SKIP_STANDALONE_TRACE: "1",
        },
      },
    );
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`[build-fixtures] vite build failed for ${rootRel} (exit ${code})`));
      } else {
        writeMjsCompatibilityAliases(path.join(integrationTestsDir, rootRel));
        rewriteMjsEntryImports(path.join(integrationTestsDir, rootRel));
        resolve();
      }
    });
    child.on("error", reject);
  });
}

const fixtures = discoverFixtures();
if (fixtures.length === 0) {
  console.error("[build-fixtures] no fixtures found under fixtures/");
  process.exit(1);
}

console.log(
  `[build-fixtures] building ${fixtures.length} fixture(s) in parallel: ${fixtures
    .map((f) => f.name)
    .join(", ")}`,
);

// Each fixture writes to its own dist/ and has its own scoped Vite cache
// (via scopedCacheDir() in vite.config.ts), so builds are fully isolated
// and can run concurrently.
for (const fixture of fixtures) {
  cleanFixtureDist(fixture.rootDir);
}
await Promise.all(fixtures.map((fixture) => buildFixture(fixture.rootRel)));

console.log(`\n[build-fixtures] done — built ${fixtures.length} fixture(s)`);
