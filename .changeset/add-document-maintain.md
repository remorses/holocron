---
'@holocron.so/cli': minor
'@holocron.so/vite': minor
'website': minor
---

Add `holocron maintain` for maintaining documentation from versioned page generation prompts.

Pages can record the source files, folders, and URLs used to generate them:

```yaml
---
prompt: |
  Write the authentication guide from @/src/auth/.
  Use @https://github.com/example/project/releases for recent behavior.
  Explain sessions, API keys, and GitHub Actions OIDC.
---
```

`holocron maintain` detects changed references, runs one OpenCode session with parallel tasks, validates resulting MDX, and can open one GitHub pull request. GitHub Actions authenticates through OIDC without a stored Holocron key.

Use `--all` with `--prompt` or `--prompt-file` for scheduled grammar, SEO, link, translation, and style reviews.
