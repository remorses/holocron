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

    // Link-only tabs render as anchors pointing at their external href
    const githubLink = page.getByRole("link", { name: /GitHub/ });
    const changelogLink = page.getByRole("link", { name: /Changelog/ });

    await expect(githubLink.first()).toHaveAttribute(
      "href",
      "https://github.com/remorses/holocron",
    );
    await expect(changelogLink.first()).toHaveAttribute(
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
    await page.goto("/quickstart");
    await expect(page).toHaveTitle(/Quickstart/);
    await expect(page.getByRole("heading", { name: "Installation" })).toBeVisible();

    await page.goto("/theming");
    await expect(page).toHaveTitle(/Theming/);
    await expect(page.getByRole("heading", { name: "Colors" })).toBeVisible();
  });

  test("no hydration errors on tabs home page", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text().toLowerCase();
      const type = msg.type();
      if (type === "error" && text.includes("hydrat")) errors.push(msg.text());
      if (text.includes("cannot be a descendant")) errors.push(msg.text());
      if (text.includes("did not match")) errors.push(msg.text());
    });
    page.on("pageerror", (err) => {
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
