/**
 * Chat failure-mode integration tests.
 *
 * Regression coverage for "the AI answer never arrives": every case here
 * used to render an empty assistant bubble with no error at all.
 *
 * The mock gateway (fixtures/chat-widget/mock-chat-server.ts) emits canned
 * chunk streams when a message starts with `SCRIPT:<name>`, so these run
 * without an OpenAI key and stay deterministic.
 */

import { test, expect, type Page } from "../helpers/test.ts";

async function askScripted(page: Page, script: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const chatInput = page.locator("textarea").first();
  await chatInput.fill(`SCRIPT:${script}`);
  await chatInput.press("Enter");

  // Drawer opened
  await expect(page.locator("button[aria-label='New chat']")).toBeVisible({ timeout: 10000 });
  return page.locator("[data-message-id='msg-1']");
}

test("stream cut before text-end still renders the buffered answer", async ({ page }) => {
  const assistant = await askScripted(page, "truncated");
  await expect(assistant).toContainText("Truncated answer body", { timeout: 30000 });
});

test("provider error chunk renders an error notice", async ({ page }) => {
  const assistant = await askScripted(page, "error");
  // Partial text is kept…
  await expect(assistant).toContainText("Partial answer", { timeout: 30000 });
  // …and the failure is explained instead of silently swallowed.
  const notice = assistant.locator("[data-notice-severity='error']");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("upstream provider exploded");
});

test("answer wrapped in think tags is still visible", async ({ page }) => {
  const assistant = await askScripted(page, "think");
  await expect(assistant).toContainText("Think tag answer body", { timeout: 30000 });
});

test("turn with no output shows an error notice, never an empty bubble", async ({ page }) => {
  const assistant = await askScripted(page, "empty");
  const notice = assistant.locator("[data-notice-severity='error']");
  await expect(notice).toBeVisible({ timeout: 30000 });
  await expect(notice).toContainText("did not return a response");
});

test("a notice-only turn is the answer, with no error stacked on top", async ({ page }) => {
  const assistant = await askScripted(page, "limit");
  await expect(
    assistant.locator("[data-notice-code='HOLOCRON_RATE_LIMIT_REACHED']"),
  ).toBeVisible({ timeout: 30000 });
  await expect(assistant.locator("[data-notice-severity='error']")).toHaveCount(0);
});

test("the standing upgrade advisory does not hide the error that follows it", async ({ page }) => {
  const assistant = await askScripted(page, "nagThenError");
  await expect(
    assistant.locator("[data-notice-code='HOLOCRON_TEMPORARY_AI_MODEL']"),
  ).toBeVisible({ timeout: 30000 });
  await expect(assistant.locator("[data-notice-severity='error']")).toBeVisible();
});
