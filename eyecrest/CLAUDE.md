- this is a cloudflare worker and durable objects that exposes an api to upsert and search on markdown files. it also automatically chunks them into sections. search is powered by FT5 and sqlite in durable objects sqlite storage

- never write sqlite migrations. let's instead just create always new datasets in the tests

- tests that upsert files should delete them at the end to not accumulate garbage

- authentication is implemented via asymmetric jwts. the jwt includes a orgId that identifies who owns the dataset. the jwt is generated in another service. this service is stateless on that respect.

- to deploy to cloudflare use `pnpm run deployment` (not pnpm deploy)

- do not use `pnpm changesets` for this package. instead add sections to a `CHANGELOG.md` file directly, using a bullet list. use the current time to separates changelog entries.

- before running the tests with `pnpm test` make sure to run `pnpm deployment` first to make sure the tests are using the deployed version of the worker.

- make sure that each files only do upserts once in one dataset only. to simplify the overall tests. the first test should do the upsert of the files, following tests can assume the files have been inserted already. add an afterAll that deletes the files. tests run serially in a file so you have assume order. if there are multiple upserts in a single test merge them into the first test instead.

- always update CHANGELOG.md with the changes you made after you finish. on corrections, update the entry just made instead of adding new one.

- after your changes deploy and run the tests with update snapshots enabled. then read again the test files diff and make sure the snapshots are what you expect
