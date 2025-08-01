I am an engineer so be concise and clear in your answers without worrying about sensibility and feelings.

- object args are always preferred over positional args. for classes constructors always even if there is only 1 positional arg

- to run tests use `pnpm test`. all new tests should be made of match(result).toMatchInlineSnapshot(). prefer inline snapshots over custom expects. instead add comments with what the snapshot should contain if it is important or add sparingly some expect() if it is really important to check something specific.

- ALWAYS USE INLINE SNAPSHOTS. NEVER USE .toBe() or .toContain() or similar assertions for testing response data. ALWAYS use .toMatchInlineSnapshot() for ALL test assertions on response data. This is non-negotiable.

- never update inline snapshots yourself. run `pnpm test -u` instead

- if a snapshot is too long use `toMatchSnapshot()` instead of `toMatchInlineSnapshot()`. use `toMatchFileSnapshot()` if very large and if it makes sense to keep the extension to have them syntax highlighted in the editor.

- tests that upsert files should delete them at the end to not accumulate garbage


- do not use `pnpm changesets` for this package. instead add sections to a `CHANGELOG.md` file directly, using a bullet list. use the current time to separates changelog entries.

- always update CHANGELOG.md with the changes you made after you finish. on corrections, update the entry just made instead of adding new one. keep the changes bullet points as short as possible but no bullet points nesting, only one level.


- make sure that each files only do upserts once in one dataset only. to simplify the overall tests. the first test should do the upsert of the files, following tests can assume the files have been inserted already. add an afterAll that deletes the files. tests run serially in a file so you have assume order. if there are multiple upserts in a single test merge them into the first test instead

- after your changes deploy and run the tests with update snapshots enabled. then read again the test files diff and make sure the snapshots are what you expect

- if you want to create documentation markdown files put them in the `docs/` folder. do not use upper case names.

- tests that upsert to the production database MUST delete the upserted data in an `afterAll` block to not accumulate garbage in the production sqlite databases.

- all dataset ids used in tests should be different on each run to prevent issues with old sql schemas

- tests MUST delete the dataset and not the singular files
