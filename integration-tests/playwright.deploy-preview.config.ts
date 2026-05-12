// Playwright config for the live preview deploy smoke test.
// It does not start local fixture servers because the test talks to holocron.so.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e/deploy-preview",
  timeout: 180_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    ...devices["Desktop Chrome"],
    actionTimeout: 10_000,
    navigationTimeout: 45_000,
    trace: "on-first-retry",
  },
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: "list",
});
