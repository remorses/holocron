/**
 * Fixture-local Vite config for the chat widget tests.
 *
 * Starts a local mock of the holocron.so /api/chat gateway and points
 * HOLOCRON_URL at it. Known test prompts use canned streams. Unmapped
 * prompts still replay from .aicache/, or fail fast without OPENAI_API_KEY.
 */

import { defineConfig } from "vite";
import { holocron } from "@holocron.so/vite/vite";
import {
  cleanupFixtureRunPaths,
  createE2EViteConfig,
  resolveFixtureRunPaths,
} from "../../scripts/e2e-vite-config.ts";
import { startMockChatServer } from "./mock-chat-server.ts";

cleanupFixtureRunPaths(resolveFixtureRunPaths());

export default defineConfig(async ({ command }) => {
  if (command === "serve") {
    const server = await startMockChatServer();
    process.env.HOLOCRON_URL = `http://localhost:${server.port}`;
  } else if (process.env.E2E_CHAT_URL) {
    // The production test parent owns this server so it survives the build.
    process.env.HOLOCRON_URL = process.env.E2E_CHAT_URL;
  }
  return createE2EViteConfig({
    plugins: [holocron({ pageCache: false })],
  });
});
