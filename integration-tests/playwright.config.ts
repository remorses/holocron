import { defineConfig, devices } from "@playwright/test";
import { createServer } from "node:net";
import {
  discoverFixtures,
  ensureE2ERunId,
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
    "No fixtures found under fixtures/. Add at least one fixture folder with a docs.json, docs.jsonc, or holocron.jsonc.",
  );
}

const isStart = Boolean(process.env.E2E_START);
ensureE2ERunId();

function getWorkerCount(): number {
  const raw = process.env["E2E_WORKERS"]?.trim();
  const value = raw ? Number(raw) : 1;
  return Number.isInteger(value) && value > 0 ? value : 1;
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
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
  },
  projects,
  fullyParallel: true,
  // Dev-mode e2e runs one Vite server per fixture and several tests assert HMR
  // without reloads. Keep dev runs serial so fixture servers and websocket HMR
  // do not starve each other on busy machines.
  workers: getWorkerCount(),
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
