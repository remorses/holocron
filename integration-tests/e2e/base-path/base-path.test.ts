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
