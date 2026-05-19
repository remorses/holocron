import { spawn } from "node:child_process";
import {
  ensureE2ERunId,
  integrationTestsDir,
} from "./fixtures.ts";
import { cleanupCurrentRunArtifacts } from "./cleanup-e2e.ts";

function runStep({
  command,
  args,
  env,
}: {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: integrationTestsDir,
      stdio: "inherit",
      env,
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit ${code}`));
    });

    child.on("error", reject);
  });
}

const runId = ensureE2ERunId();
const forwardedArgs = process.argv.slice(2);
const requestedProject = (() => {
  const exact = forwardedArgs.find((arg) => arg.startsWith("--project="));
  if (exact) return exact.slice("--project=".length);

  const index = forwardedArgs.indexOf("--project");
  return index >= 0 ? forwardedArgs[index + 1] : undefined;
})();

console.log(`[test-e2e-start] run ${runId}`);

const env = {
  ...process.env,
  E2E_RUN_ID: runId,
  E2E_START: "1",
  ...(requestedProject ? { E2E_FIXTURES: requestedProject } : {}),
};

try {
  await runStep({ command: "pnpm", args: ["exec", "tsx", "scripts/build-fixtures.ts"], env });
  await runStep({ command: "pnpm", args: ["exec", "playwright", "test", ...forwardedArgs], env });
} finally {
  cleanupCurrentRunArtifacts();
}
