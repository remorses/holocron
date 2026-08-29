---
'@holocron.so/cli': minor
'website': minor
---

Add `--model` to `holocron maintain` so a run can use a Holocron-hosted model or an OpenCode provider you already pay for.

By default Maintain still uses a **Holocron-hosted model** and bills the site's Pro subscription. Pass a hosted id such as `glm-5.3-flash` to pick from that list. Pass `provider/model` to skip Holocron auth and credits:

```bash
npx -y "@holocron.so/cli" maintain --since origin/main
npx -y "@holocron.so/cli" maintain --model glm-5.3-flash
npx -y "@holocron.so/cli" maintain --model anthropic/claude-sonnet-4
```

OpenCode reads the provider key from the environment or from `opencode /connect`. See the [OpenCode providers](https://opencode.ai/docs/providers/) page for env vars such as `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.
