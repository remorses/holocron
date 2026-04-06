import { defineConfig, devices } from "@playwright/test";
import { createServer, type AddressInfo } from "node:net";
import { discoverFixtures } from "./scripts/fixtures.ts";

function getFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

const fixtures = discoverFixtures();
if (fixtures.length === 0) {
  throw new Error(
    "No fixtures found under fixtures/. Add at least one fixture folder with a holocron.jsonc or docs.json.",
  );
}

const isStart = Boolean(process.env.E2E_START);

// Playwright imports this config file multiple times (once for the main
// process, again for test workers). We must persist the per-fixture ports
// across re-imports via env vars — otherwise each re-import gets fresh
// ports and the test baseURL stops matching the webServer port.
function envKey(fixtureName: string): string {
  return `E2E_PORT_${fixtureName.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
}

const fixturePorts = await Promise.all(
  fixtures.map(async (fixture) => {
    const key = envKey(fixture.name);
    const existing = process.env[key];
    const port = existing ? Number(existing) : await getFreePort();
    process.env[key] = String(port);
    return { fixture, port };
  }),
);

const webServers = fixturePorts.map(({ fixture, port }) => {
  const command = isStart
    ? `PORT=${port} node ${fixture.rootRel}/dist/rsc/index.js`
    : `pnpm exec vite ${fixture.rootRel} --config vite.config.ts --port ${port} --strictPort`;
  return {
    command,
    stdout: "pipe" as const,
    stderr: "pipe" as const,
    port,
    reuseExistingServer: false,
  };
});

// Fixtures whose test files mutate shared state (config, MDX pages) on disk
// must run single-threaded so HMR tests don't race with read-only tests
// hitting the same Vite server. Other fixtures are safe to parallelize.
const SERIAL_FIXTURES = new Set(["basic"]);

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
  use: {
    actionTimeout: 5000,
    navigationTimeout: 10000,
    trace: "on-first-retry",
  },
  projects,
  webServer: webServers,
  fullyParallel: true,
  // Default workers (half CPU count) for local runs; CI stays single-threaded
  // for stability. Fixtures with HMR tests (basic) are pinned to
  // fullyParallel: false at the project level — see SERIAL_FIXTURES above.
  workers: process.env["CI"] ? 1 : undefined,
  // Config-HMR tests tagged @dev only run against the dev server; build-mode
  // tests skip them (and vice-versa). Non-tagged tests run in both modes.
  grepInvert: isStart ? /@dev/ : /@build/,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  reporter: "list",
});
