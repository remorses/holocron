import { defineConfig, devices } from "@playwright/test";
import { createServer } from "node:net";
import fs from "node:fs";
import path from "node:path";
import {
  discoverFixtures,
  ensureE2ERunId,
  getFixtureOutDir,
  integrationTestsDir,
} from "./scripts/fixtures.ts";

function getFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected server.listen(0) to return an AddressInfo");
      }
      const port = address.port;
      server.close(resolve.bind(null, port));
    });
  });
}

const fixtures = discoverFixtures();
if (fixtures.length === 0) {
  throw new Error(
    "No fixtures found under fixtures/. Add at least one fixture folder with a docs.json or holocron.jsonc.",
  );
}

const isStart = Boolean(process.env.E2E_START);
const runId = ensureE2ERunId();
const logsDir = path.join(integrationTestsDir, ".playwright-logs");
fs.mkdirSync(logsDir, { recursive: true });

function quoteForShell(value: string): string {
  return `'${value.replaceAll(`'`, `'\\''`)}'`;
}

// Playwright imports this config file multiple times (once for the main
// process, again for test workers). We must persist the per-fixture ports
// across re-imports via env vars — otherwise each re-import gets fresh
// ports and the test baseURL stops matching the webServer port.
const fixturePorts = await Promise.all(
  fixtures.map(async (fixture) => {
    const key = `E2E_PORT_${fixture.name.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
    const existing = process.env[key];
    const port = existing ? Number(existing) : await getFreePort();
    process.env[key] = String(port);
    return { fixture, port };
  }),
);

const webServers = fixturePorts.map(({ fixture, port }) => {
  // Use a per-fixture vite.config.ts if present, otherwise the shared one
  const fixtureConfig = path.join(fixture.rootDir, "vite.config.ts");
  const configFlag = fs.existsSync(fixtureConfig)
    ? `--config ${fixture.rootRel}/vite.config.ts`
    : `--config vite.config.ts`;
  const builtServerEntry = path.join(getFixtureOutDir(fixture.rootDir, runId), "rsc/index.js");
  const envPrefix = `E2E_RUN_ID=${quoteForShell(runId)} E2E_FIXTURE_ROOT=${quoteForShell(fixture.rootDir)}`;
  const serverCommand = isStart
    ? `cd ${quoteForShell(fixture.rootRel)} && ${envPrefix} PORT=${port} node ${quoteForShell(builtServerEntry)}`
    : `${envPrefix} pnpm exec vite ${fixture.rootRel} ${configFlag} --port ${port} --strictPort`;
  const logPath = path.join(logsDir, `${fixture.name}.${isStart ? "start" : "dev"}.${runId}.log`);
  fs.writeFileSync(logPath, "");
  const command = `${serverCommand} > ${quoteForShell(logPath)} 2>&1`;
  return {
    command,
    stdout: "pipe" as const,
    stderr: "pipe" as const,
    port,
    timeout: 30_000,
    reuseExistingServer: false,
  };
});

// Fixtures whose test files mutate shared state (config, MDX pages) on disk
// must avoid in-project parallelism so multiple mutating files don't race on
// the same Vite server. Read-only fixtures can still run fully parallel.
const SERIAL_FIXTURES = new Set(["basic-hmr", "realworld-polar", "versions"]);

const projects = fixturePorts.map(({ fixture, port }) => ({
  name: fixture.name,
  testDir: `e2e/${fixture.name}`,
  fullyParallel: !SERIAL_FIXTURES.has(fixture.name),
  use: {
    ...devices["Desktop Chrome"],
    viewport: null,
    deviceScaleFactor: undefined,
    baseURL: `http://localhost:${port}`,
  },
}));

export default defineConfig({
  globalTeardown: "./scripts/cleanup-e2e.ts",
  timeout: 45_000,
  expect: {
    timeout: 3_000,
  },
  use: {
    actionTimeout: 4_000,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
  },
  projects,
  webServer: webServers,
  fullyParallel: true,
  // Dev-mode e2e runs one Vite server per fixture and several tests assert HMR
  // without reloads. Keep dev runs serial so fixture servers and websocket HMR
  // do not starve each other on busy machines.
  workers: process.env["CI"] ? 1 : isStart ? undefined : 1,
  // Config-HMR tests tagged @dev only run against the dev server; build-mode
  // tests skip them (and vice-versa). Non-tagged tests run in both modes.
  grepInvert: isStart ? /@dev/ : /@build/,
  // Playwright supports fail-fast with `maxFailures` / `-x`. Keep local runs
  // informative but stop scheduling the rest of the suite after a few failures.
  maxFailures: process.env["CI"] ? 1 : 3,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  reporter: "list",
});
