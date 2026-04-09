import { expect, test, type Page } from "@playwright/test";

async function expectSingleAssistant(page: Page) {
  const assistant = page.locator("[data-sidebar-assistant]");
  await expect(assistant).toHaveCount(1);
  return assistant.first();
}

test.describe("assistant aside ownership", () => {
  test("uses the first section rail when the top rail is free", async ({ page }) => {
    await page.goto("/");

    const assistant = await expectSingleAssistant(page);
    const railType = await assistant.evaluate((node) =>
      node.closest("[data-right-rail]")?.getAttribute("data-right-rail"),
    );
    const railOwner = await assistant.evaluate((node) =>
      node.closest("[data-right-rail-owner]")?.getAttribute("data-right-rail-owner"),
    );

    expect(railType).toBe("section");
    expect(railOwner).toBe("assistant");
  });

  test("stays in the first section rail when a later normal aside exists", async ({
    page,
  }) => {
    await page.goto("/later-aside");

    const assistant = await expectSingleAssistant(page);
    const assistantRailOwner = await assistant.evaluate((node) =>
      node.closest("[data-right-rail-owner]")?.getAttribute("data-right-rail-owner"),
    );
    const laterAside = page.getByText("Later aside note");
    const laterAsideRailType = await laterAside.evaluate((node) =>
      node.closest("[data-right-rail]")?.getAttribute("data-right-rail"),
    );
    const assistantRailType = await assistant.evaluate((node) =>
      node.closest("[data-right-rail]")?.getAttribute("data-right-rail"),
    );

    expect(assistantRailOwner).toBe("assistant");
    expect(assistantRailType).toBe("section");
    expect(laterAsideRailType).toBe("section");
  });

  test("merges assistant into a top authored shared aside", async ({ page }) => {
    await page.goto("/top-shared");

    const assistant = await expectSingleAssistant(page);
    const sharedRail = page.locator('[data-right-rail="shared"]').first();

    await expect(sharedRail.getByText("Shared top note")).toBeVisible();
    await expect(sharedRail.locator("[data-sidebar-assistant]")).toHaveCount(1);

    const railOwner = await assistant.evaluate((node) =>
      node.closest("[data-right-rail-owner]")?.getAttribute("data-right-rail-owner"),
    );

    expect(railOwner).toBe("shared-with-assistant");
  });

  test("falls back to the first section rail when row one already has an aside", async ({
    page,
  }) => {
    await page.goto("/row-one-aside");

    const assistant = await expectSingleAssistant(page);
    const railType = await assistant.evaluate((node) =>
      node.closest("[data-right-rail]")?.getAttribute("data-right-rail"),
    );
    const railOwner = await assistant.evaluate((node) =>
      node.closest("[data-right-rail-owner]")?.getAttribute("data-right-rail-owner"),
    );

    expect(railType).toBe("section");
    expect(railOwner).toBe("assistant-and-aside");
    await expect(page.locator('[data-right-rail="shared"]')).toHaveCount(0);
  });
});
