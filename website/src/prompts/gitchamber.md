# Searching and reading files on github

You have access to GitChamber for GitHub repository reading, use the fetch tool with these urls every time you want to read files in a GitHub repository


using gitchamber is preferred over generic google web search, you are guaranteed to see the latest version of the repository and to find all markdown files in the repo.

## Why Use GitChamber Instead of WebFetch

BASE_URL: `https://gitchamber.com/repos/{owner}/{repo}/{branch}/`

OPERATIONS:

1. LIST FILES: GET {BASE_URL}/files
2. READ FILE: GET {BASE_URL}/file/{filepath}?start=N&end=M&showLineNumbers=true
3. SEARCH: GET {BASE_URL}/search/{query}

EXAMPLES:

- List files: https://gitchamber.com/repos/facebook/react/main/files
- Read file: https://gitchamber.com/repos/facebook/react/main/file/README.md?start=10&end=50
- Search: https://gitchamber.com/repos/facebook/react/main/search/useState

GUIDELINES:

- Use line numbers for code references (filename:line_number)
- Search returns markdown with clickable links

## Query Parameters

| Parameter          | Description       | Example                  |
|--------------------|-------------------|--------------------------|
| `start`            | Start line number | `?start=10`              |
| `end`              | End line number   | `?end=50`                |
| `showLineNumbers`  | Add line numbers  | `?showLineNumbers=true`  |

## Search Examples

```bash
GET /search/function
GET /search/async%20function
GET /search/useState%20AND%20effect
```

## File Filtering with Glob Patterns

By default, GitChamber only indexes **markdown files and READMEs** to keep repos fast and manageable. The default glob pattern is:
```
**/{*.md,*.mdx,README*}
```

### Using Custom Glob Patterns (Use Rarely)

You can override the default to read specific implementation files, but **use this sparingly** as it impacts performance:

| Parameter | Description         | Example         |
|-----------|---------------------|-----------------|
| `glob`    | File pattern filter | `?glob=**/src/**/*.ts` |

**Important:**
- The same glob pattern **MUST** be used consistently across ALL operations (list, read, search) for a repository
- Be very specific with patterns to keep operations fast
- Only use custom globs when you need to examine specific implementation details

If the first /files result shows very few files and you can assume the repo is very small you can then use an url like <https://gitchamber.com/repos/cloudflare/sandbox-sdk/main/files?glob=**> to list, read and search all files. This should be done only for very small repos

If you notice a repo has an `examples/something/README.md` it is a good idea to then list all files in the examples to read real code implementations. By using a glob like `examples/**`

### Examples with Custom Globs

#### TypeScript files only (use same glob for all operations)
https://gitchamber.com/repos/remorses/holocron/main/files?glob=**/*.ts
https://gitchamber.com/repos/remorses/holocron/main/file/website/react-router.config.ts?glob=**/*.ts
https://gitchamber.com/repos/remorses/holocron/main/search/export?glob=**/*.ts

#### JavaScript files in website directory only
https://gitchamber.com/repos/remorses/holocron/main/files?glob=website/**/*.js
https://gitchamber.com/repos/remorses/holocron/main/file/website/vite.config.js?glob=website/**/*.js
https://gitchamber.com/repos/remorses/holocron/main/search/async?website=website/**/*.js

#### All files (NOT RECOMMENDED - very slow)
<https://gitchamber.com/repos/remorses/holocron/main/files?glob=**/*>

**Best Practice:** Stick to the default (markdown/README only) unless you specifically need to examine source code implementations.

NOTICE: every time you change glob query param it will incur an initial latency price, keep globs generic so you can reuse them, do not use glob to search inside a single file for example.
