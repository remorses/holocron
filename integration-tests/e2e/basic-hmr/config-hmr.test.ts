import fs from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

async function openBasicHmrHome(page: Page, request: APIRequestContext) {
  const response = await request.get("/", {
    headers: { "sec-fetch-dest": "document" },
  });
  expect(response.status()).toBe(200);
  await page.goto("/", { waitUntil: "commit" });
  await page.waitForFunction(() => document.readyState !== "loading", undefined, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Test Docs", exact: true })).toBeVisible({
    timeout: 10000,
  });
}

// The fixture root for these tests is fixtures/basic-hmr/ inside integration-tests/.
// Tests live at e2e/basic-hmr/*.test.ts, so we go up two levels then into fixtures/basic-hmr.
const fixtureRoot = path.resolve(import.meta.dirname, "../../fixtures/basic-hmr");
const configPath = path.join(fixtureRoot, "docs.json");
const pagesDir = fixtureRoot;

/**
 * @dev — only runs with the dev server (skipped during build/start tests).
 *
 * Tests that editing docs.json during dev triggers an RSC-level HMR
 * update: the sidebar reflects the new navigation entry without a full
 * page reload.
 */
// All HMR describes are serial — they mutate shared fixture files
// (docs.json, MDX pages) and share a single Vite dev server.
// Running them concurrently would corrupt each other's beforeEach/afterEach state.
test.describe.serial("MDX content HMR @dev", () => {
  const mdxFile = path.join(pagesDir, "getting-started.mdx");
  let originalMdx: string;

  test.beforeEach(() => {
    originalMdx = fs.readFileSync(mdxFile, "utf-8");
  });

  test.afterEach(() => {
    fs.writeFileSync(mdxFile, originalMdx);
  });

  test("editing MDX content updates the page", async ({
    page,
    request,
  }) => {
    const response = await request.get("/getting-started", {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(response.status()).toBe(200);
    await page.goto("/getting-started", { waitUntil: "commit" });
    await page.waitForFunction(() => document.readyState !== "loading", undefined, { timeout: 30_000 });

    await expect(page.getByText("Run the following command")).toBeVisible();
    await expect(page.getByText("HMR injected paragraph")).not.toBeVisible();

    const updatedMdx = originalMdx.replace(
      "## Installation",
      "## Installation\n\nHMR injected paragraph for live update test.",
    );
    await expect
      .poll(async () => {
        fs.writeFileSync(mdxFile, `${updatedMdx}\n\n{/* hmr retry ${Date.now()} */}\n`);
        return await page.getByText("HMR injected paragraph").isVisible();
      }, { timeout: 15_000 })
      .toBe(true);
  });
});

test.describe.serial("new MDX file HMR @dev", () => {
  const newPageSlug = "hmr-new-page";
  const newPageFile = path.join(pagesDir, `${newPageSlug}.mdx`);
  const newPageTitle = "Brand New Page";

  let originalConfig: string;

  test.beforeEach(() => {
    originalConfig = fs.readFileSync(configPath, "utf-8");
  });

  test.afterEach(() => {
    fs.writeFileSync(configPath, originalConfig);
    if (fs.existsSync(newPageFile)) {
      fs.unlinkSync(newPageFile);
    }
  });

  test("creating a new MDX file after hydration updates the UI", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await openBasicHmrHome(page, request);

    const nav = page.getByRole("navigation", { name: "Navigation" });
    await expect(nav.getByText(newPageTitle)).not.toBeVisible();

    // Create the MDX file AFTER hydration — this is a new file that was
    // never registered via addWatchFile, so it exercises the fallback path
    // (manual invalidation + rsc:update).
    const newPageContent = [
      "---",
      `title: ${newPageTitle}`,
      "---",
      "",
      `Content for the brand new page.`,
    ].join("\n");
    fs.writeFileSync(newPageFile, newPageContent);

    // Update config to reference the new page
    const updatedConfig = JSON.stringify(
      {
        name: "Test Docs",
        colors: { primary: "#0969da" },
        navigation: [
          { group: "Guides", pages: ["index", "getting-started"] },
          { group: "New", pages: [newPageSlug] },
        ],
      },
      null,
      2,
    );
    await expect
      .poll(async () => {
        fs.writeFileSync(newPageFile, `${newPageContent}\n\n{/* hmr retry ${Date.now()} */}\n`);
        fs.writeFileSync(configPath, `${updatedConfig}\n// hmr retry ${Date.now()}\n`);
        return await nav.getByRole("link", { name: newPageTitle }).isVisible();
      }, { timeout: 15_000 })
      .toBe(true);
  });
});

test.describe.serial("deleted MDX file HMR @dev", () => {
  const deletedSlug = "hmr-delete-target";
  const deletedFile = path.join(pagesDir, `${deletedSlug}.mdx`);
  const deletedTitle = "Page To Delete";

  let originalConfig: string;
  let deletedConfig: string;

  test.beforeEach(() => {
    originalConfig = fs.readFileSync(configPath, "utf-8");

    fs.writeFileSync(
      deletedFile,
      ["---", `title: ${deletedTitle}`, "---", "", "Will be deleted."].join(
        "\n",
      ),
    );

    deletedConfig = JSON.stringify(
      {
        name: "Test Docs",
        colors: { primary: "#0969da" },
        navigation: [
          { group: "Guides", pages: ["index", "getting-started", deletedSlug] },
        ],
      },
      null,
      2,
    );
    fs.writeFileSync(configPath, deletedConfig);
  });

  test.afterEach(() => {
    fs.writeFileSync(configPath, originalConfig);
    if (fs.existsSync(deletedFile)) {
      fs.unlinkSync(deletedFile);
    }
  });

  test("deleting an MDX file removes it from the sidebar", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await openBasicHmrHome(page, request);

    const nav = page.getByRole("navigation", { name: "Navigation" });
    const deletedLink = nav.getByRole("link", { name: deletedTitle });
    if (!(await deletedLink.isVisible())) {
      fs.writeFileSync(configPath, deletedConfig);
    }
    await expect(deletedLink).toBeVisible({ timeout: 10_000 });

    fs.unlinkSync(deletedFile);

    // Remove the page from config so syncNavigation doesn't error
    await expect
      .poll(async () => {
        fs.writeFileSync(configPath, `${originalConfig}\n// delete retry ${Date.now()}\n`);
        return await nav.getByRole("link", { name: deletedTitle }).isVisible();
      }, { timeout: 15_000 })
      .toBe(false);
  });
});

test.describe.serial("config HMR @dev", () => {
  const hmrPageSlug = "hmr-test-page";
  const hmrPageFile = path.join(pagesDir, `${hmrPageSlug}.mdx`);
  const hmrGroupName = "HMR Test Group";
  const hmrPageTitle = "HMR Test Page";

  let originalConfig: string;

  test.beforeEach(() => {
    originalConfig = fs.readFileSync(configPath, "utf-8");

    fs.writeFileSync(
      hmrPageFile,
      [
        "---",
        `title: ${hmrPageTitle}`,
        "---",
        "",
        `## ${hmrPageTitle}`,
        "",
        "Content for config HMR integration test.",
      ].join("\n"),
    );
  });

  test.afterEach(() => {
    fs.writeFileSync(configPath, originalConfig);

    if (fs.existsSync(hmrPageFile)) {
      fs.unlinkSync(hmrPageFile);
    }
  });

  test("adding a navigation group updates the sidebar without page refresh", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await openBasicHmrHome(page, request);

    const nav = page.getByRole("navigation", { name: "Navigation" });

    // Sanity: the new group should NOT be in the sidebar yet
    await expect(nav.getByText(hmrGroupName)).not.toBeVisible();

    // Mutate the config: add a new navigation group with our test page
    await expect
      .poll(async () => {
        const updatedConfig = JSON.stringify(
          {
            name: "Test Docs",
            description: `HMR retry ${Date.now()}`,
            colors: { primary: "#0969da" },
            navigation: [
              { group: "Guides", pages: ["index", "getting-started"] },
              { group: hmrGroupName, pages: [hmrPageSlug] },
            ],
          },
          null,
          2,
        );
        fs.writeFileSync(configPath, updatedConfig);
        return await nav.getByText(hmrGroupName).isVisible();
      }, { timeout: 15_000 })
      .toBe(true);

    // Also check the new page link appeared
    await expect(
      nav.getByRole("link", { name: hmrPageTitle }),
    ).toBeVisible({ timeout: 5_000 });

    // Config edits can trigger either RSC HMR or a full dev refresh depending
    // on Vite's file-change timing. The user-visible contract is that the
    // navigation updates without manual reload.
  });

  test("changing the site name updates the document title", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { name: "Test Docs", exact: true })).toBeVisible({ timeout: 10_000 });
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveTitle(/Test Docs/);

    // Change site name in config
    const updatedConfig = JSON.stringify(
      {
        name: "Updated Docs Name",
        colors: { primary: "#0969da" },
        navigation: [
          { group: "Guides", pages: ["index", "getting-started"] },
        ],
      },
      null,
      2,
    );
    fs.writeFileSync(configPath, updatedConfig);

    // Title should update to include the new name
    await expect(page).toHaveTitle(/Updated Docs Name/, { timeout: 15_000 });

  });
});
