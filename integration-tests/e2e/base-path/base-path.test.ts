import { expect, test } from "@playwright/test";

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
});

test.describe("raw markdown under base path", () => {
  test("GET /docs/intro.md returns raw markdown", async ({ request }) => {
    const res = await request.get("/docs/intro.md");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("# Introduction");
    expect(body).toContain("holocron.so");
  });

  test("GET /docs/guide.md returns raw markdown", async ({ request }) => {
    const res = await request.get("/docs/guide.md");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("# Guide");
  });

  test("agent UA redirects to .md under base path", async ({ request }) => {
    const res = await request.get("/docs/intro", {
      headers: { "user-agent": "claude-code/1.0" },
    });
    expect(res.status()).toBe(200);
    expect(res.url()).toContain("/docs/intro.md");
    expect(res.headers()["content-type"]).toContain("text/markdown");
  });
});

test.describe("API routes under base path", () => {
  test("POST /docs/holocron-api/chat returns non-404", async ({ request }) => {
    // The chat endpoint should be reachable under the base path.
    // It may return 404 with "Assistant is disabled" body (which is the
    // handler's own response, not a routing 404), or 200 if enabled.
    const res = await request.post("/docs/holocron-api/chat", {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ message: "hello", modelMessages: [], currentSlug: "/" }),
    });
    // The route must exist — a routing-level 404 would mean the base path
    // prefix is not wired. The handler itself returns 404 when assistant is
    // disabled, but the body says "Assistant is disabled".
    const body = await res.text();
    if (res.status() === 404) {
      expect(body).toContain("Assistant is disabled");
    } else {
      // If assistant is enabled, we just verify it didn't routing-404
      expect(res.status()).not.toBe(404);
    }
  });

  test("POST /holocron-api/chat without base prefix is rejected by Vite", async ({ request }) => {
    // Vite intercepts non-prefixed routes and returns its own 404 with a
    // helpful redirect hint. The client must always use the base-prefixed URL.
    const res = await request.post("/holocron-api/chat", {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ message: "hello", modelMessages: [], currentSlug: "/" }),
    });
    expect(res.status()).toBe(404);
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
