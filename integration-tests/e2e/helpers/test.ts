/**
 * Playwright test fixture that starts the current fixture server on demand.
 *
 * Keeping server startup in a worker fixture lets one Playwright process run the
 * whole suite while only one fixture server is alive when `workers` is 1.
 */

import { expect, test as base } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  discoverFixtures,
  ensureE2ERunId,
  getFixtureOutDir,
  integrationTestsDir,
} from "../../scripts/fixtures.ts";

function quoteForShell(value: string): string {
  return `'${value.replaceAll(`'`, `'\''`)}'`;
}

function getFixturePort(fixtureName: string): number {
  const key = `E2E_PORT_${fixtureName.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
  const port = Number(process.env[key]);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Missing ${key}; playwright.config.ts must assign fixture ports before tests run.`);
  }
  return port;
}

async function waitForPort(port: number): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() <= deadline) {
    try {
      await fetch(`http://localhost:${port}/`, { redirect: "manual" });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Timed out waiting for fixture server on port ${port}`);
}

function startFixtureServer(fixtureName: string): { child: ChildProcess; logPath: string } {
  const fixture = discoverFixtures().find((candidate) => candidate.name === fixtureName);
  if (!fixture) throw new Error(`Unknown fixture: ${fixtureName}`);

  const isStart = Boolean(process.env.E2E_START);
  const runId = ensureE2ERunId();
  const port = getFixturePort(fixtureName);
  const logsDir = path.join(integrationTestsDir, ".playwright-logs");
  fs.mkdirSync(logsDir, { recursive: true });

  const fixtureConfig = path.join(fixture.rootDir, "vite.config.ts");
  const configFlag = fs.existsSync(fixtureConfig)
    ? `--config ${fixture.rootRel}/vite.config.ts`
    : "--config vite.config.ts";
  const builtServerEntry = path.join(getFixtureOutDir(fixture.rootDir, runId), "rsc/index.js");
  const envPrefix = `E2E_RUN_ID=${quoteForShell(runId)} E2E_FIXTURE_ROOT=${quoteForShell(fixture.rootDir)}`;
  const serverCommand = isStart
    ? `cd ${quoteForShell(fixture.rootRel)} && ${envPrefix} PORT=${port} node ${quoteForShell(builtServerEntry)}`
    : `${envPrefix} pnpm exec vite ${fixture.rootRel} ${configFlag} --port ${port} --strictPort`;

  const logPath = path.join(logsDir, `${fixture.name}.${isStart ? "start" : "dev"}.${runId}.log`);
  const log = fs.openSync(logPath, "w");
  const child = spawn(serverCommand, {
    cwd: integrationTestsDir,
    shell: true,
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.once("exit", () => fs.closeSync(log));
  return { child, logPath };
}

async function stopFixtureServer(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) return;
  process.kill(-child.pid, "SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
}

export const test = base.extend<object, { fixtureServer: void }>({
  fixtureServer: [async ({}, use, workerInfo) => {
    const { child, logPath } = startFixtureServer(workerInfo.project.name);
    try {
      await waitForPort(getFixturePort(workerInfo.project.name));
      await use();
    } catch (error) {
      console.error(`[fixture-server] log: ${logPath}`);
      throw error;
    } finally {
      await stopFixtureServer(child);
    }
  }, { scope: "worker", auto: true }],
});

export { expect };
export type { APIRequestContext, Locator, Page, TestInfo } from "@playwright/test";
