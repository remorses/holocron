---
'@holocron.so/cli': minor
---

Add `holocron subscribe` and `holocron subscription status` commands for managing Holocron Pro subscriptions from the CLI.

`holocron subscribe` opens Stripe Checkout in the browser for a selected project. Prompts interactively for project and billing interval when flags are omitted.

```bash
# Interactive mode (prompts for project and interval)
holocron subscribe

# Non-interactive
holocron subscribe --project <projectId> --interval yearly
```

`holocron subscription status` shows the current subscription state for a project. Supports both session auth and API key auth (`HOLOCRON_KEY`).

```bash
holocron subscription status --project <projectId>
```
