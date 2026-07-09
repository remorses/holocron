// Dashboard route tests: auth guards, loader execution, and cross-org isolation.
// Runs inside workerd via @cloudflare/vitest-pool-workers with a real D1.
//
// Under the workers test pool, page routes do NOT return SpiceflowTestResponse
// (the RSC render pipeline is not fully wired — see smoke.test.ts). So we use
// app.handle() directly to verify HTTP status codes: 200 means the auth guard
// passed, the loader ran without throwing, and the page rendered. Redirects
// (302/307) test auth rejection and access control. Loader data shapes are
// validated by TypeScript at compile time; here we exercise the runtime
// database queries and auth checks that produce them.
import { describe, test, expect } from 'vitest'
import { app } from './server.tsx'
import {
  seedUserWithSession,
  seedOrg,
  seedMembership,
  seedProject,
  seedApiKey,
  seedDeployment,
  seedSubscription,
  seedDomain,
  bearer,
} from './test/seed.ts'

/** Build a GET request with optional bearer auth. */
function get(path: string, token?: string): Request {
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  return new Request(`http://localhost${path}`, { headers })
}

/** Assert the response is a redirect (3xx). */
function expectRedirect(res: Response) {
  expect(res.status).toBeGreaterThanOrEqual(300)
  expect(res.status).toBeLessThan(400)
}

/** Assert the response rendered successfully (200). */
function expectOk(res: Response) {
  expect(res.status).toBe(200)
}

// ── Auth guards ─────────────────────────────────────────────────────

describe('dashboard auth guards', () => {
  test('unauthenticated GET /dashboard → redirect to /login', async () => {
    const res = await app.handle(get('/dashboard'))
    expectRedirect(res)
    expect(res.headers.get('location')).toContain('/login')
  })

  test('unauthenticated GET /dashboard/projects/:projectId → redirect to /login', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)

    const res = await app.handle(get(`/dashboard/projects/${projectId}`))
    expectRedirect(res)
    expect(res.headers.get('location')).toContain('/login')
  })

  test('unauthenticated GET /dashboard/projects/:projectId/keys → redirect to /login', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)

    const res = await app.handle(get(`/dashboard/projects/${projectId}/keys`))
    expectRedirect(res)
    expect(res.headers.get('location')).toContain('/login')
  })

  test('unauthenticated GET /dashboard/projects/:projectId/billing → redirect', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)

    const res = await app.handle(get(`/dashboard/projects/${projectId}/billing`))
    expectRedirect(res)
  })

  test('unauthenticated GET /dashboard/projects/:projectId/settings → redirect', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)

    const res = await app.handle(get(`/dashboard/projects/${projectId}/settings`))
    expectRedirect(res)
  })

  test('unauthenticated GET /dashboard/projects/:projectId/members → redirect', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)

    const res = await app.handle(get(`/dashboard/projects/${projectId}/members`))
    expectRedirect(res)
  })
})

// ── Dashboard index ─────────────────────────────────────────────────

describe('dashboard index', () => {
  test('user with a project → redirects to that project', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId, { name: 'My Docs' })

    const res = await app.handle(get('/dashboard', user.sessionToken))
    expectRedirect(res)
    expect(res.headers.get('location')).toContain(`/dashboard/projects/${projectId}`)
  })

  test('user with no projects → 200 (setup panel)', async () => {
    const user = await seedUserWithSession()
    await seedOrg(user.userId)

    const res = await app.handle(get('/dashboard', user.sessionToken))
    expectOk(res)
  })
})

// ── Project overview ────────────────────────────────────────────────

describe('project overview loader', () => {
  test('renders 200 for fresh project (no deployments)', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId, { name: 'Fresh Site' })

    const res = await app.handle(get(`/dashboard/projects/${projectId}`, user.sessionToken))
    expectOk(res)
  })

  test('renders 200 with seeded deployments', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId, { name: 'Deployed Site' })
    await seedDeployment(projectId, {
      status: 'active',
      branch: 'main',
      subdomain: 'my-docs-test',
      githubActor: 'remorses',
    })
    await seedDeployment(projectId, {
      status: 'superseded',
      branch: 'main',
      subdomain: 'my-docs-test',
    })

    const res = await app.handle(get(`/dashboard/projects/${projectId}`, user.sessionToken))
    expectOk(res)
  })

  test('renders 200 with active custom domains', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId, { name: 'Domain Site' })
    await seedDomain(projectId, { hostname: 'docs.example.com', status: 'active' })
    await seedDomain(projectId, { hostname: 'pending.example.com', status: 'pending' })

    const res = await app.handle(get(`/dashboard/projects/${projectId}`, user.sessionToken))
    expectOk(res)
  })

  test('non-member cannot access project → redirect to /dashboard', async () => {
    const owner = await seedUserWithSession()
    const orgId = await seedOrg(owner.userId)
    const projectId = await seedProject(orgId)

    const stranger = await seedUserWithSession()
    await seedOrg(stranger.userId)

    const res = await app.handle(get(`/dashboard/projects/${projectId}`, stranger.sessionToken))
    expectRedirect(res)
    expect(res.headers.get('location')).toBe('/dashboard')
  })

  test('non-existent projectId → redirect to /dashboard', async () => {
    const user = await seedUserWithSession()
    await seedOrg(user.userId)

    const res = await app.handle(get('/dashboard/projects/nonexistent-project-id', user.sessionToken))
    expectRedirect(res)
    expect(res.headers.get('location')).toBe('/dashboard')
  })
})

// ── Members tab ─────────────────────────────────────────────────────

describe('members tab loader', () => {
  test('renders 200 with admin and member in org', async () => {
    const admin = await seedUserWithSession({ name: 'Alice Admin' })
    const orgId = await seedOrg(admin.userId)
    const projectId = await seedProject(orgId, { name: 'Team Site' })

    const member = await seedUserWithSession({ name: 'Bob Member' })
    await seedMembership(orgId, member.userId, 'member')

    const res = await app.handle(get(`/dashboard/projects/${projectId}/members`, admin.sessionToken))
    expectOk(res)
  })

  test('member (non-admin) can also view members tab', async () => {
    const admin = await seedUserWithSession()
    const orgId = await seedOrg(admin.userId)
    const projectId = await seedProject(orgId)

    const member = await seedUserWithSession()
    await seedMembership(orgId, member.userId, 'member')

    const res = await app.handle(get(`/dashboard/projects/${projectId}/members`, member.sessionToken))
    expectOk(res)
  })
})

// ── Keys tab ────────────────────────────────────────────────────────

describe('keys tab loader', () => {
  test('renders 200 with no keys', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)

    const res = await app.handle(get(`/dashboard/projects/${projectId}/keys`, user.sessionToken))
    expectOk(res)
  })

  test('renders 200 with seeded API keys', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)
    await seedApiKey(orgId, projectId, { name: 'CI Deploy' })
    await seedApiKey(orgId, projectId, { name: 'Local Dev' })

    const res = await app.handle(get(`/dashboard/projects/${projectId}/keys`, user.sessionToken))
    expectOk(res)
  })
})

// ── Billing tab ─────────────────────────────────────────────────────

describe('billing tab loader', () => {
  test('renders 200 without subscription', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)

    const res = await app.handle(get(`/dashboard/projects/${projectId}/billing`, user.sessionToken))
    expectOk(res)
  })

  test('renders 200 with active subscription', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)
    await seedSubscription(orgId, projectId, { status: 'active', interval: 'year' })

    const res = await app.handle(get(`/dashboard/projects/${projectId}/billing`, user.sessionToken))
    expectOk(res)
  })
})

// ── Settings tab ────────────────────────────────────────────────────

describe('settings tab loader', () => {
  test('renders 200 with empty domains and no GSC', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId, { name: 'Settings Site' })

    const res = await app.handle(get(`/dashboard/projects/${projectId}/settings`, user.sessionToken))
    expectOk(res)
  })

  test('renders 200 with domains and subscription', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId, { name: 'Full Settings' })
    await seedDomain(projectId, { hostname: 'docs.fullsettings.com', status: 'active' })
    await seedSubscription(orgId, projectId, { status: 'active' })

    const res = await app.handle(get(`/dashboard/projects/${projectId}/settings`, user.sessionToken))
    expectOk(res)
  })
})

// ── Cross-org isolation ─────────────────────────────────────────────

describe('cross-org isolation', () => {
  test('user A cannot see user B project overview', async () => {
    const userA = await seedUserWithSession()
    await seedOrg(userA.userId)

    const userB = await seedUserWithSession()
    const orgB = await seedOrg(userB.userId)
    const projectB = await seedProject(orgB)

    const res = await app.handle(get(`/dashboard/projects/${projectB}`, userA.sessionToken))
    expectRedirect(res)
    expect(res.headers.get('location')).toBe('/dashboard')
  })

  test('user A cannot access user B keys tab', async () => {
    const userA = await seedUserWithSession()
    await seedOrg(userA.userId)

    const userB = await seedUserWithSession()
    const orgB = await seedOrg(userB.userId)
    const projectB = await seedProject(orgB)

    const res = await app.handle(get(`/dashboard/projects/${projectB}/keys`, userA.sessionToken))
    expectRedirect(res)
  })

  test('user A cannot access user B billing tab', async () => {
    const userA = await seedUserWithSession()
    await seedOrg(userA.userId)

    const userB = await seedUserWithSession()
    const orgB = await seedOrg(userB.userId)
    const projectB = await seedProject(orgB)

    const res = await app.handle(get(`/dashboard/projects/${projectB}/billing`, userA.sessionToken))
    expectRedirect(res)
  })

  test('user A cannot access user B settings tab', async () => {
    const userA = await seedUserWithSession()
    await seedOrg(userA.userId)

    const userB = await seedUserWithSession()
    const orgB = await seedOrg(userB.userId)
    const projectB = await seedProject(orgB)

    const res = await app.handle(get(`/dashboard/projects/${projectB}/settings`, userA.sessionToken))
    expectRedirect(res)
  })

  test('user A cannot access user B members tab', async () => {
    const userA = await seedUserWithSession()
    await seedOrg(userA.userId)

    const userB = await seedUserWithSession()
    const orgB = await seedOrg(userB.userId)
    const projectB = await seedProject(orgB)

    const res = await app.handle(get(`/dashboard/projects/${projectB}/members`, userA.sessionToken))
    expectRedirect(res)
  })
})

// ── Multi-org sidebar selection ─────────────────────────────────────

describe('multi-org sidebar', () => {
  test('user with multiple orgs can access projects in both', async () => {
    const user = await seedUserWithSession()
    const org1 = await seedOrg(user.userId, { name: 'Org One' })
    const project1 = await seedProject(org1, { name: 'Project One' })

    const otherUser = await seedUserWithSession()
    const org2 = await seedOrg(otherUser.userId, { name: 'Org Two' })
    await seedMembership(org2, user.userId, 'member')
    const project2 = await seedProject(org2, { name: 'Project Two' })

    // User can access project in org1
    const res1 = await app.handle(get(`/dashboard/projects/${project1}`, user.sessionToken))
    expectOk(res1)

    // User can access project in org2 (they're a member)
    const res2 = await app.handle(get(`/dashboard/projects/${project2}`, user.sessionToken))
    expectOk(res2)
  })
})

// ── Deploy page ─────────────────────────────────────────────────────

describe('deploy page', () => {
  test('authenticated user can access /dashboard/deploy', async () => {
    const user = await seedUserWithSession()
    await seedOrg(user.userId)

    const res = await app.handle(get('/dashboard/deploy', user.sessionToken))
    expectOk(res)
  })

  test('unauthenticated user cannot access /dashboard/deploy', async () => {
    const res = await app.handle(get('/dashboard/deploy'))
    expectRedirect(res)
    expect(res.headers.get('location')).toContain('/login')
  })
})
