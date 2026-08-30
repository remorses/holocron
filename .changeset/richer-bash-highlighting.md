---
'@holocron.so/vite': patch
---

Bash code blocks now color the **command** at the start of each statement, plus **npm-style packages** like `@scope/cli`.

Prism's bash grammar only highlighted a fixed Unix allowlist (`git`, `npm`, `curl`, `file`). Docs commands such as `npx`, `wrangler`, and `pi` stayed plain text, and arguments like `file` were wrongly colored because they share a Unix command name.

```bash
npx @subrouter/cli login anthropic
cat file | wrangler deploy
```

`npx` / `wrangler` render as commands. `@subrouter/cli` renders as a package. `file` stays an argument.
