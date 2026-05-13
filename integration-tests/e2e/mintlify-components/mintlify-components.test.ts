import { expect, test } from "@playwright/test";

test.describe("mintlify components fixture", () => {
  test("loads the page and renders representative components", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Mintlify Components" })).toBeVisible();

    await expect(page).toHaveTitle(/Mintlify Components/);
    await expect(page.getByRole("heading", { name: "Mintlify Components" })).toBeVisible();

    await expect(page.getByText("Generic callout content")).toBeVisible();
    await expect(page.getByText("First nested list item")).toBeVisible();
    await expect(page.getByText('echo "callout code block"')).toBeVisible();
    await expect(page.getByText("Single accordion", { exact: true })).toBeVisible();
    await expect(page.getByText("Nested callout inside accordion")).toBeVisible();
    await expect(page.getByText("Accordion list item")).toBeVisible();
    await expect(page.getByText("console.log('accordion code block')")).toBeVisible();
    await expect(page.getByText("return 'top-level code block'")).toBeVisible();
    const npmTab = page.getByRole("tab", { name: "npm", exact: true }).first();
    const pnpmTab = page.getByRole("tab", { name: "pnpm", exact: true }).first();
    await expect(npmTab).toBeVisible();
    await expect
      .poll(async () => {
        await pnpmTab.click();
        return await page.getByText("pnpm add holocron").isVisible();
      }, { timeout: 10_000 })
      .toBe(true);

    const individualDevelopersTab = page.getByRole("tab", {
      name: "Individual Developers",
      exact: true,
    });
    const smallTeamsTab = page.getByRole("tab", {
      name: "Small Teams",
      exact: true,
    });
    const growingBusinessesTab = page.getByRole("tab", {
      name: "Growing Businesses",
      exact: true,
    });

    await expect(individualDevelopersTab).toBeVisible();
    await expect(page.getByText("Ship Faster", { exact: true })).toBeVisible();
    await smallTeamsTab.click();
    await expect(page.getByText("No Engineering Overhead", { exact: true })).toBeVisible();
    await growingBusinessesTab.click();
    await expect(page.getByText("Enterprise Features", { exact: true })).toBeVisible();

    await expect(page.getByText("Expandable content body.")).toBeVisible();
    await expect(page.getByText("Expandable list item")).toBeVisible();
    await expect(page.getByText('{ "expandable": true }')).toBeVisible();
    await expect(page.getByText("Request example")).toBeVisible();
    await expect(page.getByText("Response example")).toBeVisible();
    await expect(page.getByText("Step paragraph content.")).toBeVisible();
    await expect(page.getByText("First step list item")).toBeVisible();
    await expect(page.getByText("pnpm dev")).toBeVisible();
    await expect(page.locator('[data-mermaid-diagram] svg')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Tree" })).toBeVisible();
    await expect(page.getByText("Initial component fixture release.")).toBeVisible();
    await expect(page.getByText("Added nested content coverage")).toBeVisible();
    await expect(page.getByText("JavaScript-specific content.")).toBeVisible();
    await expect(page.getByText("Python-specific content.")).toBeVisible();
  });

  test("server html includes key Mintlify component content", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });

    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Mintlify Components");
    expect(html).toContain("Generic callout content");
    expect(html).toContain("First nested list item");
    expect(html).toContain("Single accordion");
    expect(html).toContain("Nested callout inside accordion");
    expect(html).toContain("top-level code block");
    expect(html).toContain("Ship Faster");
    expect(html).toContain("Request example");
    expect(html).toContain("Step paragraph content.");
    expect(html).toContain("2026-04-07");
    expect(html).toContain("Added nested content coverage");
  });
});
