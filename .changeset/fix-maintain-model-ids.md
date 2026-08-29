---
'@holocron.so/cli': patch
'website': patch
---

Fix `holocron maintain --model` examples and error text.

The BYOK example is now a real OpenCode id, `anthropic/claude-sonnet-4-5`. Failed OpenCode calls print the provider error instead of always saying the API key is missing. Unknown hosted ids hint at the `provider/model` form. Docs name the hosted models (`deepseek-v4-flash` default, `glm-5.3-flash`) and point at `opencode auth login` for keys.
