/**
 * Changelog fixture integration tests.
 *
 * Verifies that a `changelog` tab pointing at a (mocked) GitHub releases page
 * generates a single changelog page: one Update entry per published release,
 * the left navigation sidebar hidden via `mode: center`, and a notice in the
 * right aside explaining the page is generated from GitHub releases.
 */

import { expect, test } from "../helpers/test.ts";

test.describe("changelog fixture", () => {
  test("renders one Update entry per published release", async ({ request }) => {
    const res = await request.get("/changelog", {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(res.ok()).toBe(true);
    const html = await res.text();

    // Published releases appear (newest first).
    expect(html).toContain("v2.0.0");
    expect(html).toContain("v1.5.0-beta.1");
    expect(html).toContain("v1.0.0");
    // Release body markdown is rendered.
    expect(html).toContain("Rewrote the engine");
    // Draft release is filtered out.
    expect(html).not.toContain("Should not appear");
  });

  test("shows the GitHub-generated notice in the aside", async ({ request }) => {
    const res = await request.get("/changelog", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await res.text();
    expect(html).toContain("generated automatically");
    expect(html).toContain("https://github.com/acme/widgets/releases");
  });

  test("hides the left navigation sidebar (mode: center)", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/changelog", { waitUntil: "domcontentloaded" });

    await expect(page.locator(".slot-sidebar-left")).toHaveCount(0);
    // The release name renders as the Update heading; the pill shows the date.
    await expect(page.getByRole("heading", { name: "Version 2.0" }).first()).toBeVisible();
    // The left rail pill shows the formatted publish date, not the version.
    const label = page.locator('[data-component-part="update-label"]').first();
    await expect(label).toBeVisible();
    await expect(label).toContainText("2026");
  });

  test("changelog tab is reachable from the tab bar", async ({ request }) => {
    const res = await request.get("/", { headers: { "sec-fetch-dest": "document" } });
    const html = await res.text();
    expect(html).toContain("Changelog");
  });
});
