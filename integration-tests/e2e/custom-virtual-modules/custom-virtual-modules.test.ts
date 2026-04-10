/** Validates that hardcoded custom virtual modules override on-disk fixture content in dev and build modes. */

import { expect, test } from "@playwright/test";

test.describe("custom virtual modules", () => {
  test("renders hardcoded virtual content on the home page", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Virtual Home" })).toBeVisible();
    await expect(page.getByText("This came from custom virtual modules.")).toBeVisible();
    await expect(page.getByText("Placeholder Home")).not.toBeVisible();
  });

  test("renders hardcoded virtual content on a second page", async ({ page }) => {
    await page.goto("/getting-started");

    await expect(page.getByRole("heading", { name: "Virtual Getting Started" })).toBeVisible();
    await expect(page.getByText("This also came from custom virtual modules.")).toBeVisible();
    await expect(page.getByText("Placeholder Getting Started")).not.toBeVisible();
  });
});
