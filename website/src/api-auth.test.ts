// API auth tests for the /api/v0/* management endpoints, running inside the
// Cloudflare Workers runtime (workerd) against a real D1 via
// @cloudflare/vitest-pool-workers.
//
// These cover the project-scoped API-key auth added in commit 1a4744c7:
// a holo_ key is a service principal pinned to ONE org + ONE project, and must
// never read or mutate another project's data — even within the same org.
// Session (bearer) auth retains full org access.
//
// Key ADMINISTRATION was later locked down in commit 97c8956c: creating,
// listing, and deleting keys now requires a signed-in ADMIN session. A holo_
// key can still read its own project (/projects, /me) and deploy, but it can
// no longer mint or delete keys — so a leaked deploy key can't become a
// persistence mechanism. These tests assert that boundary (key admin → 401).
//
// Requests go through the type-safe `createSpiceflowFetch(app)` client instead
// of raw `app.handle()` + Request. Paths, params, request bodies, AND the 200
// response shapes are all checked at compile time against the `app` type — so a
// route rename or a response-shape change breaks the test build. On success the
// client returns the parsed, fully-typed 200 body; on any non-2xx it returns a
// SpiceflowFetchError carrying `.status`, which is what the auth-failure
// assertions check via `expectError`.
import { describe, test, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:workers'
import { createSpiceflowFetch } from 'spiceflow/client'
import { app } from './server.tsx'
import {
  seedUserWithSession,
  seedOrg,
  seedMembership,
  seedProject,
  seedApiKey,
  bearer,
} from './test/seed.ts'

const f = createSpiceflowFetch(app)

// On any non-2xx response the typed fetch client returns a SpiceflowFetchError
// (an Error subclass with a numeric `.status`), so error assertions check
// `instanceof Error` + `.status`. The class itself is not re-exported from
// `spiceflow/client`, hence the structural check instead of an `instanceof`
// against the class.
function expectError(result: unknown, status: number): Error & { status: number } {
  expect(result).toBeInstanceOf(Error)
  const err = result as Error & { status: number }
  expect(err.status).toBe(status)
  return err
}

// Each test starts from an empty api_key table; user/org/project rows use
// fresh ULIDs so cross-test data never overlaps even without a full wipe.
beforeEach(async () => {
  await env.DB.prepare('DELETE FROM api_key').run()
})

describe('unauthenticated', () => {
  test('GET /api/v0/projects → 401', async () => {
    expectError(await f('/api/v0/projects'), 401)
  })
  test('GET /api/v0/keys → 401', async () => {
    expectError(await f('/api/v0/keys'), 401)
  })
  test('GET /api/v0/me → 401', async () => {
    expectError(await f('/api/v0/me'), 401)
  })
  test('a non-holo, non-session bearer token → 401', async () => {
    expectError(await f('/api/v0/projects', { headers: bearer('garbage') }), 401)
  })
})

describe('API key — project scoped', () => {
  test("GET /api/v0/projects returns only the key's own project", async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectA = await seedProject(orgId, { name: 'A' })
    await seedProject(orgId, { name: 'B' }) // sibling project in same org
    const key = await seedApiKey(orgId, projectA)

    const body = await f('/api/v0/projects', { headers: bearer(key.fullKey) })
    if (body instanceof Error) throw body
    expect(body.projects.map((p) => p.projectId)).toEqual([projectA])
  })

  test('GET /api/v0/keys is rejected for an API key (admin session only)', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectA = await seedProject(orgId)
    const keyA = await seedApiKey(orgId, projectA, { name: 'A key' })

    // Locked down in 97c8956c: enumerating keys needs an admin session, so a
    // leaked deploy key can't discover the org's other keys.
    expectError(await f('/api/v0/keys', { headers: bearer(keyA.fullKey) }), 401)
  })

  test('POST /api/v0/keys is rejected for an API key (no self-minting)', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectA = await seedProject(orgId)
    const key = await seedApiKey(orgId, projectA)

    // A leaked key must not mint replacement keys for persistence, even for
    // its own project. Key creation requires an admin session.
    expectError(
      await f('/api/v0/keys', {
        method: 'POST',
        body: { name: 'new', projectId: projectA },
        headers: bearer(key.fullKey),
      }),
      401,
    )
  })

  test('DELETE /api/v0/keys/:id is rejected for an API key (no self-deletion)', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectA = await seedProject(orgId)
    const projectB = await seedProject(orgId)
    const keyA = await seedApiKey(orgId, projectA)
    const keyB = await seedApiKey(orgId, projectB)

    expectError(
      await f('/api/v0/keys/:id', {
        method: 'DELETE',
        params: { id: keyB.keyId },
        headers: bearer(keyA.fullKey),
      }),
      401,
    )
    // keyB still exists — the API key could not delete it.
    const row = await env.DB.prepare('SELECT COUNT(*) as c FROM api_key WHERE id = ?')
      .bind(keyB.keyId)
      .first<{ c: number }>()
    expect(row!.c).toBe(1)
  })

  test('GET /api/v0/me returns null user + single project for a key', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectA = await seedProject(orgId)
    await seedProject(orgId) // sibling, must not appear
    const key = await seedApiKey(orgId, projectA)

    const body = await f('/api/v0/me', { headers: bearer(key.fullKey) })
    if (body instanceof Error) throw body
    expect(body.user).toBeNull()
    expect(body.orgs).toHaveLength(1)
    expect(body.orgs[0]!.id).toBe(orgId)
    expect(body.orgs[0]!.projects.map((p) => p.projectId)).toEqual([projectA])
  })

  test('POST /api/v0/projects with a key → 403 (no sibling-project creation)', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectA = await seedProject(orgId)
    const key = await seedApiKey(orgId, projectA)

    const result = await f('/api/v0/projects', {
      method: 'POST',
      body: { name: 'sneaky' },
      headers: bearer(key.fullKey),
    })
    expectError(result, 403)
  })

  test("a key cannot see another org's project", async () => {
    const user1 = await seedUserWithSession()
    const org1 = await seedOrg(user1.userId)
    const project1 = await seedProject(org1)
    const key1 = await seedApiKey(org1, project1)

    const user2 = await seedUserWithSession()
    const org2 = await seedOrg(user2.userId)
    await seedProject(org2)

    const body = await f('/api/v0/projects', { headers: bearer(key1.fullKey) })
    if (body instanceof Error) throw body
    expect(body.projects.map((p) => p.projectId)).toEqual([project1])
  })

  test('revoked key stops working immediately (not cached)', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectA = await seedProject(orgId)
    const key = await seedApiKey(orgId, projectA)

    const ok = await f('/api/v0/projects', { headers: bearer(key.fullKey) })
    expect(ok).not.toBeInstanceOf(Error)

    await env.DB.prepare('DELETE FROM api_key WHERE id = ?').bind(key.keyId).run()
    expectError(await f('/api/v0/projects', { headers: bearer(key.fullKey) }), 401)
  })
})

describe('session auth — full org access', () => {
  test('GET /api/v0/projects returns every project in the org', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectA = await seedProject(orgId)
    const projectB = await seedProject(orgId)

    const body = await f('/api/v0/projects', { headers: bearer(user.sessionToken) })
    if (body instanceof Error) throw body
    expect(body.projects.map((p) => p.projectId).sort()).toEqual([projectA, projectB].sort())
  })

  test('GET /api/v0/me returns the real user identity', async () => {
    const user = await seedUserWithSession()
    await seedOrg(user.userId)

    const body = await f('/api/v0/me', { headers: bearer(user.sessionToken) })
    if (body instanceof Error) throw body
    expect(body.user?.email).toBe(user.email)
  })

  test('POST /api/v0/projects creates a project', async () => {
    const user = await seedUserWithSession()
    await seedOrg(user.userId)

    const body = await f('/api/v0/projects', {
      method: 'POST',
      body: { name: 'made-by-session' },
      headers: bearer(user.sessionToken),
    })
    if (body instanceof Error) throw body
    expect(body.name).toBe('made-by-session')
    expect(body.projectId).toBeTruthy()
  })

  test('admin session can create, list, and delete API keys', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectA = await seedProject(orgId)

    const created = await f('/api/v0/keys', {
      method: 'POST',
      body: { name: 'ci', projectId: projectA },
      headers: bearer(user.sessionToken),
    })
    if (created instanceof Error) throw created
    expect(created.key.startsWith('holo_')).toBe(true)

    const listed = await f('/api/v0/keys', { headers: bearer(user.sessionToken) })
    if (listed instanceof Error) throw listed
    expect(listed.keys.map((k) => k.name)).toContain('ci')

    const deleted = await f('/api/v0/keys/:id', {
      method: 'DELETE',
      params: { id: created.id },
      headers: bearer(user.sessionToken),
    })
    if (deleted instanceof Error) throw deleted
    expect(deleted.deleted).toBe(true)
  })

  test('non-admin member session cannot manage keys (403)', async () => {
    const admin = await seedUserWithSession()
    const orgId = await seedOrg(admin.userId)
    const projectA = await seedProject(orgId)

    const member = await seedUserWithSession()
    await seedMembership(orgId, member.userId, 'member')

    expectError(
      await f('/api/v0/keys', {
        method: 'POST',
        body: { name: 'nope', projectId: projectA },
        headers: bearer(member.sessionToken),
      }),
      403,
    )
  })
})
