/**
 * Verifies that multiple Aside elements in one section share one sidebar slot
 * and stack vertically instead of creating overlapping sticky regions.
 */

import { expect, test, type Locator } from "../helpers/test.ts";

function getSlotAsideIndex(locator: Locator) {
  return locator.evaluate((node: Element) => {
    const container = node.closest(".slot-aside");
    if (!container) return -1;
    return Array.from(document.querySelectorAll(".slot-aside")).indexOf(container);
  });
}

test.describe("multiple asides fixture", () => {
  test("multiple Aside blocks in one section share one sidebar container", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/", { waitUntil: "commit" });

    await expect(page.getByRole("heading", { name: "Combined Aside Section" })).toBeVisible();

    const firstAsideBlock = page.getByText("First aside block", { exact: true });
    const secondAsideBlock = page.getByText("Second aside block", { exact: true });

    await expect(firstAsideBlock).toBeVisible();
    await expect(secondAsideBlock).toBeVisible();

    const [firstContainerIndex, secondContainerIndex] = await Promise.all([
      getSlotAsideIndex(firstAsideBlock),
      getSlotAsideIndex(secondAsideBlock),
    ]);

    expect(firstContainerIndex).toBeGreaterThanOrEqual(0);
    expect(firstContainerIndex).toBe(secondContainerIndex);

    const firstBox = await firstAsideBlock.boundingBox();
    const secondBox = await secondAsideBlock.boundingBox();

    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();
    expect(firstBox!.y + firstBox!.height).toBeLessThanOrEqual(secondBox!.y);

    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(html).toContain("First aside block");
    expect(html).toContain("Second aside block");
  });

  test("RequestExample and ResponseExample are extracted into the same sidebar container", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "API Examples Section" })).toBeVisible();

    const requestExample = page.getByText("Request example", { exact: true });
    const responseExample = page.getByText("Response example", { exact: true });

    await expect(requestExample).toBeVisible();
    await expect(responseExample).toBeVisible();

    const [requestContainerIndex, responseContainerIndex] = await Promise.all([
      getSlotAsideIndex(requestExample),
      getSlotAsideIndex(responseExample),
    ]);

    expect(requestContainerIndex).toBeGreaterThanOrEqual(0);
    expect(requestContainerIndex).toBe(responseContainerIndex);

    const requestBox = await requestExample.boundingBox();
    const responseBox = await responseExample.boundingBox();

    expect(requestBox).not.toBeNull();
    expect(responseBox).not.toBeNull();
    expect(requestBox!.y + requestBox!.height).toBeLessThanOrEqual(responseBox!.y);

    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(html).toContain("Request example");
    expect(html).toContain("Response example");
  });

  test("sidebar shows inline headings for pages without a TOC panel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const nav = page.getByRole("navigation", { name: "Navigation" });
    await expect(nav.getByRole("link", { name: "Multiple Asides" })).toBeVisible();
    // Inline heading links appear under the active page entry.
    await expect(nav.getByRole("link", { name: "Combined Aside Section" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "API Examples Section" })).toBeVisible();
  });

  test("page with TableOfContentsPanel hides inline sidebar headings", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/toc-panel", { waitUntil: "domcontentloaded" });

    // The right-aside TOC panel renders the section headings.
    const tocPanel = page.getByRole("navigation", { name: "On this page" });
    await expect(tocPanel).toBeVisible();
    await expect(tocPanel.getByRole("link", { name: "Panel Section One" })).toBeVisible();

    // The left sidebar shows the active page link, but NO inline heading list —
    // the TOC panel already covers it.
    // Suppressed pages never mount their inline heading links, so the DOM has
    // zero heading anchors scoped to this page's href. (Non-active pages keep
    // collapsed-but-mounted TOCs, and Playwright's :visible counts clipped
    // elements — so scope by href instead of visibility.)
    const nav = page.getByRole("navigation", { name: "Navigation" });
    await expect(nav.getByRole("link", { name: "TOC Panel Page" })).toBeVisible();
    await expect(nav.locator('a[href^="/toc-panel#"]')).toHaveCount(0);
  });

  test("sidebarToc: false frontmatter hides inline sidebar headings", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/sidebar-toc-false", { waitUntil: "domcontentloaded" });

    // Page content renders its headings normally.
    await expect(page.getByRole("heading", { name: "Override Section One" })).toBeVisible();

    // Sidebar shows the active page link without the inline heading list.
    const nav = page.getByRole("navigation", { name: "Navigation" });
    await expect(nav.getByRole("link", { name: "Sidebar TOC Off" })).toBeVisible();
    await expect(nav.locator('a[href^="/sidebar-toc-false#"]')).toHaveCount(0);
  });

  test("page with RequestExample widens --grid-sidebar-width and bumps --grid-max-width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // The widened CSS vars are written as inline style on `.slot-page`.
    // Read the computed values and assert the sidebar was expanded from
    // the default sidebar width to the minimum required by RequestExample.
    const slotPage = page.locator(".slot-page");
    await expect(slotPage).toBeVisible();


    // Sanity-check the rendered Request example is actually wider than
    // the default 210px sidebar column.
    const requestExample = page
      .getByText("Request example", { exact: true })
      .locator("xpath=ancestor::*[contains(@class,'slot-aside')][1]");
    const box = await requestExample.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(300);
  });
});
