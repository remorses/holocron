/**
 * Chat widget integration tests.
 *
 * Verifies the AI chat sidebar assistant and drawer render, open/close,
 * and stream responses. Uses HOLOCRON_CHAT_PROVIDER=openai:gpt-4o-mini
 * with disk-based caching so responses are deterministic after the first run.
 *
 * The sidebar assistant shows "Ask AI about this page" in the right aside
 * on desktop viewports. Clicking the input or focusing it opens the chat
 * drawer. The drawer contains the full chat UI with messages and input.
 */

import { test, expect } from "../helpers/test.ts";
import fs from "node:fs";
import path from "node:path";

const cacheDir = path.join(
  import.meta.dirname,
  "../../fixtures/chat-widget/.aicache",
);

function hasCacheOrApiKey(): boolean {
  if (process.env.OPENAI_API_KEY) return true;
  if (fs.existsSync(cacheDir) && fs.readdirSync(cacheDir).length > 0) return true;
  return false;
}

test("sidebar assistant widget is visible on desktop", async ({ page }) => {
  // Sidebar assistant needs ≥ lg (1080px) viewport
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // The sidebar assistant shows "Ask AI about this page" text
  const askAiText = page.getByText("Ask AI about this page");
  await expect(askAiText).toBeVisible({ timeout: 10000 });
});

test("typing in sidebar input and pressing Enter opens the chat drawer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Find and click the chat input in the sidebar
  const sidebar = page.getByText("Ask AI about this page");
  await expect(sidebar).toBeVisible({ timeout: 10000 });

  // Type in the sidebar textarea and press Enter to submit
  const chatInput = page.locator("textarea").first();
  await chatInput.fill("hello");
  await chatInput.press("Enter");

  // The drawer should open — it has a "New chat" button with aria-label
  const newChatButton = page.locator("button[aria-label='New chat']");
  await expect(newChatButton).toBeVisible({ timeout: 10000 });
});

test("can send a message and receive an AI response", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Type the message in the sidebar input and press Enter.
  // This opens the drawer AND submits the message in one step.
  const chatInput = page.locator("textarea").first();
  await chatInput.fill("What is this documentation about?");
  await chatInput.press("Enter");

  // Wait for drawer to open
  const newChatButton = page.locator("button[aria-label='New chat']");
  await expect(newChatButton).toBeVisible({ timeout: 10000 });

  // Wait for an assistant response. The message list shows user + assistant.
  // data-message-id attributes mark each message.
  await expect(async () => {
    const messages = await page.locator("[data-message-id]").all();
    expect(messages.length).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 60000 });

  // The assistant message should have some visible text
  const assistantMsg = page.locator("[data-message-id='msg-1']");
  await expect(assistantMsg).toBeVisible();
  const text = await assistantMsg.textContent();
  expect(text?.length).toBeGreaterThan(0);
}, 90000);

test("client tool execution — model calls get_time and receives result", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Send a message that should trigger the get_time tool
  const chatInput = page.locator("textarea").first();
  await chatInput.fill("Use the get_time tool to tell me what time it is right now.");
  await chatInput.press("Enter");

  // Wait for drawer to open
  const newChatButton = page.locator("button[aria-label='New chat']");
  await expect(newChatButton).toBeVisible({ timeout: 10000 });

  // Wait for the tool-call indicator. The container carries
  // data-tool-call={toolName}; its label is the model-provided human
  // readable description (auto-injected input field), never raw JSON.
  const toolCall = page.locator('[data-tool-call="get_time"]');
  await expect(toolCall).toBeVisible({ timeout: 60000 });
  await expect(toolCall).toHaveAttribute("data-tool-state", "completed", { timeout: 30000 });
  const toolLabel = await toolCall.textContent();
  expect(toolLabel).not.toContain('{"');

  // After the tool result comes back, the model should respond with text
  // that includes a time-like string (ISO date or readable time).
  await expect(async () => {
    const messages = await page.locator("[data-message-id]").all();
    // Should have: user msg (msg-0) + assistant msg with tool call + result + text (msg-1)
    expect(messages.length).toBeGreaterThanOrEqual(2);
    const lastAssistant = messages[messages.length - 1];
    const content = await lastAssistant.textContent();
    // The response should mention time in some form
    expect(content?.length).toBeGreaterThan(10);
  }).toPass({ timeout: 60000 });
}, 120000);

// ── Tool approvals ────────────────────────────────────────────────
//
// The /approval fixture page registers pageTools (browser_type etc.) and
// renders an email input wrapped in data-holocron-requires-approval.
// DOM-mutating tools targeting protected elements must show an
// Approve/Deny prompt first. There is deliberately no click tool — the
// model highlights elements instead — so approvals are exercised via
// browser_type.

async function askOnApprovalPage(page: import("@playwright/test").Page, prompt: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/approval");
  await page.waitForLoadState("networkidle");

  const chatInput = page.locator("textarea").first();
  await chatInput.fill(prompt);
  await chatInput.press("Enter");

  // Wait for drawer to open
  await expect(page.locator("button[aria-label='New chat']")).toBeVisible({ timeout: 10000 });
}

const changeEmailPrompt =
  'Use the browser_type tool to type "new@example.com" into the email input with selector [data-action="email-input"]. Do it now without asking any questions.';

test("tool approval — Approve runs the protected type", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await askOnApprovalPage(page, changeEmailPrompt);

  // Approval card appears; the tool has NOT run yet
  const approvalCard = page.locator("[data-approval-request]");
  await expect(approvalCard).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId("account-email")).toHaveText("Account email: old@example.com");

  // The card shows the custom message from the data attribute and the
  // model-provided human readable description (not raw JSON args)
  await expect(approvalCard).toContainText("This will change the account email");
  const cardText = await approvalCard.textContent();
  expect(cardText).not.toContain("{");

  await approvalCard.locator("button", { hasText: "Approve" }).click();

  // Tool executes: the value is typed and React state updates
  await expect(page.getByTestId("account-email")).toHaveText("Account email: new@example.com", { timeout: 15000 });
  await expect(approvalCard).toHaveAttribute("data-approval-state", "approved");

  // The conversation continues after the tool result
  await expect(async () => {
    const messages = await page.locator("[data-message-id]").all();
    expect(messages.length).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 60000 });
}, 120000);

test("tool approval — Deny blocks the protected type", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await askOnApprovalPage(page, changeEmailPrompt);

  const approvalCard = page.locator("[data-approval-request]");
  await expect(approvalCard).toBeVisible({ timeout: 60000 });

  await approvalCard.locator("button", { hasText: "Deny" }).click();

  await expect(approvalCard).toHaveAttribute("data-approval-state", "denied");

  // The tool never ran — DOM state unchanged
  await expect(page.getByTestId("account-email")).toHaveText("Account email: old@example.com");

  // The denial is sent back as a tool error and the model responds with text
  await expect(async () => {
    const assistantText = await page
      .locator("[data-message-id='msg-1']")
      .textContent();
    expect(assistantText).toContain("✗ Denied");
    expect(assistantText!.length).toBeGreaterThan(30);
  }).toPass({ timeout: 60000 });

  // Still unchanged after the model's follow-up turn
  await expect(page.getByTestId("account-email")).toHaveText("Account email: old@example.com");
}, 120000);

test("tool approval — unprotected type runs without approval", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await askOnApprovalPage(
    page,
    'Use the browser_type tool to type "New Name" into the display name input with selector [data-action="name-input"]. Do it now without asking any questions.',
  );

  // The type happens directly — no approval prompt
  await expect(page.getByTestId("account-name")).toHaveText("Account name: New Name", { timeout: 60000 });
  await expect(page.locator("[data-approval-request]")).toHaveCount(0);
}, 120000);

test("browser_highlight — persistent overlay, returns immediately, dismissed via × button", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await askOnApprovalPage(
    page,
    'Use the browser_highlight tool to highlight the Rename account button with selector [data-action="rename-account"] and message "Click here to rename your account". Do it now without asking any questions.',
  );

  // The spotlight overlay appears on document.body
  const overlay = page.locator("[data-holocron-highlight-overlay]");
  await expect(overlay).toBeVisible({ timeout: 60000 });

  // The tool returns immediately (it does not block the AI loop waiting
  // for dismissal), so the tool call completes while the overlay stays up.
  const toolCall = page.locator('[data-tool-call="browser_highlight"]').first();
  await expect(toolCall).toHaveAttribute("data-tool-state", "completed", { timeout: 30000 });

  // Wait for the assistant turn to finish — the overlay must still be
  // visible after the chat stream ends (no auto-dismiss timer).
  await expect(async () => {
    const messages = await page.locator("[data-message-id]").all();
    expect(messages.length).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 60000 });
  await expect(overlay).toBeVisible();

  // The description card renders with a × dismiss button
  const dismissButton = overlay.locator("button[aria-label='Dismiss highlight']");
  await expect(dismissButton).toBeVisible();

  // Clicking × removes the overlay
  await dismissButton.click();
  await expect(overlay).toHaveCount(0, { timeout: 5000 });
}, 120000);

test("chat messages survive client-side navigation while drawer is open", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Open the drawer with a message
  const chatInput = page.locator("textarea").first();
  await chatInput.fill("What is this documentation about?");
  await chatInput.press("Enter");

  const newChatButton = page.locator("button[aria-label='New chat']");
  await expect(newChatButton).toBeVisible({ timeout: 10000 });

  await expect(async () => {
    const messages = await page.locator("[data-message-id]").all();
    expect(messages.length).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 60000 });

  // Navigate via the sidebar link (client-side nav, no full reload).
  // The sidebar is behind the drawer overlay, so close the drawer first.
  await page.locator("button[aria-label='Close']").click();
  await expect(newChatButton).not.toBeVisible({ timeout: 5000 });

  const navLink = page.locator('.slot-sidebar-left a[href="/getting-started"]');
  await navLink.click();
  await expect(page).toHaveURL(/getting-started/, { timeout: 5000 });

  // Re-open the drawer — messages from the previous page should persist
  // because the zustand store survives client-side navigation.
  await page.waitForLoadState("networkidle");
  const reopenInput = page.locator("textarea").first();
  await reopenInput.focus();
  await expect(newChatButton).toBeVisible({ timeout: 10000 });

  await expect(async () => {
    const messages = await page.locator("[data-message-id]").all();
    expect(messages.length).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 10000 });

  const firstUserMsg = page.locator("[data-message-id='msg-0']");
  await expect(firstUserMsg).toContainText("What is this documentation about?");
}, 120000);

test("chat state persists after client-side navigation", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Send a message and wait for response
  const chatInput = page.locator("textarea").first();
  await chatInput.fill("What features does this site have?");
  await chatInput.press("Enter");

  const newChatButton = page.locator("button[aria-label='New chat']");
  await expect(newChatButton).toBeVisible({ timeout: 10000 });

  await expect(async () => {
    const messages = await page.locator("[data-message-id]").all();
    expect(messages.length).toBeGreaterThanOrEqual(2);
  }).toPass({ timeout: 60000 });

  // Count messages before navigation
  const messageCountBefore = await page.locator("[data-message-id]").count();

  // Close the drawer first — the backdrop overlay blocks clicks on page elements
  const closeButton = page.locator("button[aria-label='Close']");
  await closeButton.click();
  // Wait for drawer to fully close
  await expect(newChatButton).not.toBeVisible({ timeout: 5000 });

  // Navigate to another page using the sidebar nav (client-side nav).
  // Use the sidebar nav link (not the TOC heading anchor /#getting-started).
  const navLink = page.locator('.slot-sidebar-left a[href="/getting-started"]');
  await navLink.click();
  await expect(page).toHaveURL(/getting-started/, { timeout: 5000 });

  // Re-open the drawer by clicking the sidebar assistant input.
  // Type something and press Enter to open the drawer.
  await page.waitForLoadState("networkidle");
  const sidebar = page.getByText("Ask AI about this page");
  await expect(sidebar).toBeVisible({ timeout: 10000 });
  const reopenInput = page.locator("textarea").first();
  await reopenInput.fill("hi");
  await reopenInput.press("Enter");
  await expect(newChatButton).toBeVisible({ timeout: 10000 });

  // Previous messages should still be visible (zustand store survives
  // client-side navigation). The store keeps all prior messages plus
  // the new "hi" user message = messageCountBefore + 1 at minimum.
  await expect(async () => {
    const messages = await page.locator("[data-message-id]").all();
    expect(messages.length).toBeGreaterThanOrEqual(messageCountBefore);
  }).toPass({ timeout: 10000 });

  // Verify the first user message from the original conversation is still there
  const firstUserMsg = page.locator("[data-message-id='msg-0']");
  await expect(firstUserMsg).toBeVisible();
  const firstUserText = await firstUserMsg.textContent();
  expect(firstUserText).toContain("What features does this site have?");
}, 120000);
