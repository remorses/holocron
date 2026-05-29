import { expect, test } from "../helpers/test.ts";

/**
 * Fixture: fixtures/page-modes/
 * Config shape: pages using the Mintlify-compatible `mode` frontmatter field.
 * Holocron collapses the five Mintlify modes into two layouts: `default`
 * (left nav kept) and `center` (left nav hidden). `wide`/`frame` alias to
 * default, `custom` aliases to center.
 */

test.describe("page frontmatter mode", () => {
  test("default mode keeps the left navigation sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Standard content" })).toBeVisible();
    await expect(page.locator(".slot-sidebar-left")).toBeVisible();
    await expect(page.locator(".slot-aside")).toContainText("Default right rail content");
  });

  test("center mode hides the left navigation sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/center", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Center content" })).toBeVisible();
    await expect(page.locator(".slot-sidebar-left")).toHaveCount(0);
    await expect(page.locator(".slot-aside")).toContainText("Center right rail content.");
  });

  test("wide mode aliases to the default layout (left nav kept)", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/wide", { waitUntil: "domcontentloaded" });

    await expect(page.locator(".slot-sidebar-left")).toBeVisible();
    await expect(page.locator(".slot-aside")).toContainText("Wide mode aliases to the default layout.");
  });

  test("custom mode aliases to the center layout (left nav hidden)", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/custom", { waitUntil: "domcontentloaded" });

    await expect(page.locator(".slot-sidebar-left")).toHaveCount(0);
    await expect(page.locator(".slot-aside")).toContainText("Custom mode aliases to the center layout.");
  });
});
