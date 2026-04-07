/**
 * Build every fixture's `dist/` in parallel.
 *
 * Used by `pretest-e2e-start` to produce one production build per fixture
 * before Playwright spins up the `start` web servers.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { discoverFixtures, integrationTestsDir, type Fixture } from "./fixtures.ts";

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

function buildFixture(fixture: Fixture): Promise<void> {
  return new Promise((resolve, reject) => {
    const { rootDir, rootRel } = fixture;
    console.log(`\n[build-fixtures] → ${rootRel}`);
    // Vite 8 uses `root` as a positional arg (not --root). Config path is
    // resolved from cwd, so relative `vite.config.ts` works here.
    const fixtureConfig = path.join(rootDir, "vite.config.ts");
    const configFlag = fs.existsSync(fixtureConfig)
      ? `${rootRel}/vite.config.ts`
      : "vite.config.ts";
    const child = spawn(
      "pnpm",
      ["exec", "vite", "build", rootRel, "--config", configFlag],
      {
        cwd: integrationTestsDir,
        stdio: "inherit",
        env: process.env,
      },
    );
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`[build-fixtures] vite build failed for ${rootRel} (exit ${code})`));
      } else {
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
await Promise.all(fixtures.map((fixture) => buildFixture(fixture)));

console.log(`\n[build-fixtures] done — built ${fixtures.length} fixture(s)`);
