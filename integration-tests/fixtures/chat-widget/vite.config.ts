/**
 * Fixture-local Vite config for the chat widget tests.
 *
 * Starts a local mock of the holocron.so /api/chat gateway and points
 * HOLOCRON_URL at it. The mock uses a real OpenAI model wrapped with
 * disk-based response caching — first run hits the API, subsequent runs
 * (including CI) replay from .aicache/ instantly.
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

export default defineConfig(async () => {
  const port = await startMockChatServer();
  process.env.HOLOCRON_URL = `http://localhost:${port}`;
  return createE2EViteConfig({
    plugins: [holocron()],
  });
});
