import { expect, test } from "@playwright/test";

/**
 * Fixture: fixtures/dropdowns/
 * Config shape: `navigation.dropdowns` with content sections + external link.
 */

test.describe("dropdowns fixture — navigation.dropdowns with content + external link", () => {
  test("renders dropdown selector in header", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/docs/intro", { waitUntil: "domcontentloaded" });

    // Dropdown select should be visible in the header
    const dropdownSelect = page.getByRole("combobox", {
      name: "Select section",
    });
    await expect(dropdownSelect).toBeVisible();
  });

  test("dropdown selector shows all items including external", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/docs/intro", { waitUntil: "domcontentloaded" });

    const dropdownSelect = page.getByRole("combobox", {
      name: "Select section",
    });
    const options = dropdownSelect.locator("option");
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveText("Documentation");
    await expect(options.nth(1)).toHaveText("API Reference");
    await expect(options.nth(2)).toHaveText("Blog");
  });

  test("Documentation is selected when visiting docs pages", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/docs/intro", { waitUntil: "domcontentloaded" });

    const dropdownSelect = page.getByRole("combobox", {
      name: "Select section",
    });
    // Documentation's first page href should be selected
    await expect(dropdownSelect).toHaveValue("/docs/intro");
  });

  test("docs pages are routable", async ({ request }) => {
    const response = await request.get("/docs/intro");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Introduction");
  });

  test("api pages are routable", async ({ request }) => {
    const response = await request.get("/api/overview");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("API Overview");
  });

  test("HTML response contains dropdown selector markup", async ({
    request,
  }) => {
    const response = await request.get("/docs/intro");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Select section");
    expect(html).toContain("Documentation");
    expect(html).toContain("API Reference");
    expect(html).toContain("Blog");
  });
});
