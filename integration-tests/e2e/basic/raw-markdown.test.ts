import { expect, test } from "@playwright/test";

test.describe("raw markdown via .md path suffix", () => {
  test("GET /index.md returns raw markdown", async ({ request }) => {
    const res = await request.get("/index.md");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("## Overview");
    expect(body).toContain("home page content for integration testing");
  });

  test("GET /getting-started.md returns raw markdown", async ({ request }) => {
    const res = await request.get("/getting-started.md");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("## Installation");
    expect(body).toContain("## Configuration");
  });

  test("GET /getting-started.mdx does NOT serve raw markdown (Vite intercepts .mdx)", async ({
    request,
  }) => {
    const res = await request.get("/getting-started.mdx");
    const contentType = res.headers()["content-type"] || "";
    expect(contentType).not.toContain("text/markdown");
  });

  test("GET /nonexistent.md returns 404", async ({ request }) => {
    const res = await request.get("/nonexistent.md");
    expect(res.status()).toBe(404);
  });

  test("raw markdown includes cache-control header", async ({ request }) => {
    const res = await request.get("/index.md");
    expect(res.status()).toBe(200);
    const cacheControl = res.headers()["cache-control"] || "";
    expect(cacheControl).toContain("s-maxage=300");
  });
});

test.describe("agent detection redirects to .md URL", () => {
  // Playwright's request fixture follows redirects by default, so
  // the final response is the .md content. We verify the redirect
  // happened by checking the final URL ends with .md AND the content
  // is raw markdown (not HTML).

  test("Accept: text/markdown redirects and serves markdown", async ({
    request,
  }) => {
    const res = await request.get("/getting-started", {
      headers: { accept: "text/markdown" },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/markdown");
    expect(res.url()).toContain("/getting-started.md");
    const body = await res.text();
    expect(body).toContain("## Installation");
  });

  test("Accept: text/markdown on root redirects to /index.md", async ({
    request,
  }) => {
    const res = await request.get("/", {
      headers: { accept: "text/markdown" },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/markdown");
    expect(res.url()).toContain("/index.md");
    const body = await res.text();
    expect(body).toContain("## Overview");
  });

  test("ClaudeBot user-agent redirects to .md", async ({ request }) => {
    const res = await request.get("/getting-started", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
      },
    });
    expect(res.status()).toBe(200);
    expect(res.url()).toContain("/getting-started.md");
    expect(res.headers()["content-type"]).toContain("text/markdown");
  });

  test("claude-code user-agent redirects to .md and serves markdown", async ({
    request,
  }) => {
    const res = await request.get("/getting-started", {
      headers: { "user-agent": "claude-code/1.2.3" },
    });
    expect(res.status()).toBe(200);
    expect(res.url()).toContain("/getting-started.md");
    expect(res.headers()["content-type"]).toContain("text/markdown");
    const body = await res.text();
    expect(body).toContain("## Installation");
  });

  test("ChatGPT-User user-agent redirects to .md", async ({ request }) => {
    const res = await request.get("/", {
      headers: { "user-agent": "ChatGPT-User/1.0" },
    });
    expect(res.status()).toBe(200);
    expect(res.url()).toContain("/index.md");
    expect(res.headers()["content-type"]).toContain("text/markdown");
  });

  test("Signature-Agent header redirects to .md", async ({ request }) => {
    const res = await request.get("/getting-started", {
      headers: { "signature-agent": '"https://chatgpt.com"' },
    });
    expect(res.status()).toBe(200);
    expect(res.url()).toContain("/getting-started.md");
    expect(res.headers()["content-type"]).toContain("text/markdown");
  });

  test("agent on nonexistent page falls through to 404", async ({
    request,
  }) => {
    const res = await request.get("/nonexistent", {
      headers: { "user-agent": "claude-code/1.0" },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe("raw markdown does not interfere with normal requests", () => {
  test("normal browser request returns HTML", async ({ request }) => {
    const res = await request.get("/getting-started", {
      headers: {
        accept: "text/html",
        "user-agent": "Mozilla/5.0 Chrome/120",
      },
    });
    expect(res.status()).toBe(200);
    const contentType = res.headers()["content-type"] || "";
    expect(contentType).not.toContain("text/markdown");
  });

  test("POST request with .md suffix is ignored", async ({ request }) => {
    const res = await request.post("/index.md");
    const contentType = res.headers()["content-type"] || "";
    expect(contentType).not.toContain("text/markdown");
  });
});
