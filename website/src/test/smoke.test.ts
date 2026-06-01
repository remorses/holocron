// Smoke test: verifies the workers test pool boots, the app imports cleanly
// (including strada-ssr init under workerd — this is what used to crash with
// the protobufjs ReferenceError before @strada.sh/otlp-json), and D1 is
// migrated. If this fails, the harness is broken before any auth test runs.
//
// Page (RSC) routes are NOT asserted here: under @cloudflare/vitest-pool-workers
// the RSC render pipeline does not fully wire HTML output through app.handle(),
// so full page rendering is covered by the integration-tests package (real Vite
// servers + Playwright) instead. The workers pool is used here only for the D1-
// backed JSON API routes, which is exactly what the API auth tests need.
import { describe, test, expect } from 'vitest'
import { env } from 'cloudflare:workers'
import { createSpiceflowFetch } from 'spiceflow/client'
import { app } from '../server.tsx'

const f = createSpiceflowFetch(app)

describe('test harness', () => {
  test('D1 is migrated — api_key table exists and is empty', async () => {
    const row = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM api_key',
    ).first<{ count: number }>()
    expect(row!.count).toBe(0)
  })

  test('unauthenticated GET /api/v0/projects returns 401', async () => {
    const result = await f('/api/v0/projects')
    expect(result).toBeInstanceOf(Error)
    expect((result as Error & { status: number }).status).toBe(401)
  })
})
