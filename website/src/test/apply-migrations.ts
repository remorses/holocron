// Vitest setup file (runs in workerd). Applies the D1 migrations to the test
// database before tests run. applyD1Migrations only applies migrations that
// haven't been applied yet, so it is safe to call repeatedly across files.
// TEST_MIGRATIONS is injected via miniflare bindings in vitest.config.ts.
import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
