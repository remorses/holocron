---
'@holocron.so/cli': minor
---

`holocron diagrams fix` now formats GFM tables in place, not just box-drawing diagrams.

Each table is found via the mdast AST, stringified with the same `mdast-util-gfm` path used by Holocron `.md` / `.mdx` handlers (padded columns, aligned pipes), then spliced back into the original source. The full MDX document is never re-serialized, so prose, JSX, and code fences stay untouched.

```bash
npx -y "@holocron.so/cli" diagrams fix docs/**/*.mdx
```

Before:

```md
|Name|Age|City|
|---|---|---|
|Alice|30|NYC|
|Bob|2|SF|
```

After:

```md
| Name  | Age | City |
| ----- | --- | ---- |
| Alice | 30  | NYC  |
| Bob   | 2   | SF   |
```

Also normalizes a blank line above and below each table, and peels trailing prose that GFM would otherwise absorb when a table is missing its closing blank line. `--check` fails on unformatted tables the same way it does for misaligned diagrams.
