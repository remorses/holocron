/**
 * Build every fixture's `dist/` in sequence.
 *
 * Used by `pretest-e2e-start` to produce one production build per fixture
 * before Playwright spins up the `start` web servers.
 */

import { spawnSync } from "node:child_process";
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

function buildFixture(rootRel: string): void {
  console.log(`\n[build-fixtures] → ${rootRel}`);
  // Vite 8 uses `root` as a positional arg (not --root). Config path is
  // resolved from cwd, so relative `vite.config.ts` works here.
  const result = spawnSync(
    "pnpm",
    ["exec", "vite", "build", rootRel, "--config", "vite.config.ts"],
    {
      cwd: integrationTestsDir,
      stdio: "inherit",
      env: process.env,
    },
  );
  if (result.status !== 0) {
    throw new Error(`[build-fixtures] vite build failed for ${rootRel}`);
  }
}

const fixtures = discoverFixtures();
if (fixtures.length === 0) {
  console.error("[build-fixtures] no fixtures found under fixtures/");
  process.exit(1);
}

console.log(
  `[build-fixtures] building ${fixtures.length} fixture(s): ${fixtures
    .map((f) => f.name)
    .join(", ")}`,
);

for (const fixture of fixtures) {
  cleanFixtureDist(fixture.rootDir);
  buildFixture(fixture.rootRel);
}

console.log(`\n[build-fixtures] done — built ${fixtures.length} fixture(s)`);
