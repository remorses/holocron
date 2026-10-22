import { expect, test } from "../helpers/test.ts";

/**
 * Fixture: fixtures/page-modes/
 * Config shape: pages using the Mintlify-compatible `mode` frontmatter field.
 * Holocron resolves page and site modes into four layouts:
 * - `default` (+ `wide`, `frame`): full editorial layout with left nav
 * - `compact`: left nav + content without the optional right aside
 * - `center`: hides left nav, centers content in 2-column grid
 * The site is compact, so every page uses the narrow frame. Center pages keep
 * the right aside; other pages drop it.
 * - `custom`: strips the editorial grid entirely, only navbar + footer +
 *   raw content. For landing pages and custom layouts.
 */

test.describe("page frontmatter mode", () => {
  test("compact site mode removes the optional right aside and narrows the shell", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Compact content" })).toBeVisible();
    await expect(page.locator(".slot-sidebar-left")).toBeVisible();
    await expect(page.locator(".slot-aside")).toHaveCount(0);
    await expect(page.locator("[data-chat-shell='sidebar']")).toHaveCount(0);

    const compactHeader = await page.locator(".slot-navbar > .mx-auto").first().boundingBox();
    const compactMain = await page.locator(".slot-main").first().boundingBox();
    expect(compactHeader).not.toBeNull();
    expect(compactMain).not.toBeNull();
    expect(Math.abs(
      compactHeader!.x + compactHeader!.width - compactMain!.x - compactMain!.width,
    )).toBeLessThan(2);

    // 1200px max width - 230px right aside - 40px gap
    expect(compactHeader!.width).toBe(930);

    // mode: default on a compact site keeps the compact frame, so navigating does not shift the layout.
    await page.goto("/default", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Default content" })).toBeVisible();
    await expect(page.locator(".slot-sidebar-left")).toBeVisible();
    await expect(page.locator(".slot-aside")).toHaveCount(0);
    const defaultHeader = await page.locator(".slot-navbar > .mx-auto").first().boundingBox();
    expect(defaultHeader!.width).toBe(compactHeader!.width);
  });

  test("floating assistant leaves space below the footer", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const pill = page.locator(".holocron-chat-pill");
    await expect(pill).toBeVisible();
    const footer = page.locator("footer");
    await expect(footer).toHaveCSS("padding-bottom", "60px");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footerBox = await footer.boundingBox();
    const pillBox = await pill.boundingBox();
    expect(footerBox).not.toBeNull();
    expect(pillBox).not.toBeNull();
    expect(footerBox!.y + footerBox!.height).toBeGreaterThan(pillBox!.y);
  });

  test("compact pages keep Ask AI in the mobile bar", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByText("Ask AI", { exact: true }).click();
    await expect(page.locator(".holocron-chat-drawer-panel")).toBeVisible({ timeout: 10000 });
  });

  test("frontmatter-only compact pages render their generated h1", async ({ page }) => {
    await page.goto("/empty-compact", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1, name: "Empty compact page" })).toBeVisible();
  });

  test("callout asides stay in the main column in compact mode", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/required-aside", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Required right rail content.", { exact: true })).toBeVisible();
    await expect(page.locator(".slot-aside")).toHaveCount(0);
    await expect(page.locator("[data-chat-shell='sidebar']")).toHaveCount(0);
  });

  test("center mode on a compact site keeps the right aside inside the compact frame", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/center", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Center content" })).toBeVisible();
    await expect(page.locator(".slot-sidebar-left")).toHaveCount(0);
    await expect(page.locator(".slot-aside").getByText("Center right rail content.")).toBeVisible();

    const header = await page.locator(".slot-navbar > .mx-auto").first().boundingBox();
    const aside = await page.locator(".slot-aside").first().boundingBox();
    expect(header!.width).toBe(930);
    expect(Math.abs(header!.x + header!.width - aside!.x - aside!.width)).toBeLessThan(2);
  });


  test("wide mode aliases to the default layout (left nav kept)", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/wide", { waitUntil: "domcontentloaded" });

    await expect(page.locator(".slot-sidebar-left")).toBeVisible();
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
