import { expect, test } from "../helpers/test.ts";

/**
 * Fixture: fixtures/page-modes/
 * Config shape: pages using the Mintlify-compatible `mode` frontmatter field.
 * Holocron resolves the five Mintlify modes into three layouts:
 * - `default` (+ `wide`, `frame`): full editorial layout with left nav
 * - `center`: hides left nav, centers content in 2-column grid
 * - `custom`: strips the editorial grid entirely, only navbar + footer +
 *   raw content. For landing pages and custom layouts.
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

  test("custom mode strips the editorial grid (no sidebar, no aside, no sections grid)", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/custom", { waitUntil: "domcontentloaded" });

    // No left sidebar, no aside column, no editorial section grid
    await expect(page.locator(".slot-sidebar-left")).toHaveCount(0);
    await expect(page.locator(".slot-aside")).toHaveCount(0);
    await expect(page.locator(".slot-sidebar-right")).toHaveCount(0);

    // Custom content renders directly
    await expect(page.locator("text=Custom Landing Page")).toBeVisible();
    await expect(page.locator("text=full layout control")).toBeVisible();

    // Navbar still renders
    await expect(page.locator(".slot-navbar")).toBeVisible();

    // maxWidth from frontmatter constrains the content container
    const container = page.locator(".slot-page > div").filter({ hasText: "Custom Landing Page" });
    await expect(container).toHaveCSS("max-width", "600px");
  });
});
