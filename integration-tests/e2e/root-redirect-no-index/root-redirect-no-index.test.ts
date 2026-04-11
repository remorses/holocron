/**
 * Verifies that `/` redirects to the first configured page when `index.mdx`
 * does not exist in the fixture.
 */

import { expect, test } from "@playwright/test";

test.describe("root redirect without index", () => {
  test("GET / redirects to the first page", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(307);
    expect(new URL(response.headers()["location"]!).pathname).toBe("/getting-started");
  });

  test("browser navigation lands on the first page", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/getting-started$/);
    await expect(page.getByRole("heading", { name: "Redirect Target" })).toBeVisible();
  });
});
