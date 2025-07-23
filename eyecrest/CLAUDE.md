I am an engineer so be concise and clear in your answers without worrying about sensibility and feelings.

- object args are always preferred over positional args. for classes constructors always even if there is only 1 positional arg

- this is a cloudflare worker and durable objects that exposes an api to upsert and search on markdown files. it also automatically chunks them into sections. search is powered by FT5 and sqlite in durable objects sqlite storage

- to run tests use `pnpm test`. all new tests should be made of match(result).toMatchInlineSnapshot(). prefer inline snapshots over custom expects. instead add comments with what the snapshot should contain if it is important or add sparingly some expect() if it is really important to check something specific.

- ALWAYS USE INLINE SNAPSHOTS. NEVER USE .toBe() or .toContain() or similar assertions for testing response data. ALWAYS use .toMatchInlineSnapshot() for ALL test assertions on response data. This is non-negotiable.

- never update inline snapshots yourself. run `pnpm test -u` instead

- if a snapshot is too long use `toMatchSnapshot()` instead of `toMatchInlineSnapshot()`. use `toMatchFileSnapshot()` if very large and if it makes sense to keep the extension to have them syntax highlighted in the editor.

- never write sqlite migrations. let's instead just create always new datasets in the tests

- tests that upsert files should delete them at the end to not accumulate garbage

- authentication is implemented via asymmetric jwts. the jwt includes a orgId that identifies who owns the dataset. the jwt is generated in another service. this service is stateless on that respect.

- to deploy to cloudflare use `pnpm run deployment` (not pnpm deploy)

- do not use `pnpm changesets` for this package. instead add sections to a `CHANGELOG.md` file directly, using a bullet list. use the current time to separates changelog entries.

- always update CHANGELOG.md with the changes you made after you finish. on corrections, update the entry just made instead of adding new one. keep the changes bullet points as short as possible but no bullet points nesting, only one level.

- before running the tests with `pnpm test` make sure to run `pnpm deployment` first to make sure the tests are using the deployed version of the worker.

- make sure that each files only do upserts once in one dataset only. to simplify the overall tests. the first test should do the upsert of the files, following tests can assume the files have been inserted already. add an afterAll that deletes the files. tests run serially in a file so you have assume order. if there are multiple upserts in a single test merge them into the first test instead

- after your changes deploy and run the tests with update snapshots enabled. then read again the test files diff and make sure the snapshots are what you expect

- if you want to create documentation markdown files put them in the `docs/` folder. do not use upper case names.

- tests that upsert to the production worker MUST delete the upserted data in an `afterAll` block to not accumulate garbage in the production sqlite databases.

- all dataset ids used in tests should be different on each run to prevent issues with old sql schemas

- tests MUST delete the dataset and not the singular files

- for fire and forget operations in ALWAYS use `this.state.waitUntil` (remember to set `this.state = state` in constructor), do not call the promise without await. use waitUntil instead.

- IMPORTANT: some test files must be run atomically (the entire file) and not with the -t flag for individual tests. Some tests depend on data uploaded in previous tests within the same file. Specifically:
  - `production.test.ts` - tests like "should search across file sections" depend on files uploaded in "should upload all test files including frontmatter and weights"
  - `sdk.test.ts` - tests like "should get file with line numbers" depend on files uploaded in "should upload and search files"
  - These test files are designed to run sequentially with tests building on each other
