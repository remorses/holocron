import { expect, test } from "../helpers/test.ts";

test.describe("pages under base path", () => {
  test("root redirects or serves intro page", async ({ request }) => {
    const res = await request.get("/docs/intro");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Introduction");
  });

  test("guide page renders under /docs", async ({ request }) => {
    const res = await request.get("/docs/guide");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("Guide");
    expect(body).toContain("<title>Guide — Base Path Test</title>");
  });

  test("nested index page keeps the right browser title", async ({ page }) => {
    await page.goto("/docs/guide", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle("Guide — Base Path Test");
  });

  test("explicit encoded redirects win under the base path", async ({ request }) => {
    const response = await request.get("/docs/questions-%28faq%29", { maxRedirects: 0 });

    expect(response.status()).toBe(302);
    expect(response.headers().location).toBe("/docs/guide");
  });

  test("explicit redirect wins over the base-prefixed GitHub route", async ({ request }) => {
    const response = await request.get("/docs/github", { maxRedirects: 0 });

    expect(response.status()).toBe(302);
    expect(response.headers().location).toBe("/docs/guide");
  });
});

test.describe("images under base path", () => {
  test("publicDir image src gets the base prefix and loads", async ({
    page,
    request,
  }) => {
    await page.goto("/docs/intro", { waitUntil: "domcontentloaded" });
    const img = page.locator('img[alt="Public image"]');
    await expect(img).toBeVisible();
    const src = await img.getAttribute("src");
    expect(src).toBe("/docs/images/test.png");
    const res = await request.get(src!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
    // The <Card img="/images/test.png"> renders a second img with the same
    // base-prefixed src — both must carry the base.
    await expect(page.locator('img[src="/docs/images/test.png"]')).toHaveCount(2);
  });

  test("copied image src gets the base prefix and loads", async ({
    page,
    request,
  }) => {
    await page.goto("/docs/intro", { waitUntil: "domcontentloaded" });
    const img = page.locator('img[alt="Copied image"]');
    await expect(img).toBeVisible();
    const src = await img.getAttribute("src");
    expect(src).toMatch(/^\/docs\/_holocron\/images\/[0-9a-f]{8}-photo\.png$/);
    const res = await request.get(src!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  });
});

test.describe("raw markdown under base path", () => {
  test("GET /docs/intro.md returns raw markdown", async ({ request }) => {
    const res = await request.get("/docs/intro.md");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("Agent-readable docs index: /docs/llms.txt");
    expect(body).toContain("/docs/llms-full.txt");
    expect(body).toContain("# Introduction");
  });

  test("GET /docs/guide.md returns raw markdown", async ({ request }) => {
    const res = await request.get("/docs/guide.md");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("# Guide");
  });

  test("Accept: text/markdown redirects to .md under base path", async ({ request }) => {
    const res = await request.get("/docs/intro", {
      headers: { accept: "text/markdown" },
    });
    expect(res.status()).toBe(200);
    expect(res.url()).toContain("/docs/intro.md");
    expect(res.headers()["content-type"]).toContain("text/markdown");
  });
});

test.describe("sitemap under base path", () => {
  test("GET /docs/sitemap.xml returns valid sitemap", async ({ request }) => {
    const res = await request.get("/docs/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/xml");
    const body = await res.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("/docs/intro");
    expect(body).toContain("/docs/guide");
    expect(body).toContain(".md");
  });
});
