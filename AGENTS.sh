#!/bin/bash

PREFIX="
# Project Coding Guidelines

NOTICE: AGENTS.md is generated using AGENTS.sh and should NEVER be manually updated.

---


"

OUTPUT_FILE="AGENTS.md"

echo "$PREFIX" > "$OUTPUT_FILE"

# Force cache refresh with initial files listing
echo "Refreshing gitchamber cache..."
curl -fsSL "https://gitchamber.com/repos/remorses/AGENTS.md/main/files?force=true" > /dev/null

for f in \
    core.md \
    typescript.md \
    pnpm.md \
    github.md \
    react.md \
    sentry.md \
    vitest.md \
    changelog.md \
    docs-writing.md \
    doppler.md \
    cac.md \
    prisma.md \
    react-router.md \
    shadcn.md \
    tailwind.md \
    lucide.md \
    spiceflow.md \
    vercel-ai-sdk.md \
    playwright.md \
    zod.md; do
  echo "Fetching $f..."
  curl -fsSL "https://gitchamber.com/repos/remorses/AGENTS.md/main/files/$f" >> "$OUTPUT_FILE"
  printf '\n\n---\n\n' >> "$OUTPUT_FILE"
done

ln -sf AGENTS.md CLAUDE.md

echo "✅ AGENTS.md generated successfully!"
