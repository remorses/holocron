import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

// integration-tests/ is the project root for these tests
const projectRoot = path.resolve(import.meta.dirname, "..");
const configPath = path.join(projectRoot, "holocron.jsonc");
const pagesDir = path.join(projectRoot, "pages");

/**
 * @dev — only runs with the dev server (skipped during build/start tests).
 *
 * Tests that editing holocron.jsonc during dev triggers an RSC-level HMR
 * update: the sidebar reflects the new navigation entry without a full
 * page reload.
 */
test.describe("MDX content HMR @dev", () => {
  const mdxFile = path.join(pagesDir, "getting-started.mdx");
  let originalMdx: string;

  test.beforeEach(() => {
    originalMdx = fs.readFileSync(mdxFile, "utf-8");
  });

  test.afterEach(() => {
    fs.writeFileSync(mdxFile, originalMdx);
  });

  test("editing MDX content updates the page without page refresh", async ({
    page,
  }) => {
    await page.goto("/getting-started");
    await page.waitForTimeout(2000);

    await expect(page.getByText("Run the following command")).toBeVisible();
    await expect(page.getByText("HMR injected paragraph")).not.toBeVisible();

    await page.evaluate(() => {
      (window as any).__hmr_test_no_reload = true;
    });

    const updatedMdx = originalMdx.replace(
      "## Installation",
      "## Installation\n\nHMR injected paragraph for live update test.",
    );
    fs.writeFileSync(mdxFile, updatedMdx);

    await expect(page.getByText("HMR injected paragraph")).toBeVisible({
      timeout: 10_000,
    });

    const noReload = await page.evaluate(
      () => (window as any).__hmr_test_no_reload,
    );
    expect(noReload, "Page did a full reload instead of HMR update").toBe(
      true,
    );
  });
});

test.describe("new MDX file HMR @dev", () => {
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

  test("creating a new MDX file after hydration updates the UI without page refresh", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");
    await page.waitForTimeout(2000);

    const nav = page.getByRole("navigation", { name: "Navigation" });
    await expect(nav.getByText(newPageTitle)).not.toBeVisible();

    await page.evaluate(() => {
      (window as any).__hmr_test_no_reload = true;
    });

    // Create the MDX file AFTER hydration — this is a new file that was
    // never registered via addWatchFile, so it exercises the fallback path
    // (manual invalidation + rsc:update).
    fs.writeFileSync(
      newPageFile,
      [
        "---",
        `title: ${newPageTitle}`,
        "---",
        "",
        `Content for the brand new page.`,
      ].join("\n"),
    );

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
    fs.writeFileSync(configPath, updatedConfig);

    await expect(
      nav.getByRole("link", { name: newPageTitle }),
    ).toBeVisible({ timeout: 10_000 });

    const noReload = await page.evaluate(
      () => (window as any).__hmr_test_no_reload,
    );
    expect(noReload, "Page did a full reload instead of HMR update").toBe(
      true,
    );
  });
});

test.describe("config HMR @dev", () => {
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
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");

    // Wait for hydration so the rsc:update listener is active
    await page.waitForTimeout(2000);

    const nav = page.getByRole("navigation", { name: "Navigation" });

    // Sanity: the new group should NOT be in the sidebar yet
    await expect(nav.getByText(hmrGroupName)).not.toBeVisible();

    // Track whether a full page navigation/reload happens.
    // We set a JS variable on the window — if it disappears after the
    // config change, a full reload occurred (which we don't want).
    await page.evaluate(() => {
      (window as any).__hmr_test_no_reload = true;
    });

    // Mutate the config: add a new navigation group with our test page
    const updatedConfig = JSON.stringify(
      {
        name: "Test Docs",
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

    // Wait for the RSC update to propagate.
    // The sidebar should now contain the new group name.
    await expect(nav.getByText(hmrGroupName)).toBeVisible({ timeout: 10_000 });

    // Also check the new page link appeared
    await expect(
      nav.getByRole("link", { name: hmrPageTitle }),
    ).toBeVisible({ timeout: 5_000 });

    // Verify no full page reload happened
    const noReload = await page.evaluate(
      () => (window as any).__hmr_test_no_reload,
    );
    expect(noReload, "Page did a full reload instead of HMR update").toBe(
      true,
    );
  });

  test("changing the site name updates the document title without page refresh", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);

    await expect(page).toHaveTitle(/Test Docs/);

    await page.evaluate(() => {
      (window as any).__hmr_test_no_reload = true;
    });

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
    await expect(page).toHaveTitle(/Updated Docs Name/, { timeout: 10_000 });

    const noReload = await page.evaluate(
      () => (window as any).__hmr_test_no_reload,
    );
    expect(noReload, "Page did a full reload instead of HMR update").toBe(
      true,
    );
  });
});
