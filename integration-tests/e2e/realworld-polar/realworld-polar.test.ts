import { expect, test } from "@playwright/test";
import {
  captureRuntimeDebug,
  dumpRuntimeDebug,
  expectNoFontRequestFailures,
  type RuntimeDebug,
} from "../helpers/runtime-debug.ts";

const runtimeDebugByTitle = new Map<string, RuntimeDebug>();

test.beforeEach(async ({ page }, testInfo) => {
  runtimeDebugByTitle.set(
    testInfo.titlePath.join(" > "),
    captureRuntimeDebug(page, testInfo.project.name),
  );
});

test.afterEach(async ({}, testInfo) => {
  const key = testInfo.titlePath.join(" > ");
  const debug = runtimeDebugByTitle.get(key);
  runtimeDebugByTitle.delete(key);
  if (debug) {
    try {
      expectNoFontRequestFailures(debug);
    } catch (error) {
      await dumpRuntimeDebug(debug, testInfo, true);
      throw error;
    }
    await dumpRuntimeDebug(debug, testInfo);
  }
});

test.describe("realworld-polar fixture", () => {
  test("home page renders real Polar docs navigation and content", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");
    await page.waitForTimeout(1500);

    await expect(page).toHaveTitle(/Polar/);
    await expect(page.getByRole("link", { name: "Docs" })).toBeVisible();
    await expect(page.getByRole("link", { name: "API Reference" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Guides" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Changelog" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Support", exact: true })).toBeVisible();

    await expect(page.getByRole("link", { name: "llms-full.txt" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Contact support" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();

    await expect(page.getByRole("link", { name: "Flexible Product Management", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Quick Start Guide", exact: true })).toBeVisible();
  });

  test("api reference page renders overview content", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/api-reference/introduction");
    await page.waitForTimeout(1200);

    await expect(page).toHaveTitle(/API Overview/);
    await expect(page.getByRole("link", { name: "Base URLs", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Authentication", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Quick Examples", exact: true })).toBeVisible();
  });

  test("usage-based billing page renders imported snippet content", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/features/usage-based-billing/introduction");
    await page.waitForTimeout(1200);

    await expect(page.getByText("Usage Based Billing is a new feature.")).toBeVisible();
    await expect(page.getByText("Polar has a powerful Usage Based Billing infrastructure")).toBeVisible();
    await expect(page.getByText("Get up and running in 5 minutes")).toBeVisible();
  });

  test("checkout links page renders frame and param fields", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/features/checkout/links");
    await page.waitForTimeout(1200);

    await expect(page.getByRole("heading", { name: "Checkout Links" })).toBeVisible();
    await expect(page.getByText("customer_email")).toBeVisible();
    await expect(page.getByText("custom_field_data.{slug}")).toBeVisible();
    await expect(page.getByText("utm_source")).toBeVisible();
  });

  test("webhook events page renders columns of event cards", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/integrate/webhooks/events");
    await page.waitForTimeout(1200);

    await expect(page.getByRole("link", { name: "checkout.created" })).toBeVisible();
    await expect(page.getByRole("link", { name: "customer.created" })).toBeVisible();
    await expect(page.getByRole("link", { name: "subscription.updated" })).toBeVisible();
  });

  test("changelog page renders update entries", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/changelog/recent");
    await page.waitForTimeout(1200);

    await expect(page.getByText("2026-01-31")).toBeVisible();
    await expect(page.getByText("Team Member Management (B2B)")).toBeVisible();
    await expect(page.getByText("Event & Metering Enhancements")).toBeVisible();
  });

  test("server-rendered html includes representative Polar content", async ({
    request,
  }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });

    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Polar: Turn Your Software into a Business");
    expect(html).toContain("API Reference");
    expect(html).toContain("llms-full.txt");
    expect(html).toContain("Quick Start Guide");
  });

  test("Polar card icons render for Font Awesome-style names used in MDX", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");
    await page.waitForTimeout(1200);

    const communityCard = page
      .getByText("Join Our Community", { exact: true })
      .locator("xpath=ancestor::a[1]");
    await expect(communityCard).toBeVisible();
    await expect(communityCard.locator("svg")).toHaveCount(1);

    await page.goto("/api-reference/introduction");
    await page.waitForTimeout(1200);

    const sandboxCard = page
      .getByText("Sandbox Base URL", { exact: true })
      .locator("xpath=ancestor::div[1]");
    await expect(sandboxCard).toBeVisible();
    await expect(sandboxCard.locator("svg")).toHaveCount(1);
  });

  test("real redirects from Polar docs.json resolve correctly", async ({ request }) => {
    const apiRedirect = await request.get("/api", {
      headers: { "sec-fetch-dest": "document" },
      maxRedirects: 0,
    });
    expect(apiRedirect.status()).toBe(302);
    expect(apiRedirect.headers()["location"]).toBe("/api-reference");

    const developersRedirect = await request.get("/developers/sandbox", {
      headers: { "sec-fetch-dest": "document" },
      maxRedirects: 0,
    });
    expect(developersRedirect.status()).toBe(302);
    expect(developersRedirect.headers()["location"]).toBe("/integrate/sandbox");

    const externalRedirect = await request.get("/merchant-of-record/acceptable-use", {
      headers: { "sec-fetch-dest": "document" },
      maxRedirects: 0,
    });
    expect(externalRedirect.status()).toBe(302);
    expect(externalRedirect.headers()["location"]).toBe(
      "https://polar.sh/legal/acceptable-use-policy",
    );
  });
});
