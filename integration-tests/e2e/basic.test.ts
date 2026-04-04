import { expect, test } from "@playwright/test";

const baseURL = `http://localhost:${Number(process.env.E2E_PORT || 6174)}`;

test.describe("home page", () => {
  test("renders page title and MDX content", async ({ page }) => {
    await page.goto("/");
    // Title from frontmatter should be in the document title
    await expect(page).toHaveTitle(/Test Docs/);
    // MDX heading should be rendered
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    // MDX paragraph content should be rendered
    await expect(
      page.getByText("home page content for integration testing"),
    ).toBeVisible();
  });

  test("HTML response contains rendered content", async () => {
    const response = await fetch(baseURL + "/", {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Welcome to Test Docs");
    expect(html).toContain("Overview");
    expect(html).toContain("</html>");
  });
});

test.describe("getting-started page", () => {
  test("renders page title and headings", async ({ page }) => {
    await page.goto("/getting-started");
    await expect(page).toHaveTitle(/Getting Started/);
    await expect(page.getByRole("heading", { name: "Installation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible();
  });

  test("expands the current page in the sidebar and shows page heading links", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started");

    const toc = page.getByRole("navigation", { name: "Table of contents" });

    await expect(toc.getByRole("link", { name: "Getting Started" })).toBeVisible();
    await expect(toc.getByRole("link", { name: "Installation" })).toBeVisible();
    await expect(toc.getByRole("link", { name: "Configuration" })).toBeVisible();
  });

  test("can collapse and re-expand the current page headings in the sidebar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started");

    const toc = page.getByRole("navigation", { name: "Table of contents" });
    const pageRow = toc.getByRole("link", { name: "Getting Started" });
    const installation = toc.getByRole("link", { name: "Installation" });

    await expect(installation).toBeVisible();

    await pageRow.locator("svg").click();
    await expect(installation).not.toBeVisible();

    await pageRow.locator("svg").click();
    await expect(installation).toBeVisible();
  });

  test("clicking the page node selects the first heading child", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 400 });
    await page.goto("/getting-started");

    const toc = page.getByRole("navigation", { name: "Table of contents" });
    const pageRow = toc.getByRole("link", { name: "Getting Started" });
    const installation = toc.getByRole("link", { name: "Installation" });

    await installation.click();
    await expect(installation).toHaveAttribute("data-active", "true");

    await pageRow.click();
    await expect(page).toHaveURL(/\/getting-started#installation$/);
    await expect(pageRow).toHaveAttribute("data-active", "false");
    await expect(installation).toHaveAttribute("data-active", "true");
  });

  test("indents page heading links deeper than the page row", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started");

    const toc = page.getByRole("navigation", { name: "Table of contents" });
    const pageRow = toc.getByRole("link", { name: "Getting Started" });
    const installation = toc.getByRole("link", { name: "Installation" });

    const pagePaddingLeft = await pageRow.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).paddingLeft));
    const headingPaddingLeft = await installation.evaluate((node) => Number.parseFloat(window.getComputedStyle(node).paddingLeft));

    expect(headingPaddingLeft).toBeGreaterThan(pagePaddingLeft);
  });

  test("uses the same background color for the page shell and sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started");

    const pageBackground = await page.locator(".slot-page").evaluate((node) => window.getComputedStyle(node).backgroundColor);
    const sidebarBackground = await page.locator("#hc-sidebar").evaluate((node) => window.getComputedStyle(node).backgroundColor);

    expect(sidebarBackground).toBe(pageBackground);
  });

  test("dims group names too when search has no matches", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started");

    await page.getByLabel("Search sidebar").fill("zzzz-no-match");

    const guidesOpacity = await page.getByText("Guides", { exact: true }).evaluate((node) => window.getComputedStyle(node).opacity);
    expect(Number.parseFloat(guidesOpacity)).toBeLessThan(1);
  });

  test("renders code blocks", async ({ page }) => {
    await page.goto("/getting-started");
    // The code block with the install command should be visible
    await expect(
      page.getByText("npm install @holocron.so/vite"),
    ).toBeVisible();
  });

  test("HTML response contains rendered content", async () => {
    const response = await fetch(baseURL + "/getting-started", {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Getting Started");
    expect(html).toContain("Installation");
    expect(html).toContain("Configuration");
  });
});

test.describe("navigation", () => {
  test("sidebar contains links to both pages", async () => {
    const response = await fetch(baseURL + "/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    // Sidebar should contain nav items for both pages
    expect(html).toContain("Welcome to Test Docs");
    expect(html).toContain("Getting Started");
    // Should have the nav group name
    expect(html).toContain("Guides");
  });

  test("client navigation updates the document title", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "Table of contents" });
    await nav.getByRole("link", { name: "Getting Started" }).click();

    await expect(page).toHaveURL(/\/getting-started$/);
    await expect(page).toHaveTitle(/Getting Started/);
  });
});

test.describe("not found", () => {
  test("returns 404 for unknown page", async () => {
    const response = await fetch(baseURL + "/does-not-exist", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(html).toContain("not found");
  });
});
