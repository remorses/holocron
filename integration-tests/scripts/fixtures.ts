/**
 * Fixture discovery for integration tests.
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

export function discoverFixtures(): Fixture[] {
  if (!fs.existsSync(fixturesDir)) {
    return [];
  }

  const entries = fs.readdirSync(fixturesDir, { withFileTypes: true });
  const fixtures: Fixture[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const rootDir = path.join(fixturesDir, entry.name);
    const configFile = CONFIG_FILENAMES.find((name) =>
      fs.existsSync(path.join(rootDir, name)),
    );
    if (!configFile) continue;

    fixtures.push({
      name: entry.name,
      rootDir,
      rootRel: path.relative(integrationTestsDir, rootDir),
      configFile,
    });
  }

  // Stable ordering by name so port assignment is deterministic across runs
  fixtures.sort((a, b) => a.name.localeCompare(b.name));
  return fixtures;
}
