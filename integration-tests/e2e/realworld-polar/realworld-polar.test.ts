import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
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
  async function warmAndOpen(
    { page, request, href, ready }: {
      page: Page;
      request: APIRequestContext;
      href: string;
      ready: Locator;
    },
  ) {
    const response = await request.get(href, {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(response.status()).toBe(200);
    await page.goto(href, { waitUntil: "domcontentloaded" });
    await expect(ready).toBeVisible({ timeout: 10000 });
  }

  test("home page renders real Polar docs navigation and content", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await warmAndOpen({
      page,
      request,
      href: "/",
      ready: page.getByRole("link", { name: "Docs", exact: true }),
    });
    await page.waitForTimeout(1500);

    await expect(page).toHaveTitle(/Polar/);
    await expect(page.getByRole("link", { name: "Docs", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "API Reference", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Guides", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Changelog", exact: true })).toBeVisible();
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
    request,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await warmAndOpen({
      page,
      request,
      href: "/features/usage-based-billing/introduction",
      ready: page.getByText("Usage Based Billing is a new feature."),
    });
    await page.waitForTimeout(1200);

    await expect(page.getByText("Polar has a powerful Usage Based Billing infrastructure")).toBeVisible();
    await expect(page.getByText("Get up and running in 5 minutes")).toBeVisible();
  });

  test("runtime images use blur plus opacity for the sharpen-in transition", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/integrate/mcp", { waitUntil: "domcontentloaded" });

    const imageFrame = page.locator('.slot-main img[aria-hidden="true"]').first().locator("xpath=..");
    const placeholderImage = imageFrame.locator('img[aria-hidden="true"]');
    const realImage = imageFrame.locator('img:not([aria-hidden])');

    await expect(placeholderImage).toHaveCount(1);
    await expect(realImage).toBeVisible({ timeout: 10000 });

    const [placeholderStyles, styles] = await Promise.all([
      placeholderImage.evaluate((node) => {
        const computed = window.getComputedStyle(node);
        return {
          imageRendering: computed.imageRendering,
        };
      }),
      realImage.evaluate((node) => {
        const computed = window.getComputedStyle(node);
        return {
          transitionProperty: computed.transitionProperty,
          transitionDuration: computed.transitionDuration,
          filter: computed.filter,
          opacity: computed.opacity,
          complete: node instanceof HTMLImageElement ? node.complete : false,
          naturalWidth: node instanceof HTMLImageElement ? node.naturalWidth : 0,
        };
      }),
    ]);

    expect(placeholderStyles.imageRendering).toBe("pixelated");
    expect(styles.complete).toBe(true);
    expect(styles.naturalWidth).toBeGreaterThan(0);
    expect(styles.transitionProperty).toContain("opacity");
    expect(styles.transitionProperty).toContain("filter");
    expect(styles.transitionDuration).not.toBe("0s");
    const opacity = Number(styles.opacity);
    expect(Number.isFinite(opacity)).toBe(true);
    expect(opacity).toBeGreaterThanOrEqual(0);
    expect(opacity).toBeLessThanOrEqual(1);
    expect(styles.filter === "none" || styles.filter.startsWith("blur(")).toBe(true);
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
    request,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await warmAndOpen({
      page,
      request,
      href: "/integrate/webhooks/events",
      ready: page.getByRole("link", { name: "checkout.created" }),
    });
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

  test("migrate page section rows do not inherit extra height from the left nav", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/migrate", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Lemon Squeezy" })).toBeVisible({ timeout: 10000 });

    const sectionBoxes = await page.locator(".slot-main").evaluateAll((nodes) =>
      nodes.flatMap((node) => {
        if (!(node instanceof HTMLElement)) return [];

        const rect = node.getBoundingClientRect();
        const children = Array.from(node.children).filter(
          (child): child is HTMLElement => child instanceof HTMLElement,
        );
        const lastChild = children.at(-1);
        const usedHeight = lastChild ? Math.round(lastChild.getBoundingClientRect().bottom - rect.top) : 0;
        return [{
          heading: node.querySelector("h1, h2, h3, h4, h5, h6")?.textContent?.trim() ?? null,
          deadSpace: Math.round(rect.height) - usedHeight,
        }];
      }),
    );

    expect(sectionBoxes).toEqual([
      { heading: "Lemon Squeezy", deadSpace: 0 },
      { heading: "Getting Started", deadSpace: 0 },
      { heading: "Supported Migrations", deadSpace: 0 },
      { heading: "Open Source", deadSpace: 0 },
    ]);
  });

  test("left toc stays sticky while scrolling long pages", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/api-reference/introduction", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: "Authentication", exact: true })).toBeVisible({ timeout: 10000 });

    const sidebar = page.locator(".slot-sidebar-left > div");
    const before = await sidebar.boundingBox();
    expect(before).not.toBeNull();

    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(200);

    const after = await sidebar.boundingBox();
    expect(after).not.toBeNull();
    expect(Math.round(after!.y)).toBe(Math.round(before!.y));
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

  test("root-level local img renders through the pixelated image primitive", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");

    const realImage = page.locator('.slot-main img[src*="welcome.png"]:not([aria-hidden])').first();
    await expect(realImage).toBeVisible();
    const wrapper = realImage.locator("xpath=ancestor::div[1]");
    await expect(wrapper.locator('img[aria-hidden][src^="data:image/webp;base64,"]')).toHaveCount(1);
  });

  test("Polar card icons render for Font Awesome-style names used in MDX", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await warmAndOpen({
      page,
      request,
      href: "/",
      ready: page.getByRole("link", { name: "Docs", exact: true }),
    });
    await page.waitForTimeout(1200);

    const communityCard = page
      .getByText("Join Our Community", { exact: true })
      .locator("xpath=ancestor::a[1]");
    await expect(communityCard).toBeVisible();
    await expect(communityCard.locator("svg")).toHaveCount(1);

    await page.goto("/api-reference/introduction");
    await page.waitForTimeout(1200);

    // The community card covers the FA-style brand-icon path. Keep the second
    // card assertion focused on content so the test does not depend on the
    // exact internal DOM shape of Card's title row.
    await expect(page.getByText("Sandbox Base URL", { exact: true })).toBeVisible();
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
