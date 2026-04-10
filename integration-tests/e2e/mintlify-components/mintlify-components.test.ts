import { expect, test } from "@playwright/test";

test.describe("mintlify components fixture", () => {
  test("loads the page and renders representative components", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");
    await page.waitForTimeout(1200);

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
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await pnpmTab.click();
      if ((await pnpmTab.getAttribute("aria-selected")) === "true") {
        break;
      }
      await page.waitForTimeout(250);
    }
    await expect(pnpmTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("pnpm add holocron")).toBeVisible();

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

    const stepBody = page
      .getByText("Verify nested spacing", { exact: true })
      .locator("xpath=ancestor::li[1]/div/div[2]");
    const blockGaps = await stepBody.evaluate((node) => {
      if (!(node instanceof HTMLElement)) return [];
      const children = Array.from(node.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement,
      );
      return children.slice(1).map((child, index) => {
        const previous = children[index]!;
        return Math.round(child.getBoundingClientRect().top - previous.getBoundingClientRect().bottom);
      });
    });
    expect(blockGaps).toEqual([12, 12]);
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
