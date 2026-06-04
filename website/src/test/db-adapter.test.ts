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

  // ── db.batch — findMany returning rows ────────────────────────────

  test('batch with findMany returning rows', async () => {
    await db.insert(schema.user).values([
      { id: 'test-user-bfm1', name: 'BatchFM1', email: 'bfm1@adapter-test.local' },
      { id: 'test-user-bfm2', name: 'BatchFM2', email: 'bfm2@adapter-test.local' },
    ])

    const [users] = await db.batch([
      db.query.user.findMany({
        where: { email: { like: '%@adapter-test.local' } },
        orderBy: { name: 'asc' },
      }),
    ] as const)

    expect(users.length).toBeGreaterThanOrEqual(2)
    expect(users[0].name < users[1].name).toBe(true)
  })

  // ── db.batch — findMany returning empty ───────────────────────────

  test('batch with findMany returning empty array', async () => {
    const [empty] = await db.batch([
      db.query.user.findMany({
        where: { email: 'no-one-has-this@adapter-test.local' },
      }),
    ] as const)

    expect(empty).toEqual([])
  })

  // ── db.batch — mixed findFirst: some match, some don't ────────────

  test('batch with multiple findFirst, some match some miss', async () => {
    await db.insert(schema.user).values({
      id: 'test-user-mix',
      name: 'MixUser',
      email: 'mix@adapter-test.local',
    })

    const [found, notFound, found2] = await db.batch([
      db.query.user.findFirst({ where: { id: 'test-user-mix' } }),
      db.query.user.findFirst({ where: { id: 'ghost-id-999' } }),
      db.query.user.findFirst({ where: { email: 'mix@adapter-test.local' } }),
    ] as const)

    expect(found).toBeDefined()
    expect(found!.name).toBe('MixUser')
    expect(notFound).toBeUndefined()
    expect(found2).toBeDefined()
    expect(found2!.id).toBe('test-user-mix')
  })

  // ── db.batch — findMany with orderBy ──────────────────────────────

  test('batch with findMany + orderBy preserves order', async () => {
    await db.insert(schema.user).values([
      { id: 'test-user-ord-z', name: 'Zara', email: 'zara@adapter-test.local' },
      { id: 'test-user-ord-a', name: 'Alice', email: 'alice-ord@adapter-test.local' },
      { id: 'test-user-ord-m', name: 'Mike', email: 'mike@adapter-test.local' },
    ])

    const [users] = await db.batch([
      db.query.user.findMany({
        where: { id: { like: 'test-user-ord-%' } },
        orderBy: { name: 'asc' },
      }),
    ] as const)

    expect(users.map((u) => u.name)).toEqual(['Alice', 'Mike', 'Zara'])
  })

  // ── db.batch — insert with returning ──────────────────────────────

  test('batch with insert returning', async () => {
    const [inserted] = await db.batch([
      db.insert(schema.user)
        .values({ id: 'test-user-bret', name: 'BatchRet', email: 'bret@adapter-test.local' })
        .returning(),
    ] as const)

    expect(inserted).toHaveLength(1)
    expect(inserted[0].id).toBe('test-user-bret')
    expect(inserted[0].name).toBe('BatchRet')
  })

  // ── orm.inArray filter ────────────────────────────────────────────

  test('orm.inArray in SQL builder query', async () => {
    await db.insert(schema.user).values([
      { id: 'test-user-in1', name: 'In1', email: 'in1@adapter-test.local' },
      { id: 'test-user-in2', name: 'In2', email: 'in2@adapter-test.local' },
      { id: 'test-user-in3', name: 'In3', email: 'in3@adapter-test.local' },
    ])

    const rows = await db
      .select({ id: schema.user.id, name: schema.user.name })
      .from(schema.user)
      .where(orm.inArray(schema.user.id, ['test-user-in1', 'test-user-in3']))
      .orderBy(schema.user.name)

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.name)).toEqual(['In1', 'In3'])
  })

  // ── db.batch — relational findFirst with results ──────────────────

  test('batch with relational findFirst that returns a row', async () => {
    await db.insert(schema.user).values({
      id: 'test-user-brel',
      name: 'BatchRel',
      email: 'brel@adapter-test.local',
    })
    await db.insert(schema.org).values({ id: 'test-org-brel', name: 'BatchRelOrg' })
    await db.insert(schema.orgMember).values({
      orgId: 'test-org-brel',
      userId: 'test-user-brel',
      role: 'admin',
    })

    const [member] = await db.batch([
      db.query.orgMember.findFirst({
        where: { userId: 'test-user-brel' },
        with: { org: true, user: true },
      }),
    ] as const)

    expect(member).toBeDefined()
    expect(member!.org.name).toBe('BatchRelOrg')
    expect(member!.user.name).toBe('BatchRel')
    expect(member!.role).toBe('admin')
  })

  // ── null column preservation ──────────────────────────────────────

  test('null column values are preserved through raw() path', async () => {
    // user.image is nullable, defaults to null
    await db.insert(schema.user).values({
      id: 'test-user-null',
      name: 'NullTest',
      email: 'null@adapter-test.local',
    })

    const found = await db.query.user.findFirst({
      where: { id: 'test-user-null' },
    })

    expect(found).toBeDefined()
    expect(found!.image).toBeNull()
    expect(found!.name).toBe('NullTest')
  })

  test('null values preserved in batch findFirst', async () => {
    await db.insert(schema.user).values({
      id: 'test-user-bnull',
      name: 'BatchNull',
      email: 'bnull@adapter-test.local',
    })

    const [found] = await db.batch([
      db.query.user.findFirst({ where: { id: 'test-user-bnull' } }),
    ] as const)

    expect(found).toBeDefined()
    expect(found!.image).toBeNull()
  })

  // ── computed/aliased columns with orm.sql ──────────────────────────

  test('computed columns with orm.sql template', async () => {
    await db.insert(schema.user).values({
      id: 'test-user-sql',
      name: 'SqlTest',
      email: 'sql@adapter-test.local',
    })

    const rows = await db
      .select({
        id: schema.user.id,
        upper: orm.sql<string>`upper(${schema.user.name})`,
        len: orm.sql<number>`length(${schema.user.email})`,
      })
      .from(schema.user)
      .where(orm.eq(schema.user.id, 'test-user-sql'))

    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('test-user-sql')
    expect(rows[0].upper).toBe('SQLTEST')
    expect(rows[0].len).toBe('sql@adapter-test.local'.length)
  })
})
