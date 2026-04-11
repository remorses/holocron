/** Shared Vite config helpers for integration-test fixtures. */

import fs from "node:fs";
import path from "node:path";
import type { UserConfig } from "vite";
import { getFixtureCacheDir, getFixtureOutDir } from "./fixtures.ts";

export type FixtureRunPaths = {
  fixtureRoot?: string;
  cacheDir?: string;
  outDir?: string;
};

export function resolveFixtureRunPaths(
  env: NodeJS.ProcessEnv = process.env,
): FixtureRunPaths {
  const fixtureRoot = env.E2E_FIXTURE_ROOT
    ? path.resolve(env.E2E_FIXTURE_ROOT)
    : undefined;
  const runId = env.E2E_RUN_ID?.trim() || undefined;

  return {
    fixtureRoot,
    cacheDir: fixtureRoot ? getFixtureCacheDir(fixtureRoot, runId) : undefined,
    outDir: fixtureRoot ? getFixtureOutDir(fixtureRoot, runId) : undefined,
  };
}

export function cleanupFixtureRunPaths(paths: FixtureRunPaths): void {
  if (paths.cacheDir && fs.existsSync(paths.cacheDir)) {
    fs.rmSync(paths.cacheDir, { recursive: true, force: true });
  }
  if (paths.outDir && fs.existsSync(paths.outDir)) {
    fs.rmSync(paths.outDir, { recursive: true, force: true });
  }
}

export function createE2EViteConfig(
  overrides: UserConfig,
  env: NodeJS.ProcessEnv = process.env,
): UserConfig {
  const paths = resolveFixtureRunPaths(env);
  const overrideBuild = overrides.build ?? {};
  const overrideRolldownOptions = overrideBuild.rolldownOptions ?? {};
  const overrideChecks = overrideRolldownOptions.checks ?? {};

  return {
    ...overrides,
    clearScreen: false,
    ...(paths.cacheDir ? { cacheDir: paths.cacheDir } : {}),
    build: {
      ...overrideBuild,
      ...(paths.outDir
        ? {
            outDir: paths.outDir,
            emptyOutDir: true,
          }
        : {}),
      chunkSizeWarningLimit: overrideBuild.chunkSizeWarningLimit ?? 5000,
      rolldownOptions: {
        ...overrideRolldownOptions,
        checks: {
          ...overrideChecks,
          pluginTimings: false,
        },
      },
    },
  };
}
