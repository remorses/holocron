import { describe, expect, test, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { processVirtualTabs } from '../virtual-tab-provider.ts'
import { openapiProvider } from './provider.ts'
import type { ConfigNavTab } from '../../config.ts'

const SPEC = `
openapi: "3.0.3"
info:
  title: Test API
  version: "1.0.0"
tags:
  - name: users
  - name: auth
paths:
  /auth/login:
    post:
      tags: [auth]
      summary: Login
      responses:
        "200": { description: ok }
  /users:
    get:
      tags: [users]
      summary: List users
      responses:
        "200": { description: ok }
    post:
      tags: [users]
      summary: Create user
      responses:
        "200": { description: ok }
`

let dir: string

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-openapi-'))
  fs.writeFileSync(path.join(dir, 'api.yaml'), SPEC)
})

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

/** Collect every page slug (string entries) from a tab's groups, recursively,
 *  alongside the group names — a structural fingerprint for comparison. */
function fingerprint(tab: ConfigNavTab): string {
  const walkGroup = (g: { group: string; pages: unknown[] }): unknown => ({
    group: g.group,
    pages: g.pages.map((p) =>
      typeof p === 'string' ? p : walkGroup(p as { group: string; pages: unknown[] }),
    ),
  })
  return JSON.stringify(tab.groups.map((g) => walkGroup(g as any)))
}

describe('openapi provider — selective mode', () => {
  test('expands "..." and resolves endpoint refs once', async () => {
    const config = {
      navigation: {
        tabs: [
          {
            tab: 'API',
            openapi: 'api.yaml',
            groups: [
              { group: '', pages: ['intro', 'POST /auth/login', '...'] },
            ],
          } as ConfigNavTab,
        ],
      },
    }
    const mdxContent: Record<string, string> = {}
    await processVirtualTabs({
      config,
      projectRoot: dir,
      pagesDir: dir,
      mdxContent,
      providers: [openapiProvider],
    })

    // intro stays an MDX slug; the explicit ref + "..." become endpoint pages.
    // The "..." tag groups are hoisted to TOP-LEVEL siblings (always-visible
    // sidebar sections), not nested inside the synthetic wrapper group.
    expect(fingerprint(config.navigation.tabs[0]!)).toMatchInlineSnapshot(
      `"[{"group":"","pages":["intro","api/post-auth-login"]},{"group":"Users","pages":["api/get-users","api/post-users"]}]"`,
    )
    // Virtual MDX emitted for every referenced/expanded endpoint, not for intro.
    expect(Object.keys(mdxContent).sort()).toMatchInlineSnapshot(`
      [
        "api/get-users",
        "api/post-auth-login",
        "api/post-users",
      ]
    `)
  })

  test('"..." expands to TOP-LEVEL groups, not nested sub-groups', async () => {
    const config = {
      navigation: {
        tabs: [
          {
            tab: 'API',
            openapi: 'api.yaml',
            groups: [{ group: '', pages: ['intro', '...'] }],
          } as ConfigNavTab,
        ],
      },
    }
    const mdxContent: Record<string, string> = {}
    await processVirtualTabs({
      config,
      projectRoot: dir,
      pagesDir: dir,
      mdxContent,
      providers: [openapiProvider],
    })
    const groups = config.navigation.tabs[0]!.groups
    // Expect: the intro wrapper group + one top-level group per tag (auth, Users).
    expect(groups.map((g) => g.group)).toMatchInlineSnapshot(`
      [
        "",
        "Auth",
        "Users",
      ]
    `)
    // None of the tag groups should be nested inside the intro wrapper.
    const introGroup = groups[0]!
    expect(introGroup.pages.every((p) => typeof p === 'string')).toBe(true)
  })

  test('emits titled fences as tabs for multiple named examples', async () => {
    const SPEC_EX = `
openapi: "3.0.3"
info: { title: Ex API, version: "1.0.0" }
tags: [{ name: orders }]
paths:
  /orders:
    post:
      tags: [orders]
      summary: Create order
      requestBody:
        content:
          application/json:
            examples:
              Single item: { value: { items: [{ id: "a" }] } }
              Multiple items: { value: { items: [{ id: "a" }, { id: "b" }] } }
      responses:
        "201":
          description: created
          content:
            application/json:
              examples:
                Confirmed: { value: { id: "order-1" } }
                Empty: { value: { id: "order-2", items: [] } }
`
    const exDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-openapi-ex-'))
    fs.writeFileSync(path.join(exDir, 'api.yaml'), SPEC_EX)
    try {
      const config = {
        navigation: {
          tabs: [{ tab: 'API', openapi: 'api.yaml', groups: [{ group: '', pages: ['...'] }] } as ConfigNavTab],
        },
      }
      const mdxContent: Record<string, string> = {}
      await processVirtualTabs({
        config,
        projectRoot: exDir,
        pagesDir: exDir,
        mdxContent,
        providers: [openapiProvider],
      })
      const mdx = mdxContent['api/post-orders']
      expect(mdx).toBeDefined()
      // RequestExample/ResponseExample render titled fences as tabs themselves,
      // so there is no <CodeGroup> wrapper (that would double-frame the panel).
      expect(mdx).not.toContain('<CodeGroup>')
      // The curl block is the first request tab.
      expect(mdx).toContain('title="cURL"')
      expect(mdx).toContain('title="Single item"')
      expect(mdx).toContain('title="Multiple items"')
      expect(mdx).toContain('title="Confirmed"')
      expect(mdx).toContain('title="Empty"')
      // Line numbers are disabled inside the example panels.
      expect(mdx).toContain('lines=false')
      // Both response payloads are present, not just the first.
      expect(mdx).toContain('order-1')
      expect(mdx).toContain('order-2')
    } finally {
      fs.rmSync(exDir, { recursive: true, force: true })
    }
  })

  test('skips externalValue-only examples and escapes fence titles', async () => {
    const SPEC_EX = `
openapi: "3.0.3"
info: { title: Ex API, version: "1.0.0" }
tags: [{ name: orders }]
paths:
  /orders:
    post:
      tags: [orders]
      summary: Create order
      responses:
        "201":
          description: created
          content:
            application/json:
              examples:
                "weird \`name\`":
                  value: { id: "inline-1" }
                External only:
                  externalValue: "https://example.com/big.json"
`
    const exDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-openapi-ext-'))
    fs.writeFileSync(path.join(exDir, 'api.yaml'), SPEC_EX)
    try {
      const config = {
        navigation: {
          tabs: [{ tab: 'API', openapi: 'api.yaml', groups: [{ group: '', pages: ['...'] }] } as ConfigNavTab],
        },
      }
      const mdxContent: Record<string, string> = {}
      await processVirtualTabs({
        config,
        projectRoot: exDir,
        pagesDir: exDir,
        mdxContent,
        providers: [openapiProvider],
      })
      const mdx = mdxContent['api/post-orders']
      expect(mdx).toBeDefined()
      // The inline example renders; backticks in the name are neutralized so
      // the fence info line stays valid.
      expect(mdx).toContain('inline-1')
      expect(mdx).toContain("title=\"weird 'name'\"")
      // The externalValue-only entry must NOT be rendered as a JSON payload.
      expect(mdx).not.toContain('externalValue')
      expect(mdx).not.toContain('big.json')
      expect(mdx).not.toContain('title="External only"')
    } finally {
      fs.rmSync(exDir, { recursive: true, force: true })
    }
  })

  test('shows all response statuses with examples, prefixed by status code', async () => {
    const SPEC_MULTI = `
openapi: "3.0.3"
info: { title: Multi API, version: "1.0.0" }
tags: [{ name: items }]
paths:
  /items:
    post:
      tags: [items]
      summary: Create item
      responses:
        "201":
          description: Created
          content:
            application/json:
              examples:
                Success A: { value: { id: "item_1", name: "A" } }
                Success B: { value: { id: "item_2", name: "B" } }
        "401":
          description: Unauthorized
          content:
            application/json:
              examples:
                No token: { value: { code: "unauthorized", message: "Missing token" } }
                Bad token: { value: { code: "unauthorized", message: "Invalid token" } }
        "204":
          description: No Content
`
    const exDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-openapi-multi-'))
    fs.writeFileSync(path.join(exDir, 'api.yaml'), SPEC_MULTI)
    try {
      const config = {
        navigation: {
          tabs: [{ tab: 'API', openapi: 'api.yaml', groups: [{ group: '', pages: ['...'] }] } as ConfigNavTab],
        },
      }
      const mdxContent: Record<string, string> = {}
      await processVirtualTabs({
        config,
        projectRoot: exDir,
        pagesDir: exDir,
        mdxContent,
        providers: [openapiProvider],
      })
      const mdx = mdxContent['api/post-items']
      expect(mdx).toBeDefined()
      // Both 201 and 401 examples should be present
      expect(mdx).toContain('item_1')
      expect(mdx).toContain('item_2')
      expect(mdx).toContain('Missing token')
      expect(mdx).toContain('Invalid token')
      // Tab titles should be prefixed with status code since multiple statuses
      expect(mdx).toContain('title="201 — Success A"')
      expect(mdx).toContain('title="201 — Success B"')
      expect(mdx).toContain('title="401 — No token"')
      expect(mdx).toContain('title="401 — Bad token"')
      // 204 has no examples, so no 204 tab title in the ResponseExample
      expect(mdx).not.toContain('title="204')
    } finally {
      fs.rmSync(exDir, { recursive: true, force: true })
    }
  })

  test('single-status response examples have no status prefix', async () => {
    const SPEC_SINGLE = `
openapi: "3.0.3"
info: { title: Single API, version: "1.0.0" }
tags: [{ name: orders }]
paths:
  /orders:
    get:
      tags: [orders]
      summary: List orders
      responses:
        "200":
          description: ok
          content:
            application/json:
              examples:
                Page 1: { value: { orders: [{ id: "a" }] } }
                Empty: { value: { orders: [] } }
        "500":
          description: Internal error
`
    const exDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-openapi-single-'))
    fs.writeFileSync(path.join(exDir, 'api.yaml'), SPEC_SINGLE)
    try {
      const config = {
        navigation: {
          tabs: [{ tab: 'API', openapi: 'api.yaml', groups: [{ group: '', pages: ['...'] }] } as ConfigNavTab],
        },
      }
      const mdxContent: Record<string, string> = {}
      await processVirtualTabs({
        config,
        projectRoot: exDir,
        pagesDir: exDir,
        mdxContent,
        providers: [openapiProvider],
      })
      const mdx = mdxContent['api/get-orders']
      expect(mdx).toBeDefined()
      // Only one status has examples, so no status prefix
      expect(mdx).toContain('title="Page 1"')
      expect(mdx).toContain('title="Empty"')
      expect(mdx).not.toContain('200 —')
    } finally {
      fs.rmSync(exDir, { recursive: true, force: true })
    }
  })

  test('is idempotent across re-syncs (dev-server HMR regression)', async () => {
    // The config object persists across dev-server re-syncs and the provider
    // mutates tab.groups in place. Running twice on the SAME config must yield
    // identical results — otherwise the second pass loses "..." / endpoint refs
    // and the expanded slugs end up with no virtual MDX ("MDX file not found").
    const config = {
      navigation: {
        tabs: [
          {
            tab: 'API',
            openapi: 'api.yaml',
            groups: [
              { group: '', pages: ['intro', 'POST /auth/login', '...'] },
            ],
          } as ConfigNavTab,
        ],
      },
    }

    const run = async () => {
      const mdxContent: Record<string, string> = {}
      await processVirtualTabs({
        config,
        projectRoot: dir,
        pagesDir: dir,
        mdxContent,
        providers: [openapiProvider],
      })
      return { groups: fingerprint(config.navigation.tabs[0]!), mdx: Object.keys(mdxContent).sort() }
    }

    const first = await run()
    const second = await run()
    expect(second.groups).toBe(first.groups)
    expect(second.mdx).toEqual(first.mdx)
    // And the expanded endpoint slugs must always have backing MDX content.
    expect(second.mdx).toContain('api/post-auth-login')
    expect(second.mdx).toContain('api/get-users')
  })
})
