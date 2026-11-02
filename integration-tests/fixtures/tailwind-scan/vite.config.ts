/** Fixture-local Vite config that places Holocron pages in a custom src/ pagesDir. */

import { defineConfig } from "vite";
import { holocron } from "@holocron.so/vite/vite";
import {
  cleanupFixtureRunPaths,
  createE2EViteConfig,
  resolveFixtureRunPaths,
} from "../../scripts/e2e-vite-config.ts";

cleanupFixtureRunPaths(resolveFixtureRunPaths());

export default defineConfig(createE2EViteConfig({
  plugins: [holocron({ pagesDir: "src" })],
}));
