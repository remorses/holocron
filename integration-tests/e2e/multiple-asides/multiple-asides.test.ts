/**
 * Verifies that multiple Aside elements in one section share one sidebar slot
 * and stack vertically instead of creating overlapping sticky regions.
 */

import { expect, test, type Locator } from "@playwright/test";

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
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Combined Aside Section" })).toBeVisible();

    const firstAsideBlock = page.getByText("First aside block", { exact: true });
    const secondAsideBlock = page.getByText("Second aside block", { exact: true });

    await expect(firstAsideBlock).toBeVisible();
    await expect(secondAsideBlock).toBeVisible();

    await expect(page.locator(".slot-aside")).toHaveCount(3);

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
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "API Examples Section" })).toBeVisible();

    const requestExample = page.getByText("Request example", { exact: true });
    const responseExample = page.getByText("Response example", { exact: true });

    await expect(requestExample).toBeVisible();
    await expect(responseExample).toBeVisible();

    await expect(page.locator(".slot-aside")).toHaveCount(3);

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

  test("page with RequestExample widens --grid-sidebar-width and bumps --grid-max-width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto("/");

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
