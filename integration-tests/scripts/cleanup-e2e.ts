/**
 * Remove only the current integration-test run's cache and build artifacts.
 */

import { cleanupAllFixtureRunArtifacts } from "./fixtures.ts";

export function cleanupCurrentRunArtifacts(): void {
  const runId = process.env["E2E_RUN_ID"]?.trim();
  if (!runId) {
    return;
  }

  cleanupAllFixtureRunArtifacts(runId);
}

export default cleanupCurrentRunArtifacts;
