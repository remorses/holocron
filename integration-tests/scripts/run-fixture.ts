/**
 * Run a single integration-test fixture in dev, build, or start mode.
 *
 * This keeps the manual fixture workflow simple while reusing the same
 * fixture discovery and run-scoped output paths as the Playwright setup.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  discoverFixtures,
  ensureE2ERunId,
  getFixtureOutDir,
  integrationTestsDir,
  type Fixture,
} from "./fixtures.ts";

function parseArgs(argv: string[]): {
  mode: "list" | "dev" | "build" | "start";
  fixtureName?: string;
  port?: number;
} {
  const [rawMode, rawFixtureName, ...rest] = argv;
  if (
    rawMode !== "list"
    && rawMode !== "dev"
    && rawMode !== "build"
    && rawMode !== "start"
  ) {
    throw new Error(
      `Expected a mode: list, dev, build, or start. Received ${JSON.stringify(rawMode)}.`,
    );
  }

  const mode = rawMode;

  let port: number | undefined;
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg !== "--port") {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const value = rest[index + 1];
    if (!value) {
      throw new Error("Missing value after --port.");
    }

    port = Number(value);
    if (!Number.isInteger(port) || port <= 0) {
      throw new Error(`Invalid port: ${value}`);
    }

    index += 1;
  }

  return { mode, fixtureName: rawFixtureName, port };
}

function printUsage(): void {
  console.error(`Usage:
  pnpm fixtures:list
  pnpm fixtures:dev <fixture-name> [--port 5173]
  pnpm fixtures:build <fixture-name>
  pnpm fixtures:start <fixture-name> [--port 4173]`);
}

function printFixtureList(fixtures: Fixture[]): void {
  console.log("Available fixtures:");
  for (const fixture of fixtures) {
    console.log(`- ${fixture.name}`);
  }
}

function getFixture(fixtureName: string | undefined, fixtures: Fixture[]): Fixture {
  if (!fixtureName) {
    throw new Error("Missing fixture name.");
  }

  const fixture = fixtures.find((candidate) => candidate.name === fixtureName);
  if (!fixture) {
    throw new Error(`Unknown fixture: ${fixtureName}`);
  }

  return fixture;
}

function getFixtureConfigPath(fixture: Fixture): string {
  const fixtureConfig = path.join(fixture.rootRel, "vite.config.ts");
  return fs.existsSync(path.join(integrationTestsDir, fixtureConfig))
    ? fixtureConfig
    : "vite.config.ts";
}

function runStep({
  command,
  args,
  env,
}: {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: integrationTestsDir,
      stdio: "inherit",
      env,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit ${code}`));
    });

    child.on("error", reject);
  });
}

async function runBuild(fixture: Fixture, runId: string): Promise<void> {
  await runStep({
    command: "pnpm",
    args: ["exec", "tsx", "scripts/build-fixtures.ts"],
    env: {
      ...process.env,
      E2E_FIXTURES: fixture.name,
      E2E_RUN_ID: runId,
    },
  });
}

async function runDev({
  fixture,
  runId,
  port,
}: {
  fixture: Fixture;
  runId: string;
  port: number;
}): Promise<void> {
  await runStep({
    command: "pnpm",
    args: [
      "exec",
      "vite",
      fixture.rootRel,
      "--config",
      getFixtureConfigPath(fixture),
      "--port",
      String(port),
      "--strictPort",
    ],
    env: {
      ...process.env,
      E2E_RUN_ID: runId,
      E2E_FIXTURE_ROOT: fixture.rootDir,
    },
  });
}

async function runStart({
  fixture,
  runId,
  port,
}: {
  fixture: Fixture;
  runId: string;
  port: number;
}): Promise<void> {
  await runBuild(fixture, runId);

  const serverEntry = path.join(getFixtureOutDir(fixture.rootDir, runId), "rsc/index.js");
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Built server entry not found: ${serverEntry}`);
  }

  await runStep({
    command: "node",
    args: [serverEntry],
    env: {
      ...process.env,
      E2E_RUN_ID: runId,
      E2E_FIXTURE_ROOT: fixture.rootDir,
      PORT: String(port),
    },
  });
}

try {
  const { mode, fixtureName, port } = parseArgs(process.argv.slice(2));
  const fixtures = discoverFixtures();

  if (mode === "list") {
    printFixtureList(fixtures);
    process.exit(0);
  }

  const fixture = getFixture(fixtureName, fixtures);
  const runId = ensureE2ERunId();

  console.log(`[run-fixture] ${mode} ${fixture.name} (run ${runId})`);

  if (mode === "build") {
    await runBuild(fixture, runId);
    process.exit(0);
  }

  if (mode === "dev") {
    await runDev({ fixture, runId, port: port ?? 5173 });
    process.exit(0);
  }

  await runStart({ fixture, runId, port: port ?? 4173 });
} catch (error) {
  printUsage();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
