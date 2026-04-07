import { expect, test } from "@playwright/test";

/**
 * Fixture: fixtures/versions/
 * Config shape: `navigation.versions` with two versions (v1.0 Legacy, v2.0 Latest default).
 */

test.describe("versions fixture — navigation.versions with version switcher", () => {
  test("renders version selector in header", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/v2/overview");

    // Version select should be visible in the header
    const versionSelect = page.getByRole("combobox", {
      name: "Select version",
    });
    await expect(versionSelect).toBeVisible();
  });

  test("version selector shows both versions with tags", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/v2/overview");

    const versionSelect = page.getByRole("combobox", {
      name: "Select version",
    });
    // Check options exist
    const options = versionSelect.locator("option");
    await expect(options).toHaveCount(2);
    await expect(options.nth(0)).toHaveText("v1.0 (Legacy)");
    await expect(options.nth(1)).toHaveText("v2.0 (Latest)");
  });

  test("default version (v2.0) is selected when visiting v2 page", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/v2/overview");

    const versionSelect = page.getByRole("combobox", {
      name: "Select version",
    });
    // v2.0's first page href should be selected
    await expect(versionSelect).toHaveValue("/v2/overview");
  });

  test("v1 pages are routable", async ({ request }) => {
    const response = await request.get("/v1/overview");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("v1 Overview");
  });

  test("hidden v1 page still resolves the owning version in the selector", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/v1/hidden-page");

    const versionSelect = page.getByRole("combobox", {
      name: "Select version",
    });
    await expect(versionSelect).toHaveValue("/v1/overview");
  });

  test("v2 pages are routable", async ({ request }) => {
    const response = await request.get("/v2/overview");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("v2 Overview");
  });

  test("HTML response contains version selector markup", async ({
    request,
  }) => {
    const response = await request.get("/v2/overview");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Select version");
    expect(html).toContain("v1.0 (Legacy)");
    expect(html).toContain("v2.0 (Latest)");
  });
});
