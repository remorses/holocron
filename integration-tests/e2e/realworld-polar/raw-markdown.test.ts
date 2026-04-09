import { expect, test } from "@playwright/test";

test.describe("raw markdown image placeholders", () => {
  test("image-heavy pages expose compact webp placeholders in .md output", async ({ request }) => {
    const response = await request.get("/integrate/mcp.md");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/markdown");

    const markdown = await response.text();
    expect(markdown).toContain('placeholder="data:image/webp;base64,');
    expect(markdown).not.toContain('placeholder="data:image/png;base64,');
  });
});
