import { expect, test } from "@playwright/test";

test.describe("raw markdown image placeholders", () => {
  test("image-heavy pages stay exportable as raw markdown", async ({ request }) => {
    const response = await request.get("/integrate/mcp.md");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/markdown");

    const markdown = await response.text();
    expect(markdown).toContain("Supercharge your AI agents with Polar as a Model Context Protocol (MCP) server.");
    expect(markdown).toMatch(/<(?:img|PixelatedImage)\s/);
    expect(markdown).not.toContain('placeholder="data:image/png;base64,');
  });
});
