import { expect, test } from "@playwright/test";

// Integration tests for the Mintlify-style <Update> component. The component
// must render as a two-column row: a sticky label rail on the left and MDX
// children on the right. On mobile viewports the rail stacks above the
// content. See vite/src/components/markdown/mintlify/compat.tsx.
//
// Gotcha: the slugified ids here (e.g. "2026-04-11") start with a digit, so
// raw CSS id selectors like `#2026-04-11` are invalid in querySelector. We
// use attribute selectors (`[id='2026-04-11']`) everywhere.

const FIRST = `[id='2026-04-11']`;
const SECOND = `[id='2026-04-05']`;
const THIRD = `[id='2026-03-28']`;

test.describe("Update component", () => {
  test("renders each update with slugified anchor id", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Each Update gets an id derived from slugify(label).
    await expect(page.locator(FIRST)).toBeVisible();
    await expect(page.locator(SECOND)).toBeVisible();
    await expect(page.locator(THIRD)).toBeVisible();

    // The label is rendered as an anchor pointing at its own id.
    const firstLabel = page.locator(
      `${FIRST} [data-component-part='update-label']`,
    );
    await expect(firstLabel).toHaveText("2026-04-11");
    await expect(firstLabel).toHaveAttribute("href", "#2026-04-11");
  });

  test("label pill has a non-transparent background", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const bg = await page
      .locator(`${FIRST} [data-component-part='update-label']`)
      .evaluate((el) => getComputedStyle(el as HTMLElement).backgroundColor);

    // Should not be fully transparent.
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(bg).not.toBe("transparent");
  });

  test("desktop layout places label rail next to content (same row)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const label = page.locator(
      `${FIRST} [data-component-part='update-label']`,
    );
    const content = page.locator(
      `${FIRST} [data-component-part='update-content']`,
    );

    const labelBox = await label.boundingBox();
    const contentBox = await content.boundingBox();
    if (!labelBox || !contentBox) {
      throw new Error("bounding boxes unavailable");
    }

    // Label should be to the LEFT of the content with a small tolerance.
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(contentBox.x + 1);
    // Vertical mid-line of label falls within content's vertical range.
    const labelMidY = labelBox.y + labelBox.height / 2;
    expect(labelMidY).toBeGreaterThanOrEqual(contentBox.y - 1);
    expect(labelMidY).toBeLessThanOrEqual(contentBox.y + contentBox.height + 1);
  });

  test("mobile layout stacks label above content", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const label = page.locator(
      `${FIRST} [data-component-part='update-label']`,
    );
    const content = page.locator(
      `${FIRST} [data-component-part='update-content']`,
    );

    const labelBox = await label.boundingBox();
    const contentBox = await content.boundingBox();
    if (!labelBox || !contentBox) {
      throw new Error("bounding boxes unavailable");
    }

    // Label sits strictly above the content box on mobile.
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(contentBox.y + 1);
  });

  test("content does not overflow the update-content wrapper", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const content = page.locator(
      `${FIRST} [data-component-part='update-content']`,
    );
    await expect(content).toBeVisible();

    const metrics = await content.evaluate((el) => {
      const host = el as HTMLElement;
      const pre = host.querySelector("pre");
      return {
        scrollWidth: host.scrollWidth,
        clientWidth: host.clientWidth,
        preWidth: pre ? (pre as HTMLElement).scrollWidth : 0,
      };
    });

    // No horizontal bleed of children beyond the Update content column.
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    // Code block should fit inside the content wrapper too.
    expect(metrics.preWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });

  test("sticky handoff between consecutive updates on desktop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const secondUpdate = page.locator(SECOND);
    await secondUpdate.scrollIntoViewIfNeeded();
    // Give sticky positioning a tick to settle.
    await page.waitForTimeout(200);

    const secondLabelVisible = await page
      .locator(`${SECOND} [data-component-part='update-label']`)
      .evaluate((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return (
          r.bottom > 0 &&
          r.top < (window.innerHeight || document.documentElement.clientHeight)
        );
      });

    expect(secondLabelVisible).toBe(true);
  });

  test("clicking the label updates the location hash", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await page
      .locator(`${SECOND} [data-component-part='update-label']`)
      .click();

    await expect
      .poll(async () => page.evaluate(() => location.hash))
      .toBe("#2026-04-05");
  });
});
