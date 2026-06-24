import { expect, test } from "../helpers/test.ts";

test.describe("runtime provider", () => {
  test("static docs page still works", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
    await expect(page.getByText("static docs page")).toBeVisible();
  });

  test("runtime blog page renders article content", async ({ page }) => {
    await page.goto("/blog/hello-world", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Hello World" })).toBeVisible();
    await expect(
      page.getByText("first blog post from the runtime provider"),
    ).toBeVisible();
  });

  test("second runtime blog page renders", async ({ page }) => {
    await page.goto("/blog/second-post", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Second Post" })).toBeVisible();
  });

  test("advanced topic page renders", async ({ page }) => {
    await page.goto("/blog/advanced-topic", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByText("Advanced content about runtime providers"),
    ).toBeVisible();
  });

  // TODO: non-existent runtime slugs currently render an empty page instead
  // of a proper 404. The catch-all .page() handler returns null which renders
  // the layout shell without content. Need to either redirect to 404 from the
  // handler or use spiceflow's response.status mechanism.
});
