// Tests for the sqlite-proxy D1 adapter (db/src/workerd.ts).
// Exercises all query patterns to verify the sqlite-proxy callbacks
// return rows in the correct format (positional arrays via raw(),
// d1ToRawRows conversion for batch, falsy get for empty results).
//
// Runs inside workerd via @cloudflare/vitest-pool-workers with a real
// D1 database, so these tests validate the actual production code path.
import { describe, test, expect, beforeEach } from 'vitest'
import * as orm from 'drizzle-orm'
import * as schema from 'db/schema'
import { getDb } from 'db'

describe('sqlite-proxy D1 adapter', () => {
  let db: ReturnType<typeof getDb>

  beforeEach(async () => {
    db = getDb()
    // Clean up test data from previous runs
    await db.delete(schema.orgMember).where(orm.like(schema.orgMember.orgId, 'test-%'))
    await db.delete(schema.project).where(orm.like(schema.project.orgId, 'test-%'))
    await db.delete(schema.org).where(orm.like(schema.org.id, 'test-%'))
    await db.delete(schema.user).where(orm.like(schema.user.email, '%@adapter-test.local'))
  })

  // ── findFirst — no results (the original #2721 crash) ────────────

  test('findFirst returns undefined when no rows match', async () => {
    const result = await db.query.user.findFirst({
      where: { email: 'nonexistent@adapter-test.local' },
    })
    expect(result).toBeUndefined()
  })

  // ── findMany — no results ────────────────────────────────────────

  test('findMany returns empty array when no rows match', async () => {
    const results = await db.query.user.findMany({
      where: { email: 'nonexistent@adapter-test.local' },
    })
    expect(results).toEqual([])
  })

  // ── insert + findFirst — single row ──────────────────────────────

  test('insert and findFirst returns the row with correct field values', async () => {
    const [inserted] = await db
      .insert(schema.user)
      .values({ id: 'test-user-1', name: 'Alice', email: 'alice@adapter-test.local' })
      .returning()

    const found = await db.query.user.findFirst({
      where: { id: 'test-user-1' },
    })

    expect(found).toBeDefined()
    expect(found!.id).toBe('test-user-1')
    expect(found!.name).toBe('Alice')
    expect(found!.email).toBe('alice@adapter-test.local')
    expect(found!.id).toBe(inserted.id)
  })

  // ── findMany — multiple rows ─────────────────────────────────────

  test('findMany returns all matching rows', async () => {
    await db.insert(schema.user).values([
      { id: 'test-user-a', name: 'A', email: 'a@adapter-test.local' },
      { id: 'test-user-b', name: 'B', email: 'b@adapter-test.local' },
      { id: 'test-user-c', name: 'C', email: 'c@adapter-test.local' },
    ])

    const results = await db.query.user.findMany({
      where: { email: { like: '%@adapter-test.local' } },
      orderBy: { name: 'asc' },
    })

    expect(results).toHaveLength(3)
    expect(results.map((r) => r.name)).toEqual(['A', 'B', 'C'])
  })

  // ── select (SQL builder) — verifies mapResultRow positional mapping ──

  test('db.select returns correct fields via positional array mapping', async () => {
    await db.insert(schema.user).values({
      id: 'test-user-select',
      name: 'SelectTest',
      email: 'select@adapter-test.local',
    })

    const rows = await db
      .select({ id: schema.user.id, name: schema.user.name })
      .from(schema.user)
      .where(orm.eq(schema.user.id, 'test-user-select'))

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('test-user-select')
    expect(rows[0].name).toBe('SelectTest')
  })

  // ── findFirst with relations (with:) ─────────────────────────────

  test('findFirst with relations returns nested objects', async () => {
    await db.insert(schema.user).values({
      id: 'test-user-rel',
      name: 'RelUser',
      email: 'rel@adapter-test.local',
    })
    await db.insert(schema.org).values({ id: 'test-org-rel', name: 'RelOrg' })
    await db.insert(schema.orgMember).values({
      orgId: 'test-org-rel',
      userId: 'test-user-rel',
      role: 'admin',
    })

    const member = await db.query.orgMember.findFirst({
      where: { userId: 'test-user-rel' },
      with: { org: true, user: true },
    })

    expect(member).toBeDefined()
    expect(member!.org.name).toBe('RelOrg')
    expect(member!.user.name).toBe('RelUser')
  })

  // ── db.batch — mixed queries ─────────────────────────────────────

  test('db.batch with findFirst + select works correctly', async () => {
    await db.insert(schema.user).values({
      id: 'test-user-batch',
      name: 'BatchUser',
      email: 'batch@adapter-test.local',
    })
    await db.insert(schema.org).values({ id: 'test-org-batch', name: 'BatchOrg' })

    const [foundUser, orgCount] = await db.batch([
      db.query.user.findFirst({
        where: { id: 'test-user-batch' },
      }),
      db
        .select({ count: orm.count() })
        .from(schema.org)
        .where(orm.eq(schema.org.id, 'test-org-batch')),
    ] as const)

    expect(foundUser).toBeDefined()
    expect(foundUser!.name).toBe('BatchUser')
    expect(orgCount[0].count).toBe(1)
  })

  // ── db.batch — findFirst with NO results (the #2721 bug) ─────────

  test('db.batch with findFirst returning no results does not crash', async () => {
    const [noResult, allOrgs] = await db.batch([
      db.query.user.findFirst({
        where: { id: 'nonexistent-id-12345' },
      }),
      db.query.org.findMany({
        where: { id: 'also-nonexistent' },
      }),
    ] as const)

    expect(noResult).toBeUndefined()
    expect(allOrgs).toEqual([])
  })

  // ── db.batch — findFirst with relations + no results ──────────────

  test('db.batch with relational findFirst returning no results', async () => {
    const [noMember] = await db.batch([
      db.query.orgMember.findFirst({
        where: { userId: 'ghost-user-xyz' },
        with: { org: true },
      }),
    ] as const)

    expect(noMember).toBeUndefined()
  })

  // ── db.batch — multiple inserts (atomicity) ──────────────────────

  test('db.batch inserts are atomic', async () => {
    await db.batch([
      db.insert(schema.user).values({
        id: 'test-user-atomic',
        name: 'Atomic',
        email: 'atomic@adapter-test.local',
      }),
      db.insert(schema.org).values({ id: 'test-org-atomic', name: 'AtomicOrg' }),
      db.insert(schema.orgMember).values({
        orgId: 'test-org-atomic',
        userId: 'test-user-atomic',
        role: 'admin',
      }),
    ] as const)

    const member = await db.query.orgMember.findFirst({
      where: { userId: 'test-user-atomic' },
      with: { org: true, user: true },
    })

    expect(member).toBeDefined()
    expect(member!.org.name).toBe('AtomicOrg')
    expect(member!.user.name).toBe('Atomic')
  })

  // ── update + returning ────────────────────────────────────────────

  test('update with returning works', async () => {
    await db.insert(schema.user).values({
      id: 'test-user-update',
      name: 'Before',
      email: 'update@adapter-test.local',
    })

    const [updated] = await db
      .update(schema.user)
      .set({ name: 'After' })
      .where(orm.eq(schema.user.id, 'test-user-update'))
      .limit(1)
      .returning()

    expect(updated.name).toBe('After')
    expect(updated.id).toBe('test-user-update')
  })

  // ── delete + returning ────────────────────────────────────────────

  test('delete with returning works', async () => {
    await db.insert(schema.user).values({
      id: 'test-user-delete',
      name: 'ToDelete',
      email: 'delete@adapter-test.local',
    })

    const [deleted] = await db
      .delete(schema.user)
      .where(orm.eq(schema.user.id, 'test-user-delete'))
      .limit(1)
      .returning()

    expect(deleted.id).toBe('test-user-delete')

    const gone = await db.query.user.findFirst({
      where: { id: 'test-user-delete' },
    })
    expect(gone).toBeUndefined()
  })

  // ── count aggregation ─────────────────────────────────────────────

  test('count aggregation returns correct number', async () => {
    await db.insert(schema.user).values([
      { id: 'test-user-cnt1', name: 'Cnt1', email: 'cnt1@adapter-test.local' },
      { id: 'test-user-cnt2', name: 'Cnt2', email: 'cnt2@adapter-test.local' },
    ])

    const [row] = await db
      .select({ count: orm.count() })
      .from(schema.user)
      .where(orm.like(schema.user.email, '%@adapter-test.local'))

    expect(row.count).toBe(2)
  })

  // ── db.batch — the exact deploy-api.ts pattern that was crashing ──

  test('batch with subscription findFirst (no match) + deployment count mirrors deploy-api.ts', async () => {
    // This is the exact pattern from deploy-api.ts that triggered #2721:
    // findFirst on subscription (no rows) + count on deployment, batched.
    await db.insert(schema.org).values({ id: 'test-org-deploy', name: 'DeployOrg' })
    await db.insert(schema.project).values({
      projectId: 'test-proj-deploy',
      orgId: 'test-org-deploy',
      name: 'DeployProject',
    })

    const [activeSubscription, deployCountRows] = await db.batch([
      db.query.subscription.findFirst({
        where: { projectId: 'test-proj-deploy', status: { in: ['active', 'trialing', 'past_due'] } },
      }),
      db
        .select({ count: orm.count() })
        .from(schema.deployment)
        .where(
          orm.and(
            orm.eq(schema.deployment.projectId, 'test-proj-deploy'),
            orm.eq(schema.deployment.status, 'active'),
            orm.eq(schema.deployment.preview, false),
          ),
        ),
    ] as const)

    expect(activeSubscription).toBeUndefined()
    expect(deployCountRows[0].count).toBe(0)
  })
})
