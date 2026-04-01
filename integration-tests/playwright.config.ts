import { defineConfig, devices } from "@playwright/test";
import { createServer, type AddressInfo } from "node:net";

function getFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      server.close(() => resolve(port));
    });
  });
}

const port = Number(process.env.E2E_PORT) || (await getFreePort());
process.env.E2E_PORT = String(port);

const isStart = Boolean(process.env.E2E_START);
const command = isStart
  ? `PORT=${port} pnpm start`
  : `pnpm dev --port ${port} --strict-port`;

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: `http://localhost:${port}`,
    actionTimeout: 5000,
    navigationTimeout: 10000,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: null,
        deviceScaleFactor: undefined,
      },
    },
  ],
  webServer: {
    command,
    stdout: "pipe",
    stderr: "pipe",
    port,
  },
  fullyParallel: false,
  workers: 1,
  grepInvert: isStart ? /@dev/ : /@build/,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  reporter: "list",
});
