/** Validates that hardcoded custom virtual modules override on-disk fixture content in dev and build modes. */

import { expect, test } from "@playwright/test";

test.describe("custom virtual modules", () => {
  test("virtual config overrides the local config and renders the version select", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/v2/overview", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("link", { name: "Virtual Config Override" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Virtual v2 Overview" })).toBeVisible();
    await expect(page.getByText("This came from custom virtual modules.")).toBeVisible();
    const versionSelect = page.getByRole("combobox", { name: "Select version" });
    await expect(versionSelect).toBeVisible();
    await expect(versionSelect.locator("option")).toHaveCount(2);
    await expect(versionSelect.locator("option").nth(0)).toHaveText("v1.0 (Legacy)");
    await expect(versionSelect.locator("option").nth(1)).toHaveText("v2.0 (Latest)");
    await expect(versionSelect).toHaveValue("/v2/overview");
    await expect(page.getByRole("link", { name: "Local Docs" })).toHaveCount(0);
    await expect(page.getByText("Placeholder Home")).toHaveCount(0);
  });

  test("renders a desktop tab bar item from the virtual config", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/v2/overview", { waitUntil: "domcontentloaded" });

    const tabBar = page.locator(".slot-tabbar");
    const changelogLink = tabBar.getByRole("link", { name: "Changelog" });

    await expect(changelogLink).toBeVisible();
    await expect(changelogLink).toHaveAttribute("href", "https://example.com/changelog");
  });

  test("renders hardcoded virtual content on a second versioned page", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/v2/getting-started", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Virtual v2 Getting Started" })).toBeVisible();
    await expect(page.getByText("This also came from custom virtual modules.")).toBeVisible();
    await expect(page.getByText("Placeholder Getting Started")).toHaveCount(0);
  });

  test("renders navigation added only by the virtual config module", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/v2/api", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Virtual v2 API" })).toBeVisible();
    await expect(page.getByText("This page only exists in the virtual config navigation.")).toBeVisible();
    await expect(page.getByText("Local Guides")).toHaveCount(0);
  });

  test("selects the owning legacy version on v1 pages", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/v1/overview", { waitUntil: "commit" });

    await expect(page.getByRole("heading", { name: "Virtual v1 Overview" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Select version" })).toHaveValue("/v1/overview");
  });
});
