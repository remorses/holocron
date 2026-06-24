---
'@holocron.so/vite': minor
---

Add `/llms-full.txt` endpoint that serves the full content of all documentation pages in a single markdown file.

Pages appear in `docs.json` navigation order. Each page is separated by a YAML frontmatter block containing `title`, `url`, and optionally `description`:

```
---
title: Getting Started
url: https://your-site.com/getting-started.md
description: Quick start guide
---

# Getting Started

Follow these steps to get started...
```

This complements the existing `/llms.txt` (lightweight index) and `/docs.zip` (zipped markdown). Useful for AI agents that want to ingest the entire documentation set in one request without downloading a zip or making per-page requests.

```bash
curl https://your-docs-site.com/llms-full.txt
```

The route is available at both `/llms-full.txt` and under the configured base path (e.g. `/docs/llms-full.txt`). The agent directive on `.md` pages and HTML responses now mentions `llms-full.txt` too.
