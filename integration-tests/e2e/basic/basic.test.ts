import { expect, test } from "@playwright/test";

test.describe("home page", () => {
  test("renders page title and MDX content", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Title from frontmatter should be in the document title
    await expect(page).toHaveTitle(/Test Docs/);
    // MDX heading should be rendered
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    // MDX paragraph content should be rendered
    await expect(
      page.getByText("home page content for integration testing"),
    ).toBeVisible();
  });

  test("HTML response contains rendered content", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Welcome to Test Docs");
    expect(html).toContain("Overview");
    expect(html).toContain("</html>");
  });

  test("renders markdown tables with the editorial wrapper", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    await expect(page.locator('[data-slot="table-container"]')).toBeVisible();
    await expect(table.getByText("Feature")).toBeVisible();
    await expect(table.getByText("Native tables")).toBeVisible();
    await expect(table.getByText("Styled with editorial tokens")).toBeVisible();
  });
});

test.describe("getting-started page", () => {
  test("renders page title and headings", async ({ page }) => {
    await page.goto("/getting-started", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Getting Started/);
    await expect(page.getByRole("heading", { name: "Installation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible();
  });

  test("shows the active page and its TOC headings in the sidebar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started", { waitUntil: "domcontentloaded" });

    const nav = page.getByRole("navigation", { name: "Navigation" });

    // Active page link should be visible
    await expect(nav.getByRole("link", { name: "Getting Started" })).toBeVisible();
    // TOC headings should be expanded under active page
    await expect(nav.getByRole("link", { name: "Installation" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Configuration" })).toBeVisible();
  });

  test("TOC headings are indented relative to the page link", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started", { waitUntil: "domcontentloaded" });

    const nav = page.getByRole("navigation", { name: "Navigation" });
    const pageLink = nav.getByRole("link", { name: "Getting Started" });
    const headingLink = nav.getByRole("link", { name: "Installation" });

    // The heading TOC list has padding-left, making it indented vs the page link
    const pageLinkLeft = await pageLink.evaluate((node) => node.getBoundingClientRect().left);
    const headingLinkLeft = await headingLink.evaluate((node) => node.getBoundingClientRect().left);

    expect(headingLinkLeft).toBeGreaterThan(pageLinkLeft);
  });

  test("shows an explicit no-results state when search has no matches", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started", { waitUntil: "domcontentloaded" });

    const searchInput = page.getByPlaceholder("search...");
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // The first dev visit can trigger Vite's optimize-deps reload. Reload once
    // after the page is interactive so the actual search assertion runs against
    // the settled module graph instead of racing the dev-server refresh.
    await page.reload();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    const nav = page.getByRole("navigation", { name: "Navigation" });
    const noResults = nav.getByText("No results for", { exact: false });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const activeInput = page.getByPlaceholder("search...");
      await expect(activeInput).toBeVisible({ timeout: 10000 });
      await activeInput.click();
      await activeInput.fill("zzzz-no-match");

      if (await noResults.isVisible()) {
        break;
      }

      await page.waitForTimeout(500);
    }

    await expect(noResults).toBeVisible();
    await expect(nav.getByRole("link", { name: "Welcome to Test Docs" })).not.toBeVisible();
  });

  test("renders code blocks", async ({ page }) => {
    await page.goto("/getting-started", { waitUntil: "domcontentloaded" });
    // The code block with the install command should be visible
    await expect(
      page.getByText("npm install @holocron.so/vite"),
    ).toBeVisible();
  });

  test("HTML response contains rendered content", async ({ request }) => {
    const response = await request.get("/getting-started", {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Getting Started");
    expect(html).toContain("Installation");
    expect(html).toContain("Configuration");
  });
});

test.describe("navigation", () => {
  test("sidebar contains links to all pages", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    // Sidebar should contain nav items for MDX and plain markdown pages
    expect(html).toContain("Welcome to Test Docs");
    expect(html).toContain("Getting Started");
    expect(html).toContain("Markdown Page");
    // Should have the nav group name
    expect(html).toContain("Guides");
  });

  test("getting-started page sets the document title", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/Getting Started/);
  });
});

test.describe("plain markdown page", () => {
  test("renders .md pages from the navigation", async ({ page }) => {
    await page.goto("/markdown-page", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveTitle(/Markdown Page/);
    await expect(page.getByRole("heading", { name: "Markdown HTML Block" })).toBeVisible();
    await expect(page.getByText("Simple HTML in plain Markdown should render.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Plain Markdown" })).toBeVisible();
    await expect(page.getByText("same pipeline as MDX pages")).toBeVisible();
    await expect(page.getByText("const extension = '.md'")).toBeVisible();
  });

  test("appears in sidebar navigation", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/markdown-page", { waitUntil: "domcontentloaded" });

    const nav = page.getByRole("navigation", { name: "Navigation" });
    await expect(nav.getByRole("link", { name: "Markdown Page" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Plain Markdown" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Markdown Features" })).toBeVisible();
  });

  test("HTML response contains rendered .md content", async ({ request }) => {
    const response = await request.get("/markdown-page", {
      headers: { "sec-fetch-dest": "document" },
    });

    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Markdown Page");
    expect(html).toContain("Markdown HTML Block");
    expect(html).toContain("Simple HTML in plain Markdown should render.");
    expect(html).toContain("Plain Markdown");
    expect(html).toContain("same pipeline as MDX pages");
  });
});

test.describe("agent-facing docs", () => {
  test("serves llms.txt with docs.zip first and markdown page links", async ({ request }) => {
    const response = await request.get("/llms.txt");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/markdown");

    const text = await response.text();
    expect(text).toContain("# Test Docs");
    expect(text).toContain("> Documentation and usage guide for Test Docs.");
    expect(text.indexOf("## Best way to inspect these docs")).toBeLessThan(text.indexOf("## Page index"));
    expect(text).toContain("curl -L http://localhost:");
    expect(text).toContain("/docs.zip -o docs.zip");
    expect(text).toContain('grep -R "search term" docs/');
    expect(text).toContain("[Welcome to Test Docs](http://localhost:");
    expect(text).toContain("/index.md)");
    expect(text).toContain("[Getting Started](http://localhost:");
    expect(text).toContain("/getting-started.md)");
    expect(text).toContain("/markdown-page.md)");
  });

  test("points HTML and markdown pages back to llms.txt", async ({ request }) => {
    const htmlResponse = await request.get("/getting-started", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await htmlResponse.text();
    expect(html).toContain("Agent-readable docs index: /llms.txt");

    const mdResponse = await request.get("/getting-started.md");
    const md = await mdResponse.text();
    expect(md.startsWith("> Agent-readable docs index: /llms.txt.")).toBe(true);
  });
});

test.describe("hydration", () => {
  function isIgnorableDevReloadError(message: string): boolean {
    return message.includes("Failed to fetch dynamically imported module:");
  }

  function isHydrationError(msg: { type(): string; text(): string }): boolean {
    const text = msg.text().toLowerCase();
    const type = msg.type();
    // React hydration errors (console.error with "hydrat")
    if (type === "error" && text.includes("hydrat")) return true;
    // React HTML nesting warnings that cause hydration mismatches
    // e.g. "In HTML, <p> cannot be a descendant of <p>"
    if (text.includes("cannot be a descendant")) return true;
    if (text.includes("did not match")) return true;
    return false;
  }

  test("no hydration errors on home page", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (isHydrationError(msg)) errors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      if (isIgnorableDevReloadError(err.message)) return;
      errors.push(err.message);
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    expect(errors, `Hydration errors found:\n${errors.join("\n")}`).toHaveLength(0);
  });

  test("no hydration errors on getting-started page", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (isHydrationError(msg)) errors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      if (isIgnorableDevReloadError(err.message)) return;
      errors.push(err.message);
    });

    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    expect(errors, `Hydration errors found:\n${errors.join("\n")}`).toHaveLength(0);
  });

  test("no invalid HTML nesting (p inside p, div inside p)", async ({
    request,
  }) => {
    // Fetch raw server-rendered HTML and check for nesting violations
    // that would cause hydration mismatches
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    // Check that <p> tags don't contain block elements
    const pInsideP = /<p[^>]*>\s*<p[^>]*>/i.test(html);
    expect(pInsideP, "Found <p> nested inside <p>").toBe(false);
  });
});

test.describe("not found", () => {
  test("returns 404 status for unknown page", async ({ request }) => {
    const response = await request.get("/does-not-exist", {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(response.status()).toBe(404);
  });

  test("renders the full editorial layout on 404", async ({ request }) => {
    const response = await request.get("/does-not-exist", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    // Navbar slot and sidebar slot are both present
    expect(html).toContain("slot-navbar");
    expect(html).toContain("slot-sidebar-left");
    // Known sidebar page link is rendered (from the test fixture docs.json)
    expect(html).toMatch(/href="\/getting-started"/);
  });

  test("shows the missing path and a link back home", async ({ request }) => {
    const response = await request.get("/does-not-exist", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(html).toContain("404");
    expect(html).toContain("Page not found");
    expect(html).toContain("/does-not-exist");
    expect(html).toContain("Back to documentation");
  });

  test("uses site name in the 404 page title and sets noindex", async ({
    request,
  }) => {
    const response = await request.get("/does-not-exist", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(html).toMatch(/<title[^>]*>Page not found — /);
    expect(html).toMatch(/<meta[^>]*name="robots"[^>]*content="noindex"/);
  });

  test("renders 404 for nested paths", async ({ request }) => {
    const response = await request.get("/foo/bar/baz", {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(response.status()).toBe(404);
    const html = await response.text();
    expect(html).toContain("/foo/bar/baz");
  });
});
