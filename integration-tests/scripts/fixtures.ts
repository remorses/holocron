/**
 * Fixture discovery and run-scoped artifact paths for integration tests.
 *
 * Every subdirectory of `fixtures/` that contains a `holocron.jsonc` or
 * `docs.json` is treated as a fixture: a self-contained mini-site with its
 * own config + pages/. Each fixture maps to one Playwright project, one
 * Vite server, and one `e2e/<name>/` test directory.
 *
 * Adding a new fixture = drop a folder into `fixtures/` and add a matching
 * `e2e/<name>/` test directory. No code changes anywhere else.
 */

import fs from "node:fs";
import path from "node:path";

export type Fixture = {
  /** Folder name under `fixtures/` (also the Playwright project name and test dir name) */
  name: string;
  /** Absolute path to the fixture root — passed to `vite --root` */
  rootDir: string;
  /** Relative path from integration-tests/ to the fixture root (for CLI commands) */
  rootRel: string;
  /** Config file name found in the fixture ('holocron.jsonc' or 'docs.json') */
  configFile: string;
};

const CONFIG_FILENAMES = ["holocron.jsonc", "docs.json"] as const;

/** Absolute path to the integration-tests/ directory (parent of scripts/) */
export const integrationTestsDir = path.resolve(
  import.meta.dirname,
  "..",
);

export const fixturesDir = path.join(integrationTestsDir, "fixtures");

function sanitizeRunIdForPath(runId: string): string {
  return runId.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

export function ensureE2ERunId(): string {
  const existing = process.env["E2E_RUN_ID"]?.trim();
  if (existing) return existing;

  const runId = `${Date.now().toString(36)}-${process.pid.toString(36)}`;
  process.env["E2E_RUN_ID"] = runId;
  return runId;
}

export function getFixtureCacheDir(rootDir: string, runId = ensureE2ERunId()): string {
  return path.join(rootDir, "node_modules/.vite", sanitizeRunIdForPath(runId));
}

export function getFixtureOutDir(rootDir: string, runId = ensureE2ERunId()): string {
  return path.join(rootDir, ".e2e-dist", sanitizeRunIdForPath(runId));
}

function removeDirIfEmpty(dir: string): void {
  if (!fs.existsSync(dir)) {
    return;
  }

  if (fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

export function cleanupFixtureRunArtifacts(rootDir: string, runId = ensureE2ERunId()): void {
  const runScopedDirs = [
    getFixtureCacheDir(rootDir, runId),
    getFixtureOutDir(rootDir, runId),
  ];

  for (const dir of runScopedDirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  removeDirIfEmpty(path.join(rootDir, ".e2e-dist"));
  removeDirIfEmpty(path.join(rootDir, "node_modules", ".vite"));
}

export function cleanupAllFixtureRunArtifacts(runId = ensureE2ERunId()): void {
  for (const fixture of discoverFixtures()) {
    cleanupFixtureRunArtifacts(fixture.rootDir, runId);
  }
}

export function discoverFixtures(): Fixture[] {
  if (!fs.existsSync(fixturesDir)) {
    return [];
  }

  const requestedNames = (() => {
    const raw = process.env["E2E_FIXTURES"]?.trim();
    if (!raw) return undefined;
    const names = raw.split(",").map((name) => name.trim()).filter(Boolean);
    return names.length > 0 ? new Set(names) : undefined;
  })();

  const entries = fs.readdirSync(fixturesDir, { withFileTypes: true });
  const fixtures: Fixture[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const rootDir = path.join(fixturesDir, entry.name);
    const configFile = CONFIG_FILENAMES.find((name) =>
      fs.existsSync(path.join(rootDir, name)),
    );
    if (!configFile) continue;
    if (requestedNames && !requestedNames.has(entry.name)) continue;

    fixtures.push({
      name: entry.name,
      rootDir,
      rootRel: path.relative(integrationTestsDir, rootDir),
      configFile,
    });
  }

  // Stable ordering by name so port assignment is deterministic across runs
  fixtures.sort((a, b) => a.name.localeCompare(b.name));

  if (requestedNames) {
    const missing = [...requestedNames].filter((name) => !fixtures.some((fixture) => fixture.name === name));
    if (missing.length > 0) {
      throw new Error(`Unknown fixture(s) in E2E_FIXTURES: ${missing.join(", ")}`);
    }
  }

  return fixtures;
}
