import { expect, test, type APIRequestContext, type Page } from "../helpers/test.ts";

/**
 * Fixture: fixtures/imageboard/
 * Config shape: `navigation.tabs` with an `imageboard` tab pointing at
 * `./public/board` (3 images incl. one in a nested folder + 1 mp4).
 *
 * Covers: masonry grid rendering, mode:custom (no sidebars), build-time
 * image enrichment (width/height/placeholder + zoom wrapper), native lazy
 * loading, video dimension probing, and recursive folder walking.
 */

test.describe("imageboard fixture — masonry media grid tab", () => {
  async function openMoodboard(page: Page, request: APIRequestContext) {
    const response = await request.get("/moodboard", {
      headers: { "sec-fetch-dest": "document" },
    });
    expect(response.status()).toBe(200);
    await page.goto("/moodboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".holocron-imageboard")).toBeVisible({ timeout: 10000 });
  }

  test("renders the masonry grid with all media, no sidebars", async ({ page, request }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await openMoodboard(page, request);

    await expect(page).toHaveTitle(/Moodboard/);

    const grid = page.locator(".holocron-imageboard");
    // 3 images (incl. nested folder) + 1 video
    await expect(grid.locator("img[loading=lazy]")).toHaveCount(3);
    await expect(grid.locator("video")).toHaveCount(1);

    // mode: custom → no editorial sidebars
    await expect(page.locator(".slot-sidebar-left")).toHaveCount(0);
    await expect(page.locator(".slot-sidebar-right")).toHaveCount(0);

    // columns config flows into CSS
    const columnCount = await grid.evaluate((el) => getComputedStyle(el).columnCount);
    expect(columnCount).toBe("2");
  });

  test("images get build-time dimensions, placeholders, and zoom wrappers", async ({ page, request }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await openMoodboard(page, request);

    const grid = page.locator(".holocron-imageboard");
    const imgs = grid.locator("img[loading=lazy]");
    const count = await imgs.count();
    for (let i = 0; i < count; i++) {
      await expect(imgs.nth(i)).toHaveAttribute("width", /^\d+$/);
      await expect(imgs.nth(i)).toHaveAttribute("height", /^\d+$/);
    }
    // react-medium-image-zoom wrappers around every image
    await expect(grid.locator("[data-rmiz]")).toHaveCount(3);
    // pixelated placeholder layers present until the real image loads
    const raw = await request.get("/moodboard.md");
    const md = await raw.text();
    expect(md).toContain('placeholder="data:image/webp;base64,');
  });

  test("video gets probed dimensions and metadata preload", async ({ page, request }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await openMoodboard(page, request);

    const video = page.locator(".holocron-imageboard video");
    await expect(video).toHaveAttribute("width", "320");
    await expect(video).toHaveAttribute("height", "180");
    await expect(video).toHaveAttribute("preload", "metadata");

    // The mp4 is served from public/
    const src = await video.locator("source").getAttribute("src");
    expect(src).toBe("/board/clip.mp4");
    const media = await request.get(src!);
    expect(media.status()).toBe(200);
  });

  test("clicking an image opens the zoom dialog", async ({ page, request }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await openMoodboard(page, request);

    // Retry the click until the zoom dialog opens — the first click can
    // land before React hydration attaches the rmiz handlers.
    const firstImage = page.locator(".holocron-imageboard img[loading=lazy]").first();
    const modal = page.locator("[data-rmiz-modal][open]");
    await expect(async () => {
      await firstImage.click();
      await expect(modal).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-rmiz-modal][open]")).toHaveCount(0);
  });
});
