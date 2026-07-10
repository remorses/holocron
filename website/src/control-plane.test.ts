// Control-plane API tests: org-scoped keys, custom subdomains, partner plan.
// Runs inside workerd against real D1 (same pool as api-auth.test.ts).
import { describe, test, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:workers'
import { createSpiceflowFetch } from 'spiceflow/client'
import { ulid } from 'ulid'
import { app } from './server.tsx'
import {
  seedUserWithSession,
  seedOrg,
  seedProject,
  seedApiKey,
  seedOrgApiKey,
  seedMembership,
  bearer,
} from './test/seed.ts'
import {
  resolveProjectSubdomain,
  validateCustomSubdomain,
  RESERVED_SUBDOMAINS,
} from './deploy-auth.ts'

const f = createSpiceflowFetch(app)

function expectError(result: unknown, status: number): Error & { status: number } {
  expect(result).toBeInstanceOf(Error)
  const err = result as Error & { status: number }
  expect(err.status).toBe(status)
  return err
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM api_key').run()
  await env.DB.prepare('DELETE FROM deployment').run()
  await env.DB.prepare('DELETE FROM project').run()
})

describe('resolveProjectSubdomain', () => {
  test('prefers stored custom subdomain', () => {
    expect(resolveProjectSubdomain({
      projectId: '01ABC',
      subdomain: 'acme-docs',
    })).toBe('acme-docs')
  })

  test('falls back to projectId when unset', () => {
    expect(resolveProjectSubdomain({
      projectId: '01ABC',
      subdomain: null,
    })).toBe('01abc')
  })

  test('falls back to github slug when unset', () => {
    expect(resolveProjectSubdomain({
      projectId: '01ABC',
      githubOwner: 'remorses',
      githubRepo: 'my-docs',
      subdomain: null,
    })).toBe('my-docs-remorses')
  })
})

describe('validateCustomSubdomain', () => {
  test('accepts valid slug', () => {
    expect(validateCustomSubdomain('Acme Docs!')).toBe('acme-docs')
  })

  test('rejects reserved names', () => {
    for (const name of ['www', 'api', 'holocron', 'docs']) {
      expect(RESERVED_SUBDOMAINS.has(name)).toBe(true)
      try {
        validateCustomSubdomain(name)
        expect.unreachable()
      } catch {
        // spiceflow json Response throw
      }
    }
  })

  test('rejects too short after sanitize', () => {
    try {
      validateCustomSubdomain('ab')
      expect.unreachable()
    } catch {
      // expected
    }
  })
})

describe('org-scoped API keys', () => {
  test('admin session can create an org key', async () => {
    const user = await seedUserWithSession()
    await seedOrg(user.userId)

    const created = await f('/api/v0/keys', {
      method: 'POST',
      body: { name: 'notaku-control', scope: 'org' },
      headers: bearer(user.sessionToken),
    })
    if (created instanceof Error) throw created
    expect(created.scope).toBe('org')
    expect(created.projectId).toBeNull()
    expect(created.key.startsWith('holo_')).toBe(true)
  })

  test('org key can create a project with custom subdomain', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId, { plan: 'partner' })
    const orgKey = await seedOrgApiKey(orgId)

    const created = await f('/api/v0/projects', {
      method: 'POST',
      body: {
        name: 'Acme Docs',
        subdomain: 'acme-docs',
        source: 'notaku',
        externalId: 'site_123',
      },
      headers: bearer(orgKey.fullKey),
    })
    if (created instanceof Error) throw created
    expect(created.name).toBe('Acme Docs')
    expect(created.subdomain).toBe('acme-docs')
    expect(created.source).toBe('notaku')
    expect(created.externalId).toBe('site_123')
    expect(created.orgId).toBe(orgId)
  })

  test('project key still cannot create projects', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectA = await seedProject(orgId)
    const key = await seedApiKey(orgId, projectA)

    expectError(
      await f('/api/v0/projects', {
        method: 'POST',
        body: { name: 'sneaky', subdomain: 'sneaky-docs' },
        headers: bearer(key.fullKey),
      }),
      403,
    )
  })

  test('org key can mint a project key', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectA = await seedProject(orgId)
    const orgKey = await seedOrgApiKey(orgId)

    const created = await f('/api/v0/keys', {
      method: 'POST',
      body: { name: 'deploy', projectId: projectA, scope: 'project' },
      headers: bearer(orgKey.fullKey),
    })
    if (created instanceof Error) throw created
    expect(created.scope).toBe('project')
    expect(created.projectId).toBe(projectA)
    expect(created.key.startsWith('holo_')).toBe(true)
  })

  test('org key cannot mint another org key', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const orgKey = await seedOrgApiKey(orgId)

    // scope=org requires session admin — org key path hits requireAdminSessionForOrg → 401
    expectError(
      await f('/api/v0/keys', {
        method: 'POST',
        body: { name: 'another-org-key', scope: 'org' },
        headers: bearer(orgKey.fullKey),
      }),
      401,
    )
  })

  test('org key lists all projects in its org', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const a = await seedProject(orgId, { name: 'A' })
    const b = await seedProject(orgId, { name: 'B' })
    const orgKey = await seedOrgApiKey(orgId)

    const body = await f('/api/v0/projects', { headers: bearer(orgKey.fullKey) })
    if (body instanceof Error) throw body
    expect(body.projects.map((p) => p.projectId).sort()).toEqual([a, b].sort())
  })

  test('org key cannot create project in another org via orgId body', async () => {
    const user1 = await seedUserWithSession()
    const org1 = await seedOrg(user1.userId)
    const orgKey = await seedOrgApiKey(org1)

    const user2 = await seedUserWithSession()
    const org2 = await seedOrg(user2.userId)

    expectError(
      await f('/api/v0/projects', {
        method: 'POST',
        body: { name: 'hijack', orgId: org2 },
        headers: bearer(orgKey.fullKey),
      }),
      403,
    )
  })

  test('admin can mint org key for a non-default org via orgId', async () => {
    const user = await seedUserWithSession()
    const defaultOrg = await seedOrg(user.userId, { name: 'default' })
    // Second org the same admin also owns (partner control plane).
    const partnerOrg = ulid()
    await env.DB.prepare('INSERT INTO org (id, name, plan, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(partnerOrg, 'partner', 'partner', Date.now(), Date.now())
      .run()
    await seedMembership(partnerOrg, user.userId, 'admin')

    const created = await f('/api/v0/keys', {
      method: 'POST',
      body: { name: 'partner-cp', scope: 'org', orgId: partnerOrg },
      headers: bearer(user.sessionToken),
    })
    if (created instanceof Error) throw created
    expect(created.scope).toBe('org')

    // Key must be stored under partner org, not default
    const row = await env.DB.prepare('SELECT org_id FROM api_key WHERE id = ?')
      .bind(created.id)
      .first<{ org_id: string }>()
    expect(row!.org_id).toBe(partnerOrg)
    expect(row!.org_id).not.toBe(defaultOrg)
  })

  test('org key is rejected on AI chat', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const orgKey = await seedOrgApiKey(orgId)

    expectError(
      await f('/api/chat', {
        method: 'POST',
        body: {
          messages: [{ role: 'user', content: 'hi' }],
          docsPages: { 'index.mdx': '# hi' },
        },
        headers: bearer(orgKey.fullKey),
      }),
      403,
    )
  })

  test('org key cannot create a deployment', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)
    const orgKey = await seedOrgApiKey(orgId)

    expectError(
      await f('/api/v0/deployments', {
        method: 'POST',
        body: {
          projectId,
          files: [{ path: 'worker/ssr/index.js', hash: 'a'.repeat(64) }],
        },
        headers: bearer(orgKey.fullKey),
      }),
      403,
    )
  })

  test('org key cannot add a domain', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId, { plan: 'partner' })
    const projectId = await seedProject(orgId)
    const orgKey = await seedOrgApiKey(orgId)

    expectError(
      await f('/api/v0/domains', {
        method: 'POST',
        body: { projectId, hostname: 'docs.example.com' },
        headers: bearer(orgKey.fullKey),
      }),
      403,
    )
  })
})

describe('custom subdomain', () => {
  test('session create with subdomain', async () => {
    const user = await seedUserWithSession()
    await seedOrg(user.userId)

    const body = await f('/api/v0/projects', {
      method: 'POST',
      body: { name: 'Site', subdomain: 'my-cool-docs' },
      headers: bearer(user.sessionToken),
    })
    if (body instanceof Error) throw body
    expect(body.subdomain).toBe('my-cool-docs')
  })

  test('duplicate subdomain → 409', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    await seedProject(orgId, { subdomain: 'taken-slug' })

    expectError(
      await f('/api/v0/projects', {
        method: 'POST',
        body: { name: 'Other', subdomain: 'taken-slug' },
        headers: bearer(user.sessionToken),
      }),
      409,
    )
  })

  test('duplicate externalId in same org → 409', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    await seedProject(orgId, { externalId: 'ext_1' })

    expectError(
      await f('/api/v0/projects', {
        method: 'POST',
        body: { name: 'Dup', externalId: 'ext_1' },
        headers: bearer(user.sessionToken),
      }),
      409,
    )
  })
})
