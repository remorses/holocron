import { spawn } from "node:child_process";
import { ensureE2ERunId, integrationTestsDir } from "./fixtures.ts";

function runStep(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
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

console.log(`[test-e2e-start] run ${runId}`);

const env = {
  ...process.env,
  E2E_RUN_ID: runId,
  E2E_START: "1",
};

await runStep("pnpm", ["exec", "tsx", "scripts/build-fixtures.ts"], env);
await runStep("pnpm", ["exec", "playwright", "test", ...forwardedArgs], env);
