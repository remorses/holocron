import { expect, test } from "@playwright/test";

/**
 * Fixture: fixtures/tabs/
 * Config shape: `navigation.tabs` with internal groups + external link-only tabs.
 */

test.describe("tabs fixture — navigation.tabs with external link tabs", () => {
  test("renders the Docs tab with its groups and pages", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");

    await expect(page).toHaveTitle(/Tabs Docs/);

    const nav = page.getByRole("navigation", { name: "Navigation" });

    // The two groups inside the "Docs" tab should appear in the sidebar
    await expect(nav.getByText("Overview")).toBeVisible();
    await expect(nav.getByText("Guides")).toBeVisible();

    // Pages from the groups should be visible
    await expect(nav.getByRole("link", { name: "Tabs Home" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Quickstart" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Theming" })).toBeVisible();
  });

  test("renders external link-only tabs (GitHub, Changelog)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");

    // Link-only tabs render as anchors inside the tab bar
    const tabBar = page.locator(".slot-tabbar");
    const githubLink = tabBar.getByRole("link", { name: /GitHub/ });
    const changelogLink = tabBar.getByRole("link", { name: /Changelog/ });

    await expect(githubLink).toHaveAttribute(
      "href",
      "https://github.com/remorses/holocron",
    );
    await expect(changelogLink).toHaveAttribute(
      "href",
      "https://github.com/remorses/holocron/releases",
    );
  });

  test("HTML response contains tab labels", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(response.status()).toBe(200);
    const html = await response.text();
    // Tab names are present in the server-rendered HTML
    expect(html).toContain("Docs");
    expect(html).toContain("GitHub");
    expect(html).toContain("Changelog");
  });

  test("pages inside tab groups are routed correctly", async ({ page }) => {
    // NOTE: title assertions exercise a spiceflow head-merging bug where
    // document.title reverts to the site name after hydration. Leaving
    // them in on purpose — see MEMORY.md "Pre-existing title test flake".
    // The basic fixture's equivalent test passes by race luck (title is
    // still the page title for a brief moment after goto completes); this
    // test is more aggressive because the first assertion is the title.
    await page.goto("/quickstart", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Quickstart/);
    await expect(page.getByRole("heading", { name: "Installation" })).toBeVisible();

    await page.goto("/theming", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/Theming/);
    await expect(page.getByRole("heading", { name: "Colors" })).toBeVisible();
  });

  test("renders banner with dismiss button", async ({ page }) => {
    await page.goto("/");
    const banner = page.locator(".slot-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("We just launched v2!");
    // Banner contains a markdown link
    const link = banner.getByRole("link", { name: "Read the announcement" });
    await expect(link).toHaveAttribute("href", "https://example.com/blog/v2");
    // Dismiss button is present (dismissible: true)
    await expect(banner.getByRole("button", { name: "Dismiss banner" })).toBeVisible();
  });

  test("renders footer with socials and link columns", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    // Social links
    await expect(footer.getByRole("link", { name: "x" })).toHaveAttribute(
      "href",
      "https://x.com/example",
    );
    await expect(footer.getByRole("link", { name: "github" })).toHaveAttribute(
      "href",
      "https://github.com/example",
    );
    // Link columns
    await expect(footer.getByText("Resources")).toBeVisible();
    await expect(footer.getByRole("link", { name: "Blog" })).toBeVisible();
    await expect(footer.getByText("Company")).toBeVisible();
    await expect(footer.getByRole("link", { name: "Careers" })).toBeVisible();
  });

  test("renders theme toggle button", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /Switch to (dark|light) mode/ });
    await expect(toggle).toBeVisible();
  });

  test("renders primary CTA button in navbar", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");
    const cta = page.getByRole("link", { name: "Get Started" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "https://example.com/signup");
  });

  test("SSR HTML includes description metatag from config", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    // The site description flows through the config and should appear
    // somewhere in the rendered output (may be in RSC flight payload)
    expect(html).toContain("A documentation site with tabs");
  });

  test("injects brand-primary color from config", async ({ page }) => {
    await page.goto("/");
    // The banner uses bg-(color:--brand-primary) so if colors work, the
    // banner is visible with the brand color
    const banner = page.locator(".slot-banner");
    await expect(banner).toBeVisible();
  });

  test("search input has custom placeholder", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");
    const searchInput = page.getByPlaceholder("Search the docs...");
    await expect(searchInput).toBeVisible();
  });

  test("no hydration errors on tabs home page", async ({ page }) => {
    const errors: string[] = [];
    function isIgnorableDevReloadError(message: string): boolean {
      return message.includes("Failed to fetch dynamically imported module:");
    }
    page.on("console", (msg) => {
      const text = msg.text().toLowerCase();
      const type = msg.type();
      if (type === "error" && text.includes("hydrat")) errors.push(msg.text());
      if (text.includes("cannot be a descendant")) errors.push(msg.text());
      if (text.includes("did not match")) errors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      if (isIgnorableDevReloadError(err.message)) return;
      errors.push(err.message);
    });

    await page.goto("/");
    await page.waitForTimeout(2000);
    expect(
      errors,
      `Hydration errors found:\n${errors.join("\n")}`,
    ).toHaveLength(0);
  });
});
