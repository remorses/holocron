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

  test("shows the active page and its TOC headings in the sidebar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started");

    const nav = page.getByRole("navigation", { name: "Navigation" });

    // Active page link should be visible
    await expect(nav.getByRole("link", { name: "Getting Started" })).toBeVisible();
    // TOC headings should be expanded under active page
    await expect(nav.getByRole("link", { name: "Installation" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Configuration" })).toBeVisible();
  });

  test("TOC headings are indented relative to the page link", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started");

    const nav = page.getByRole("navigation", { name: "Navigation" });
    const pageLink = nav.getByRole("link", { name: "Getting Started" });
    const headingLink = nav.getByRole("link", { name: "Installation" });

    // The heading TOC list has padding-left, making it indented vs the page link
    const pageLinkLeft = await pageLink.evaluate((node) => node.getBoundingClientRect().left);
    const headingLinkLeft = await headingLink.evaluate((node) => node.getBoundingClientRect().left);

    expect(headingLinkLeft).toBeGreaterThan(pageLinkLeft);
  });

  test("dims non-matching items when search has no matches", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started");
    // Wait for hydration so the search input is interactive
    await page.waitForTimeout(1000);

    const searchInput = page.getByPlaceholder("search...");
    await searchInput.click();
    await searchInput.fill("zzzz-no-match");
    // Wait for React startTransition to apply dimming
    await page.waitForTimeout(1000);

    // The "Welcome to Test Docs" page link should be dimmed
    const nav = page.getByRole("navigation", { name: "Navigation" });
    const welcomeLink = nav.getByRole("link", { name: "Welcome to Test Docs" });
    await expect(welcomeLink).toBeVisible();

    // The opacity is set inline on the parent div.flex.flex-col wrapper
    const wrapperOpacity = await welcomeLink.evaluate((node) => {
      let el: HTMLElement | null = node.parentElement;
      while (el) {
        if (el.style.opacity) return el.style.opacity;
        el = el.parentElement;
      }
      return window.getComputedStyle(node).opacity;
    });
    expect(Number.parseFloat(wrapperOpacity)).toBeLessThan(1);
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

    const nav = page.getByRole("navigation", { name: "Navigation" });
    await nav.getByRole("link", { name: "Getting Started" }).click();

    await expect(page).toHaveURL(/\/getting-started$/);
    await expect(page).toHaveTitle(/Getting Started/);
  });
});

test.describe("hydration", () => {
  test("no hydration errors on home page", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().toLowerCase().includes("hydrat")) {
        errors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await page.goto("/");
    // Wait for hydration to settle
    await page.waitForTimeout(2000);
    expect(errors, `Hydration errors found:\n${errors.join("\n")}`).toHaveLength(0);
  });

  test("no hydration errors on getting-started page", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().toLowerCase().includes("hydrat")) {
        errors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/getting-started");
    await page.waitForTimeout(2000);
    expect(errors, `Hydration errors found:\n${errors.join("\n")}`).toHaveLength(0);
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
