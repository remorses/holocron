// Type augmentation for the test-only TEST_MIGRATIONS binding injected via
// miniflare config in vitest.config.ts. D1Migration comes from
// @cloudflare/vitest-pool-workers/types (added to tsconfig types).
declare namespace Cloudflare {
  interface Env {
    TEST_MIGRATIONS: D1Migration[]
  }
}
