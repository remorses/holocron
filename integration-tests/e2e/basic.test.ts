import { expect, test } from "@playwright/test";

const baseURL = `http://localhost:${Number(process.env.E2E_PORT || 6174)}`;

test.describe("home page", () => {
  test("renders page title and MDX content", async ({ page }) => {
    await page.goto("/");
    // Title from frontmatter should be in the document title
    await expect(page).toHaveTitle(/Test Docs/);
    // MDX heading should be rendered
    await expect(page.getByText("Overview")).toBeVisible();
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
    await expect(page.getByText("Installation")).toBeVisible();
    await expect(page.getByText("Configuration")).toBeVisible();
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
