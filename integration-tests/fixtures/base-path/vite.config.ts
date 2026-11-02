import { defineConfig } from "vite";
import { holocron } from "@holocron.so/vite/vite";
import {
  cleanupFixtureRunPaths,
  createE2EViteConfig,
  resolveFixtureRunPaths,
} from "../../scripts/e2e-vite-config.ts";

cleanupFixtureRunPaths(resolveFixtureRunPaths());

export default defineConfig(createE2EViteConfig({
  base: "/docs",
  plugins: [holocron()],
}));
