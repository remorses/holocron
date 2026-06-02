/// <reference types="vitest/config" />
// Vitest config for the website worker. Runs tests INSIDE the Cloudflare
// Workers runtime (workerd) via @cloudflare/vitest-pool-workers so tests get
// a real D1 database, KV, and Durable Objects — exactly like production.
//
// This mirrors vite.config.ts (same holocron + strada + tailwind plugins so
// the app and its virtual modules resolve) but swaps the cloudflare() plugin
// for cloudflareTest(): both manage workerd and clash if used together.
//
// NOTE: do NOT set resolve.conditions here. The spiceflow/holocron plugins add
// the `spiceflow-vitest` condition (so page routes return SpiceflowTestResponse
// instead of an RSC Flight stream); overriding resolve.conditions clobbers it.
//
// We point at a minimal wrangler.test.jsonc (DB + KV + DOs only) instead of
// the production wrangler.jsonc, which references a service binding (OG_WORKER),
// send_email, ratelimits, and real resource IDs the test pool can't provide.
// Dummy secrets are injected via miniflare bindings so strada-ssr.ts and
// getAuth() don't crash at import time.
import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import tailwindcss from '@tailwindcss/vite'
import { holocron } from '@holocron.so/vite'
import { stradaVitePlugin } from '@strada.sh/sdk/vite'
import { defineConfig } from 'vite'

export default defineConfig(async () => {
  // D1 migrations live in the shared db package (flat .sql files).
  const migrations = await readD1Migrations(path.join(__dirname, '../db/drizzle'))

  return {
    clearScreen: false,
    plugins: [
      holocron({ entry: './src/server.tsx', pagesDir: 'src/pages' }),
      stradaVitePlugin(),
      tailwindcss(),
      cloudflareTest({
        wrangler: { configPath: './wrangler.test.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            // Read at import time by strada-ssr.ts and getAuth(). Dummy values
            // keep init from throwing; spans are never flushed in tests.
            STRADA_PROJECT_ID: 'test',
            STRADA_TOKEN: 'test',
            BETTER_AUTH_SECRET: 'test-better-auth-secret-at-least-32-chars!!',
            BETTER_AUTH_URL: 'http://localhost',
            GITHUB_CLIENT_ID: 'test',
            GITHUB_CLIENT_SECRET: 'test',
            STRIPE_SECRET_KEY: 'sk_test_dummy',
            STRIPE_WEBHOOK_SECRET: 'whsec_test_dummy',
          },
        },
      }),
    ],
    test: {
      setupFiles: ['./src/test/apply-migrations.ts'],
    },
  }
})
