/**
 * Fixture-local Vite config for the changelog provider.
 *
 * Starts an in-process mock of the GitHub releases API and points the
 * changelog provider at it via HOLOCRON_CHANGELOG_API_URL, so the fixture
 * is hermetic and does not hit the live GitHub API.
 */

import { defineConfig } from "vite";
import { holocron } from "@holocron.so/vite/vite";
import {
  cleanupFixtureRunPaths,
  createE2EViteConfig,
  resolveFixtureRunPaths,
} from "../../scripts/e2e-vite-config.ts";
import { startMockGitHubServer } from "./mock-github-server.ts";

cleanupFixtureRunPaths(resolveFixtureRunPaths());

export default defineConfig(async () => {
  await startMockGitHubServer();
  return createE2EViteConfig({
    plugins: [holocron()],
  });
});
