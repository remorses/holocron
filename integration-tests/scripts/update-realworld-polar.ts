import fs from "node:fs";
import path from "node:path";
import { fixturesDir } from "./fixtures.ts";

const sourceDir = path.resolve(
  import.meta.dirname,
  "../../node_modules/.gitchamber/github.com/polarsource/polar/docs",
);
const fixtureDir = path.join(fixturesDir, "realworld-polar");

function copyDirectoryContents(source: string, destination: string): void {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    fs.cpSync(sourcePath, destinationPath, {
      force: true,
      recursive: true,
    });
  }
}

if (!fs.existsSync(sourceDir)) {
  throw new Error(
    `Polar docs source not found at ${sourceDir}. Run chamber for the Polar repo first.`,
  );
}

if (fs.existsSync(fixtureDir)) {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}

copyDirectoryContents(sourceDir, fixtureDir);

console.log(`[update-realworld-polar] copied ${sourceDir} -> ${fixtureDir}`);
