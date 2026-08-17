import { expect, test, type Page } from "../helpers/test.ts";

function ariaExpandedOf(html: string, groupName: string): string | null {
  const chunks = html.split("<button");
  const chunk = chunks.find((c) => {
    const buttonEnd = c.indexOf("</button>");
    if (buttonEnd === -1) return false;
    const inside = c.slice(0, buttonEnd);
    return inside.includes(">" + groupName) || inside.endsWith(groupName);
  });
  if (!chunk) return null;
  const match = chunk.match(/aria-expanded="([^"]+)"/);
  return match ? match[1]! : null;
}

async function expectActiveLinkInNavViewport(page: Page, name: string | RegExp) {
  const nav = page.getByRole("navigation", { name: "Navigation" });
  const link = nav.getByRole("link", { name });
  await expect(link).toBeVisible();
  await expect.poll(async () => {
    return link.evaluate((el) => {
      const navEl = el.closest(".slot-sidebar-nav");
      if (!(navEl instanceof HTMLElement)) return false;
      const navRect = navEl.getBoundingClientRect();
      const linkRect = el.getBoundingClientRect();
      return linkRect.top >= navRect.top && linkRect.bottom <= navRect.bottom;
    });
  }).toBe(true);
}

test.describe("deep nested sidebar", () => {
  test("SSR opens ancestor groups of the current page", async ({ request }) => {
    const response = await request.get("/advanced/internals/deep/deeper/level-5", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(ariaExpandedOf(html, "Internals")).toBe("true");
    expect(ariaExpandedOf(html, "Deep Dive")).toBe("true");
    expect(ariaExpandedOf(html, "Even Deeper")).toBe("true");
    expect(html).toMatch(
      /<a[^>]*aria-current="page"[^>]*href="\/advanced\/internals\/deep\/deeper\/level-5"/,
    );
  });

  test("unrelated nested groups stay closed on a shallow page", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "sec-fetch-dest": "document" },
    });
    const html = await response.text();
    expect(ariaExpandedOf(html, "Internals")).toBe("false");
    expect(ariaExpandedOf(html, "Even Deeper")).toBe("false");
  });

  test("does not scroll the sidebar when the first page is already in view", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 500 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const nav = page.getByRole("navigation", { name: "Navigation" });
    await expect(nav).toBeVisible({ timeout: 10000 });
    await expect.poll(() => {
      return nav.evaluate((node) => {
        return Object.keys(node).some((key) => key.startsWith("__reactFiber"));
      });
    }).toBe(true);

    await expectActiveLinkInNavViewport(page, /^Welcome$/);
    await expect.poll(() => nav.evaluate((el) => el.scrollTop)).toBe(0);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("client navigation to a visible nearby page does not scroll the sidebar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 500 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const nav = page.getByRole("navigation", { name: "Navigation" });
    await expect(nav).toBeVisible({ timeout: 10000 });
    await expect.poll(() => {
      return nav.evaluate((node) => {
        return Object.keys(node).some((key) => key.startsWith("__reactFiber"));
      });
    }).toBe(true);
    await expect.poll(() => nav.evaluate((el) => el.scrollTop)).toBe(0);

    await nav.evaluate((navEl) => {
      const link = navEl.querySelector<HTMLAnchorElement>('a[href="/getting-started"]');
      link?.click();
    });
    await expect(page).toHaveURL(/\/getting-started$/);
    await expectActiveLinkInNavViewport(page, /^Getting Started$/);
    await expect.poll(() => nav.evaluate((el) => el.scrollTop)).toBe(0);
  });

  test("loads a deep page with the active sidebar row in view", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 500 });
    await page.goto("/advanced/internals/deep/deeper/level-5", {
      waitUntil: "domcontentloaded",
    });
    await expectActiveLinkInNavViewport(page, /Level 5 Nesting/);
  });

  test("client navigation scrolls the destination page into the sidebar", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 500 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const nav = page.getByRole("navigation", { name: "Navigation" });
    await expect(nav).toBeVisible({ timeout: 10000 });
    await expect.poll(() => {
      return nav.evaluate((node) => {
        return Object.keys(node).some((key) => key.startsWith("__reactFiber"));
      });
    }).toBe(true);

    // DOM click, not locator.click(): Playwright would scroll the link into
    // view first and hide whether our active-row reveal ran.
    await nav.evaluate((navEl) => {
      const link = navEl.querySelector<HTMLAnchorElement>('a[href="/changelog"]');
      link?.click();
    });
    await expect(page).toHaveURL(/\/changelog$/);
    await expectActiveLinkInNavViewport(page, /^Changelog$/);
  });
});
