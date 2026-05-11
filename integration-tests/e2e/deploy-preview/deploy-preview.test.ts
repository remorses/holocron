// Live deploy smoke test for Holocron preview hosting.
// It builds a temporary docs site, deploys it to preview.holocron.so, then
// verifies the hosted Dynamic Worker serves HTML, CSS, and client navigation.

import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { integrationTestsDir } from "../../scripts/fixtures.ts";

const deployE2EEnabled = process.env["HOLOCRON_DEPLOY_E2E"] === "1";
const previewApiKey = process.env["HOLOCRON_PREVIEW_KEY"] || process.env["HOLOCRON_KEY"];
const previewProjectId = process.env["HOLOCRON_PREVIEW_PROJECT_ID"];
const previewApiUrl = process.env["HOLOCRON_PREVIEW_API_URL"]
  || process.env["HOLOCRON_API_URL"]
  || "https://preview.holocron.so";

test.skip(!deployE2EEnabled, "Set HOLOCRON_DEPLOY_E2E=1 to run the live preview deploy test.");
test.skip(
  deployE2EEnabled && !previewApiKey && !previewProjectId,
  "Set HOLOCRON_PREVIEW_KEY/HOLOCRON_KEY, or set HOLOCRON_PREVIEW_PROJECT_ID and log in to preview.",
);

const repoRoot = path.resolve(integrationTestsDir, "..");
const basicFixtureDir = path.join(integrationTestsDir, "fixtures/basic");
const deployRunsDir = path.join(integrationTestsDir, ".deploy-preview-runs");
const cliSource = path.join(repoRoot, "cli/src/bin.ts");
const tsxBin = path.join(integrationTestsDir, "node_modules/.bin/tsx");

function runCommand({
  command,
  args,
  cwd,
  env,
}: {
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error([
          `${command} ${args.join(" ")} failed with exit ${code}`,
          stdout,
          stderr,
        ].filter(Boolean).join("\n\n")),
      );
    });
    child.on("error", reject);
  });
}

function createDeployRoot(branch: string): string {
  fs.mkdirSync(deployRunsDir, { recursive: true });
  const deployRoot = fs.mkdtempSync(path.join(deployRunsDir, `${branch}-`));

  fs.cpSync(basicFixtureDir, deployRoot, {
    recursive: true,
    filter(source) {
      return !source.includes(`${path.sep}.e2e-dist${path.sep}`)
        && !source.includes(`${path.sep}node_modules${path.sep}`);
    },
  });

  const marker = `Live preview marker ${branch}`;
  fs.appendFileSync(path.join(deployRoot, "index.mdx"), `\n\n## ${marker}\n`);
  fs.writeFileSync(
    path.join(deployRoot, "vite.config.ts"),
    [
      `import { defineConfig } from 'vite'`,
      `import { holocron } from '@holocron.so/vite/vite'`,
      ``,
      `export default defineConfig({`,
      `  clearScreen: false,`,
      `  plugins: [holocron()],`,
      `})`,
      ``,
    ].join("\n"),
  );

  return deployRoot;
}

function parseDeployUrl(output: string): string {
  const match = output.match(/Deployed!\s+(https:\/\/\S+)/);
  if (!match?.[1]) {
    throw new Error(`Could not find deployed URL in CLI output:\n\n${output}`);
  }
  return match[1];
}

test.describe.configure({ mode: "serial" });

test.describe("preview hosting deploy", () => {
  const branch = `e2e-${Date.now().toString(36).slice(-6)}-${process.pid.toString(36)}`;
  const marker = `Live preview marker ${branch}`;
  let deployedUrl = "";
  let deployRoot = "";

  test.beforeAll(async () => {
    deployRoot = createDeployRoot(branch);
    const sharedEnv: NodeJS.ProcessEnv = {
      HOLOCRON_API_URL: previewApiUrl,
      CI: "1",
    };
    if (previewApiKey) {
      sharedEnv.HOLOCRON_KEY = previewApiKey;
    }

    await runCommand({
      command: "pnpm",
      args: ["exec", "vite", "build", deployRoot, "--config", path.join(deployRoot, "vite.config.ts")],
      cwd: integrationTestsDir,
      env: {
        ...sharedEnv,
        HOLOCRON_DEPLOY: "1",
      },
    });

    const deployArgs = ["exec", "tsx", cliSource, "deploy", "--skip-build", "--branch", branch];
    if (previewProjectId) {
      deployArgs.push("--project", previewProjectId);
    }

    const deploy = await runCommand({
      command: tsxBin,
      args: deployArgs.slice(2),
      cwd: deployRoot,
      env: {
        ...sharedEnv,
        ...(previewApiKey ? { HOLOCRON_CONFIG_DIR: path.join(deployRoot, ".holocron") } : {}),
      },
    });
    deployedUrl = parseDeployUrl(`${deploy.stdout}\n${deploy.stderr}`);
    console.log(`deployed preview url: ${deployedUrl}`);
  });

  test.afterAll(() => {
    if (deployRoot) {
      fs.rmSync(deployRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });

  test("serves pages, CSS, and client-side navigation from the deployed preview worker", async ({
    page,
    request,
  }) => {
    expect(deployedUrl).toContain("-site-preview.holocron.so");

    const homeResponse = await request.get(deployedUrl, {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await homeResponse.text();
    expect(homeResponse.status(), html).toBe(200);
    expect(html).toContain("Welcome to Test Docs");
    expect(html).toContain(marker);
    expect(html).not.toContain("Internal error:");

    const cssFailures: string[] = [];
    const cssResponses: string[] = [];
    page.on("response", (response) => {
      const responseUrl = response.url();
      const isCss = response.request().resourceType() === "stylesheet" || responseUrl.endsWith(".css");
      if (!isCss) return;

      cssResponses.push(responseUrl);
      if (!response.ok()) {
        cssFailures.push(`${response.status()} ${responseUrl}`);
      }
    });
    page.on("requestfailed", (requestInfo) => {
      const requestUrl = requestInfo.url();
      const isCss = requestInfo.resourceType() === "stylesheet" || requestUrl.endsWith(".css");
      if (!isCss) return;

      cssFailures.push(`${requestInfo.failure()?.errorText ?? "failed"} ${requestUrl}`);
    });

    await page.goto(deployedUrl, { waitUntil: "networkidle" });
    await expect(page).toHaveTitle(/Welcome to Test Docs/);
    await expect(page.getByRole("heading", { name: marker })).toBeVisible();
    expect(cssResponses.length).toBeGreaterThan(0);
    expect(cssFailures).toEqual([]);

    await page.evaluate(() => {
      document.documentElement.dataset.deployPreviewNavigation = "client";
    });

    await page.locator("a[href='/getting-started']").first().click();
    await expect(page).toHaveURL(/\/getting-started\/?$/);
    await expect(page.getByRole("heading", { name: "Installation" })).toBeVisible();
    await expect(page).toHaveTitle(/Getting Started/);

    const markerAfterNavigation = await page.evaluate(
      () => document.documentElement.dataset.deployPreviewNavigation,
    );
    expect(markerAfterNavigation).toBe("client");

    const gettingStartedResponse = await request.get(new URL("/getting-started", deployedUrl).toString(), {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(gettingStartedResponse.status()).toBe(200);
    expect(await gettingStartedResponse.text()).toContain("Getting Started");
  });
});
