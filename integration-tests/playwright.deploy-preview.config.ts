// Playwright config for the live preview deploy smoke test.
// It does not start local fixture servers because the test talks to holocron.so.

import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const integrationTestsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(integrationTestsDir, "..");
const defaultPreviewProjectId = "01KRBYFEBEXFHCTS15CR414364";

function loadPreviewApiKeyFromD1(): void {
  if (process.env["HOLOCRON_DEPLOY_E2E"] !== "1") return;
  if (process.env["HOLOCRON_PREVIEW_KEY"] || process.env["HOLOCRON_KEY"]) return;

  const projectId = process.env["HOLOCRON_PREVIEW_PROJECT_ID"] || defaultPreviewProjectId;
  const escapedProjectId = projectId.replaceAll("'", "''");
  const output = execFileSync(
    "pnpm",
    [
      "--dir",
      path.join(repoRoot, "website"),
      "exec",
      "wrangler",
      "d1",
      "execute",
      "holocron-preview-db",
      "--remote",
      "--json",
      "--command",
      `select key from api_key where project_id = '${escapedProjectId}' and key is not null limit 1;`,
    ],
    { encoding: "utf8" },
  );

  const rows = JSON.parse(output) as Array<{ results?: Array<{ key?: string }> }>;
  const key = rows[0]?.results?.[0]?.key;
  if (!key) {
    throw new Error(`No preview API key found in D1 for project ${projectId}`);
  }

  process.env["HOLOCRON_PREVIEW_KEY"] = key;
  process.env["HOLOCRON_PREVIEW_PROJECT_ID"] = projectId;
}

loadPreviewApiKeyFromD1();

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
