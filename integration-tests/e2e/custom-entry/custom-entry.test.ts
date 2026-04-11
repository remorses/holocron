// Custom-entry fixture: user Spiceflow entry mounting holocron as a child.

import { expect, test } from "@playwright/test";

test.describe("user API routes alongside holocron", () => {
  test("GET /api/hello returns user-owned JSON", async ({ request }) => {
    const res = await request.get("/api/hello");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ hello: "world" });
    expect(res.headers()["x-user-middleware"]).toBe("ran");
  });

  test("GET /api/echo/:name returns parametric JSON", async ({ request }) => {
    const res = await request.get("/api/echo/tommy");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ name: "tommy" });
    expect(res.headers()["x-user-middleware"]).toBe("ran");
  });
});

test.describe("user .page with user .layout", () => {
  // Regression: the wildcard loader used to set response.status = 404 for
  // paths not in holocron's slug list, poisoning user routes. Now the 404
  // status is only set inside wildcardLayoutFn when children === null.
  test("GET /custom-user-page returns 200", async ({ request }) => {
    const res = await request.get("/custom-user-page");
    expect(res.status()).toBe(200);
    expect(res.headers()["x-user-middleware"]).toBe("ran");
  });

  test("renders the user-owned page with the user's layout", async ({ page }) => {
    await page.goto("/custom-user-page");
    await expect(page.locator("html")).toHaveAttribute("data-user-layout", "yes");
    await expect(page.locator("[data-user-header='yes']")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /owned by the user/i }),
    ).toBeVisible();
  });

  test("user page is NOT wrapped by holocron's layout", async ({ page }) => {
    // `data-default-theme` is holocron-specific; its absence here means
    // holocron's per-slug layout didn't match the user-owned path.
    await page.goto("/custom-user-page");
    const themeAttr = await page.locator("html").getAttribute("data-default-theme");
    expect(themeAttr).toBeNull();
  });
});

test.describe("holocron pages rendered by mounted holocronApp", () => {
  test("GET / renders the holocron docs landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Custom Entry Test/);
    await expect(
      page.getByRole("heading", { name: "Custom Entry Home" }),
    ).toBeVisible();
  });

  test("GET /about-the-api renders the holocron docs page", async ({ page }) => {
    await page.goto("/about-the-api");
    await expect(page).toHaveTitle(/About the API/);
    await expect(
      page.getByRole("heading", { name: "About the API" }),
    ).toBeVisible();
  });

  test("holocron layout wraps docs pages with <html data-default-theme>", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute(
      "data-default-theme",
      /.+/,
    );
    const userLayoutAttr = await page.locator("html").getAttribute("data-user-layout");
    expect(userLayoutAttr).toBeNull();
  });

  test("GET /sitemap.xml lists holocron-owned slugs only", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("/about-the-api");
    expect(body).not.toContain("/custom-user-page");
  });

  test("GET /about-the-api.md returns raw markdown for agents", async ({ request }) => {
    const res = await request.get("/about-the-api.md");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("About the API");
  });
});

test.describe("layout identity preservation across holocron navigations", () => {
  // Verifies that per-slug layouts share the same captured fn reference →
  // React reconciles by element type and keeps the <html> node alive
  // across client-side navigations between holocron pages.
  test("stamped DOM nodes survive client-side navigation between holocron pages", async ({ page }) => {
    // Wide viewport so the desktop sidebar links are visible.
    await page.setViewportSize({ width: 1400, height: 900 });

    // `networkidle` ensures hydration finished before we click, so the
    // spiceflow router intercepts the anchor instead of a hard reload.
    await page.goto("/", { waitUntil: "networkidle" });

    await page.evaluate(() => {
      document.documentElement.dataset.stamp = "original";
    });

    const link = page.locator("a[href='/about-the-api']").first();
    await expect(link).toBeVisible();
    await link.click();

    await expect(
      page.getByRole("heading", { name: "About the API" }),
    ).toBeVisible();
    expect(page.url()).toMatch(/\/about-the-api(\/)?$/);

    const stampAfter = await page.evaluate(
      () => document.documentElement.dataset.stamp,
    );
    expect(stampAfter).toBe("original");
  });
});
