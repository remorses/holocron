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
