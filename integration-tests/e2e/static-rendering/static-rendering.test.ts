/**
 * Static-rendering fixture: verifies the `rendering: static` page frontmatter
 * field registers the page with spiceflow's `staticPage()` so it is prerendered
 * to HTML at build time, while pages without the field (or `rendering: ssr`)
 * keep the default per-request rendering.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "../helpers/test.ts";
import { fixturesDir, getFixtureOutDir } from "../../scripts/fixtures.ts";

const isStart = Boolean(process.env.E2E_START);

test.describe("static rendering page", () => {
  test("renders title and MDX content", async ({ page }) => {
    await page.goto("/static-page", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Statically Rendered Page/);
    await expect(
      page.getByRole("heading", { name: "Statically Rendered Page" }),
    ).toBeVisible();
    await expect(
      page.getByText("prerendered to", { exact: false }),
    ).toBeVisible();
  });

  test("HTML response contains rendered content", async ({ request }) => {
    const response = await request.get("/static-page", {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Statically Rendered Page");
    expect(html).toContain("</html>");
  });

  test("supports client navigation from the home page", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "Static page" }).click();
    await expect(page).toHaveTitle(/Statically Rendered Page/);
    await expect(
      page.getByRole("heading", { name: "Statically Rendered Page" }),
    ).toBeVisible();
  });
});

test.describe("ssr rendering page", () => {
  test("default ssr page still renders", async ({ page }) => {
    await page.goto("/ssr-page", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/SSR Rendered Page/);
    await expect(
      page.getByRole("heading", { name: "SSR Rendered Page" }),
    ).toBeVisible();
  });
});

// Build-mode only: the static page must be prerendered to a real HTML file on
// disk by spiceflow's prerender plugin, while the ssr page must NOT be.
test.describe("prerender output", () => {
  test.skip(!isStart, "prerender artifacts only exist in build mode");

  test("static page is prerendered to HTML, ssr page is not", async () => {
    const outDir = getFixtureOutDir(path.join(fixturesDir, "static-rendering"));
    const clientDir = path.join(outDir, "client");

    const staticHtml = path.join(clientDir, "static-page.html");
    const ssrHtml = path.join(clientDir, "ssr-page.html");

    expect(fs.existsSync(staticHtml)).toBe(true);
    expect(fs.existsSync(ssrHtml)).toBe(false);

    const manifestPath = path.join(clientDir, "__prerender.json");
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      entries: { route: string }[];
    };
    const routes = manifest.entries.map((e) => e.route);
    expect(routes).toContain("/static-page");
    expect(routes).not.toContain("/ssr-page");
  });
});
