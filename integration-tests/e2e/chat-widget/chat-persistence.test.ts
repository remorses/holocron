/**
 * Chat session persistence integration tests.
 *
 * Verifies that AI chat conversations survive a full page reload:
 * the proxy mints a chs_... session id (JS-readable cookie, not httpOnly),
 * the mock gateway stores ModelMessage snapshots per session (standing in
 * for ChatSessionDO), and the restore endpoint returns the conversation
 * server-rendered.
 *
 * Also tests widget-mode persistence: cross-origin embeds use localStorage
 * + x-holocron-chat-session header instead of cookies. The header-based
 * restore must work independently of the cookie.
 *
 * Uses HOLOCRON_CHAT_PROVIDER caching like chat-widget.test.ts — tests that
 * need an actual AI reply reuse prompts already recorded in .aicache/ so
 * runs without OPENAI_API_KEY replay deterministically.
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

/** Send a message via the sidebar input (opens the drawer + submits). */
async function sendMessage(page: import("@playwright/test").Page, text: string) {
  const chatInput = page.locator("textarea").first();
  await chatInput.fill(text);
  await chatInput.press("Enter");
  // Drawer opens — it has the "New chat" button
  await expect(page.locator("button[aria-label='New chat']")).toBeVisible({ timeout: 10000 });
}

/** Wait until the conversation shows at least `count` messages. */
async function waitForMessages(page: import("@playwright/test").Page, count: number) {
  await expect(async () => {
    const messages = await page.locator("[data-message-id]").all();
    expect(messages.length).toBeGreaterThanOrEqual(count);
  }).toPass({ timeout: 60000 });
}

test("first chat message sets a JS-readable session cookie", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // No session cookie before chatting
  const before = await page.context().cookies();
  expect(before.find((c) => c.name === "holocron_chat")).toBeUndefined();

  // Sending a message triggers the chat POST; the proxy mints the session
  // id and sets the cookie on the response regardless of the AI outcome.
  await sendMessage(page, "hello cookie test");

  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.find((c) => c.name === "holocron_chat")?.value ?? "";
    }, { timeout: 10000 })
    .toMatch(/^chs_[A-Za-z0-9_-]{43}$/);

  // Cookie must be JS-readable (not httpOnly) so the client can detect an
  // existing session on page load and eagerly restore the conversation.
  const cookie = (await page.context().cookies()).find((c) => c.name === "holocron_chat")!;
  expect(cookie.httpOnly).toBe(false);
});

test("conversation persists across page reload", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Same prompt as chat-widget.test.ts so the .aicache replay hits.
  await sendMessage(page, "What is this documentation about?");
  await waitForMessages(page, 2);

  const assistantTextBefore = await page
    .locator("[data-message-id='msg-1']")
    .textContent();
  expect(assistantTextBefore?.length).toBeGreaterThan(0);

  // Full reload — in-memory zustand stores are wiped; only the JS-readable
  // cookie survives. Eager restore fires on page load; focusing the sidebar
  // input detects the restored messages and reopens the drawer.
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.locator("textarea").first().focus();

  const newChatButton = page.locator("button[aria-label='New chat']");
  await expect(newChatButton).toBeVisible({ timeout: 15000 });

  await waitForMessages(page, 2);
  const userMsg = page.locator("[data-message-id='msg-0']");
  await expect(userMsg).toContainText("What is this documentation about?");

  // The restored assistant message is server-rendered markdown (JSX), not
  // a raw text dump — its content should match what streamed originally.
  const assistantTextAfter = await page
    .locator("[data-message-id='msg-1']")
    .textContent();
  expect(assistantTextAfter?.trim()).toBe(assistantTextBefore?.trim());
}, 120000);

test("submit after reload includes the restored history in the request", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await sendMessage(page, "What is this documentation about?");
  await waitForMessages(page, 2);

  await page.reload();
  await page.waitForLoadState("networkidle");

  // Eager restore fires on page load (cookie is JS-readable). Focusing the
  // sidebar input detects restored messages and opens the drawer. Wait for
  // the drawer to appear with the previous conversation visible.
  await page.locator("textarea").first().focus();
  await expect(page.locator("button[aria-label='New chat']")).toBeVisible({ timeout: 15000 });
  await waitForMessages(page, 2);

  // Now submit a follow-up from the drawer. The POST body must include the
  // restored history so the server-side snapshot is not overwritten with
  // only the new turn.
  const requestPromise = page.waitForRequest(
    (req) => req.url().includes("/holocron-api/chat") && req.method() === "POST",
    { timeout: 30000 },
  );

  // The drawer is open — use the visible drawer textarea.
  const drawerInput = page.locator("textarea:visible");
  await drawerInput.fill("and who maintains it?");
  await drawerInput.press("Enter");

  const request = await requestPromise;
  const body = request.postDataJSON() as { modelMessages: unknown[]; message: string };
  expect(body.message).toBe("and who maintains it?");
  expect(body.modelMessages.length).toBeGreaterThan(0);

  // The restored history must also be visible in the UI above the new turn.
  const firstUserMsg = page.locator("[data-message-id='msg-0']");
  await expect(firstUserMsg).toContainText("What is this documentation about?");
}, 120000);

test("new chat rotates the session without opening the old one on reload", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await sendMessage(page, "What is this documentation about?");
  await waitForMessages(page, 2);

  // New chat expires the cookie locally and resets the conversation.
  // It does NOT delete the server-side snapshot — the old session stays
  // available in the session select.
  await page.locator("button[aria-label='New chat']").click();

  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.find((c) => c.name === "holocron_chat")?.value ?? "";
    }, { timeout: 10000 })
    .toBe("");
  await expect(page.locator("[data-message-id]")).toHaveCount(0);

  await page.reload();
  await page.waitForLoadState("networkidle");

  // The cookie is expired so eager restore does not fire on page load
  // (hasExistingSession() returns false). Focusing the sidebar input should
  // NOT open the drawer — the fresh session has nothing to restore.
  await page.locator("textarea").first().focus();
  // Type something to prove the sidebar is interactive (the textarea accepts input)
  // but the drawer must NOT open since there is no session to restore.
  await page.locator("textarea").first().fill("test");
  await expect(page.locator("button[aria-label='New chat']")).not.toBeVisible({ timeout: 3000 });
}, 120000);

test("session select shows the AI title and switches back to a past session", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await sendMessage(page, "What is this documentation about?");
  await waitForMessages(page, 2);

  // The gateway (mocked) emits a title chunk after the first turn; the
  // select trigger swaps the preview placeholder for the AI title.
  const trigger = page.locator("button[aria-label='Chat sessions']");
  await expect(trigger).toContainText("Title: What is this", { timeout: 30000 });

  // Start a fresh chat — trigger falls back to the placeholder and the
  // conversation area resets.
  await page.locator("button[aria-label='New chat']").click();
  await expect(page.locator("[data-message-id]")).toHaveCount(0);
  await expect(trigger).toContainText("New chat");

  // Opening the menu must not mutate <body> (Radix Select's scroll lock
  // forced margin-right on body, shifting margin-auto-centered host pages —
  // the non-modal dropdown applies no body styles at all).
  const bodyStyleBefore = await page.evaluate(() => document.body.getAttribute("style"));
  await trigger.click();
  const bodyStyleOpen = await page.evaluate(() => document.body.getAttribute("style"));
  expect(bodyStyleOpen).toBe(bodyStyleBefore);

  // The old session is listed in the select; picking it restores the
  // conversation from the server-side snapshot.
  await page.getByRole("menuitemradio", { name: /Title: What is this/ }).click();

  await waitForMessages(page, 2);
  await expect(page.locator("[data-message-id='msg-0']")).toContainText(
    "What is this documentation about?",
  );

  // The dropdown also offers a "New chat" action item (same as the plus button).
  await trigger.click();
  await page.getByRole("menuitem", { name: "New chat" }).click();
  await expect(page.locator("[data-message-id]")).toHaveCount(0);
}, 120000);

// ── Widget-mode persistence (header-based, no cookies) ──────────────

test("widget mode: restore works via x-holocron-chat-session header without cookies", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await sendMessage(page, "What is this documentation about?");
  await waitForMessages(page, 2);

  // Extract the session ID from the cookie (server always sets it).
  const sessionId = (await page.context().cookies())
    .find((c) => c.name === "holocron_chat")?.value ?? "";
  expect(sessionId).toMatch(/^chs_[A-Za-z0-9_-]{43}$/);

  // Clear ALL cookies so the restore cannot use the cookie path.
  // This simulates the cross-origin widget scenario where the browser
  // does not send first-party cookies to a different origin.
  await page.context().clearCookies();

  // Make a restore request using ONLY the x-holocron-chat-session header
  // (the same mechanism the ChatWidget client uses in widget mode).
  // Use page.evaluate so the request originates from the browser with no cookies.
  const restoreResult = await page.evaluate(async (sid) => {
    const res = await fetch("/holocron-api/chat/session", {
      headers: { "x-holocron-chat-session": sid },
      // Explicitly omit credentials to prove cookies are not needed
      credentials: "omit",
    });
    return { status: res.status, bodyLength: (await res.arrayBuffer()).byteLength };
  }, sessionId);

  expect(restoreResult.status).toBe(200);
  // A successful restore returns a federation payload with rendered messages.
  // An empty session returns a minimal payload (~220 bytes for the federation
  // envelope). A real conversation with rendered markdown is much larger.
  expect(restoreResult.bodyLength).toBeGreaterThan(500);
}, 120000);

test("widget mode: clear works via x-holocron-chat-session header without cookies", async ({ page }) => {
  test.skip(!hasCacheOrApiKey(), "No OPENAI_API_KEY and no cached responses");

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await sendMessage(page, "What is this documentation about?");
  await waitForMessages(page, 2);

  const sessionId = (await page.context().cookies())
    .find((c) => c.name === "holocron_chat")?.value ?? "";
  expect(sessionId).toMatch(/^chs_[A-Za-z0-9_-]{43}$/);

  await page.context().clearCookies();

  // Clear via header (widget mode path)
  const clearResult = await page.evaluate(async (sid) => {
    const res = await fetch("/holocron-api/chat/session/clear", {
      method: "POST",
      headers: { "x-holocron-chat-session": sid },
      credentials: "omit",
    });
    return { status: res.status };
  }, sessionId);
  expect(clearResult.status).toBe(200);

  // After clearing, restore should return an empty/minimal payload
  const restoreResult = await page.evaluate(async (sid) => {
    const res = await fetch("/holocron-api/chat/session", {
      headers: { "x-holocron-chat-session": sid },
      credentials: "omit",
    });
    return { status: res.status, bodyLength: (await res.arrayBuffer()).byteLength };
  }, sessionId);

  expect(restoreResult.status).toBe(200);
  // After clear, the payload should be minimal (~220 bytes for the empty
  // federation envelope — much smaller than a real conversation with
  // rendered markdown which is typically 500+ bytes)
  expect(restoreResult.bodyLength).toBeLessThan(300);
}, 120000);
