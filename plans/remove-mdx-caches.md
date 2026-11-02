# Remove MDX caches plan

mdastic made MDX parse and transform cost ~0.05 to 0.34 ms per page. The caches and
indirection built around slow remark now cost more than they save, and one of them hides a
serialization bug. Delete them and simplify the build pipeline in `vite/`.

Check a box only when its evidence exists (command output, screenshot, log line, commit
SHA). Write the evidence next to the box. Verify on the real artifact, not tests alone.

## Baseline (2026-11-02, mdastic 0.3.4, commit e92b3f6d)

Corpora: `integration-tests/fixtures/realworld-polar` (258 pages, 537 KiB served MDX) and
`website/src/pages` (84 pages, 318 KiB). Medians of 5 to 7 runs, `deferProviders: true`.

| Cost | polar | website |
| --- | --- | --- |
| request parse + demoteBodyH1s + heading ids, avg / max | 0.048 / 1.1 ms | 0.086 / 0.5 ms |
| `#memoize` key hash (paid on every request, hit or miss) | 0.034 ms | 0.043 ms |
| `#memoize` L2 hit: `JSON.parse` of cached mdast (plus Cache API match) | 0.040 ms | 0.078 ms |
| build `processMdx` per page | 0.17 ms | 0.34 ms |
| build safe-mdx validation per page | 0.06 ms | 0.11 ms |
| full sync, warm page cache | 52.7 ms | 11.4 ms |
| full sync, no page cache | 412 to 560 ms | 48.7 ms |
| full sync, no page cache, network off | 136.9 ms | 47.9 ms |
| full sync, warm page cache, network off | 29.4 ms | 11.2 ms |
| `holocron-mdx.json` + `holocron-cache.json` on disk | 649 + 257 KiB | 373 + 152 KiB |

- The no-cache sync on polar is slow because of **images, not MDX**: one remote image is
  downloaded again on every sync (~400 ms), and every local image is read and hashed twice
  (`processImage`, `copyToPublic`). MDX parse and transforms are ~45 ms of the 137 ms.
- The warm page cache is not free either: `computeSha` reads and hashes every referenced
  image on every sync (~60 ms CPU in the polar profile).
- Every in-repo site already sets `pageCache: false` (website, example, integration tests).

## Caches

| Cache | What it stores | Verdict |
| --- | --- | --- |
| `#memoize` (`memoize-node.ts`, `memoize-workerd.ts`) | request-time mdast, isolate LRU + Cache API | **keep** (user decision): saves little, but prod CPU is billed |
| page cache: `holocron-cache.json`, `content`, `pageIconRefs`, `pageImportSources`, `pageInternalLinks`, `pageAssetRefs` in `holocron-mdx.json`, `NavPage.gitSha`, `computeSha`, `pageCache` option | processed MDX and metadata per page | **delete** after Task 4 fixes image cost (137 ms for 258 pages, ~0.5 ms per page) |
| inline import combined SHA + pre-parse (`resolveInlineImports`, `parsedNodes`, `MAY_HAVE_MD_IMPORTS`) | cache key and "parse each import once" | **delete**, see Task 7 |
| `holocron-images.json` | sharp dimensions and placeholders | keep, fix keys (Task 4) |
| icon atlas in `holocron-mdx.json` | Iconify SVG bodies (~76 ms module load) | keep, move to `holocron-icons.json` |
| `runtime-cache.ts`, per-sync enrich dedupe maps, search `WeakMap` | network fetches, dedupe, search index | keep, not parse related |

## Task 1: Benchmark harness

- [x] `vite/scripts/bench-sync.ts` prints full sync (default options), per-page parse and
  `processMdx`, and cache file sizes. `--offline` makes remote fetches fail fast. Evidence
  (page cache on): polar sync 29.6 ms offline / 30.4 ms online, website 10.4 / 11.9 ms,
  request parse avg 0.08 / 0.10 ms, `processMdx` avg 0.21 / 0.37 ms. Matches baseline.

## Task 2: Request-time `#memoize` stays

- [x] Kept by user decision, see `plans/decisions/request-mdx-memoize.md`. No work.

## Task 3: Fix serialize-after-unravel on image pages

Pages with processed images are serialized by `rewriteMdxImages` after `markAndUnravel`,
so `<Note>Use \`Note\` for info.</Note>` becomes three paragraphs. Pages without images
are fine. Verified with `processMdx` + `rewriteMdxImages` on a 4-line page.

- [x] Failing regression test first: single-line `<Note>` plus a local image keeps the Note
  on one line in the served MDX. Evidence: `sync.test.ts` "image pages keep single-line
  JSX children inline" failed with the split output before the fix.
- [x] `rewriteMdxImages` takes the normalized MDX string and parses it again (~0.05 ms)
  instead of serializing the unraveled analysis tree. Evidence: vite tests 874 passed.

## Task 4: Image cost without the page cache

- [x] Remote images are cached by URL, so a sync fetches each remote image at most once
  per cache lifetime. Evidence: polar no-page-cache sync 119.5 ms online, 117.4 ms offline
  (was 412 to 560 ms online).
- [x] Local image metadata is looked up without reading image bytes when path, size and
  mtime are unchanged, and `copyToPublic` stops re-reading files. Evidence: polar
  no-page-cache sync 137 → 117 ms offline, website 48 → 50 ms (noise). Missed the ~100 ms
  target: what remains is MDX CPU (`processMdx` ~55 ms, safe-mdx validation ~25 ms in a
  React dev build), not images. Test: `image-processor.test.ts` stat-keyed reuse.

## Task 5: Delete the page cache (after Tasks 3, 4)

- [x] Every sync processes every page. Delete `holocron-cache.json`, the per-page fields of
  `holocron-mdx.json`, `NavPage.gitSha`, `computeSha`, `assetFileSha`, the frontmatter
  image SHA deps, the cache-hit branch, `cachedCount`, and the `pageCache` option plus its
  uses in every `vite.config.ts`. The icon atlas moves to `holocron-icons.json`.
  Evidence: vite tests 869 passed; disk caches 906 KiB → 126 KiB on polar.
- [x] Pass when polar full sync is under ~100 ms, a polar dev HMR save is measured (file
  write to `rsc:update`) and recorded here, vite tests and `basic`, `mdx-imports`,
  `realworld-polar` e2e pass. Evidence: polar sync 98.8 ms offline / 106 ms online,
  website 49 / 46 ms; e2e 99 passed. Polar HMR medians: 196 and 244 ms cacheless vs 160
  and 122 ms with the page cache (same machine, `8939a61a` in a worktree).
- [x] HMR is over ~150 ms: user accepted it, no single-page reprocess path. See
  `plans/decisions/no-page-cache.md`.

## Task 6: One page processing function (after Task 5)

- [ ] Real pages, virtual pages, `processDeferredProviders` and `build-navigation-data.ts`
  share one page processing function instead of four copies. Pass when the duplicated
  enrichment bodies are gone and tests pass.

## Task 7: Inline imports as one transform (after Task 5)

- [ ] The inline import transform works on the page tree that `normalizeMdx` already
  parsed: it finds `.md`/`.mdx` imports, reads and parses them, splices them, recurses, and
  returns the files and image deps it touched for HMR. Delete the page pre-parse,
  `scanFile`/`scanMdast` duplication, `parsedNodes`, and the regex fast path.
- [ ] Pass when inline import tests and `mdx-imports` e2e pass, and editing an imported
  `.md` or its image still hot-updates the page.

## Task 8: Plain transform names

- [ ] The small `remark-*.ts` transforms (headings, code group, details toggle, GitHub
  callouts, mermaid, single accordion, sidebar components) live in one `mdx-transforms.ts`
  with one test file and no `remark` prefix. `remark-inline-imports.ts` becomes
  `inline-imports.ts`. `remark-test-utils.ts` and `test-mdx-util.ts` merge.
- [ ] Optional, only if Task 1 shows it matters: run the transforms in fewer tree walks.
  `visit` bodies are ~60% of `processMdx` CPU on polar.
- [ ] Pass when `rg -l remark vite/src` lists only mdastic/remark compat uses and tests pass.

## Task 9: Docs and changeset

- [ ] AGENTS.md ("Navigation tree as cache", MDX import caching paragraphs), website
  `deploy/build-output.mdx` and `create/broken-links.mdx`, and `vite/CHANGELOG`-bound
  changeset describe the cacheless pipeline. Changeset notes `pageCache` and `gitSha` are
  removed.

## Task 10: cli/ to mdastic (after the other agent commits `cli/`)

- [ ] `cli/src/diagram-fix.ts` and `cli/src/maintain.ts` parse with mdastic and remark
  packages leave `cli/package.json`. Pass when cli tests, including `diagram-fix.test.ts`
  inline snapshots, pass unchanged.

## Done

- [ ] `vite build` of realworld-polar and website succeed from a clean `dist/`, all e2e
  fixtures pass, and the baseline script shows no regression in request parse time.

Decisions: `plans/decisions/request-mdx-memoize.md`, `plans/decisions/no-page-cache.md`
