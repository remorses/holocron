/**
 * OpenAPI fixture integration tests.
 *
 * Verifies that an OpenAPI spec referenced from a tab in docs.json
 * produces auto-generated endpoint pages with correct nav structure,
 * parameter rendering, and code examples.
 */

import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '../helpers/test.ts'

test.describe('docs + API tabs coexist', () => {
  test('root page serves the documentation tab content', async ({ request }) => {
    const res = await request.get('/')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('Acme API')
    expect(html).toContain('Welcome to the Acme API documentation')
  })

  test('both tabs appear in the page', async ({ request }) => {
    const res = await request.get('/')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('Documentation')
    expect(html).toContain('API Reference')
  })

  test('API Reference tab is active on API pages', async ({ request }) => {
    const res = await request.get('/api/get-users')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    // The active tab should be "API Reference", not "Documentation"
    // Active tabs have a specific visual indicator (text-shadow faux bold)
    // Check that the loader data marks the correct tab as active
    expect(html).toContain('API Reference')
    // The sidebar should show API groups, not the docs content
    expect(html).toContain('List users')
  })
})

test.describe('OpenAPI tab', () => {
  test('nav tree contains groups from OpenAPI tags', async ({ request }) => {
    // Load any API endpoint page — the sidebar should show tag groups
    const res = await request.get('/api/get-users')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    // The spec has tags: users, orders, products, auth
    expect(html).toContain('List users')
    expect(html).toContain('Create user')
  })

  test('endpoint page renders method badge and path', async ({ request }) => {
    // GET /users → slug api/get-users
    const res = await request.get('/api/get-users')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('GET')
    expect(html).toContain('/users')
    expect(html).toContain('List users')
  })

  test('endpoint page renders parameters', async ({ request }) => {
    const res = await request.get('/api/get-users')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    // Query params from the spec
    expect(html).toContain('page')
    expect(html).toContain('limit')
    expect(html).toContain('role')
    expect(html).toContain('search')
  })

  test('endpoint page renders request body fields', async ({ request }) => {
    // POST /users has a request body with email, name, role
    const res = await request.get('/api/post-users')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('email')
    expect(html).toContain('name')
    expect(html).toContain('Request Body')
  })

  test('endpoint page renders response status codes', async ({ request }) => {
    const res = await request.get('/api/post-users')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('201')
    expect(html).toContain('400')
    expect(html).toContain('409')
  })

  test('200 response is open by default', async ({ page }) => {
    await page.goto('/api/get-users')
    await expect(page.locator('details').filter({ hasText: '200' }).first()).toHaveAttribute('open', '')
  })

  test('endpoint page renders curl example', async ({ request }) => {
    const res = await request.get('/api/post-users')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('curl')
    expect(html).toContain('POST')
  })

  test('deprecated endpoint shows deprecated badge', async ({ request }) => {
    // DELETE /users/{userId} is deprecated
    const res = await request.get('/api/delete-users-userid')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('deprecated')
  })

  test('endpoint with no auth shows no authorization section', async ({ request }) => {
    // GET /health has security: [] (no auth)
    const res = await request.get('/api/get-health')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('Health check')
    // Should NOT contain Authorization section
    expect(html).not.toContain('bearerAuth')
  })

  test('endpoint with explicit example shows response example', async ({ request }) => {
    // POST /orders has named examples in the 201 response
    const res = await request.get('/api/post-orders')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    // The response example is wrapped in ResponseExample inside the Aside
    expect(html).toContain('Response example')
    expect(html).toContain('order-001')
  })

  test('multiple named examples render as switchable tabs', async ({ request }) => {
    // POST /orders defines two request and two response named examples.
    const res = await request.get('/api/post-orders')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    // The curl request is the first tab, labeled "cURL".
    expect(html).toContain('cURL')
    // Example names become tab labels (request body examples).
    expect(html).toContain('Single item')
    expect(html).toContain('Multiple items')
    // Response example names become tab labels too.
    expect(html).toContain('Confirmed order')
    expect(html).toContain('Empty order')
    // Both response payloads are present, not just the first one.
    expect(html).toContain('order-001')
    expect(html).toContain('order-002')
  })

  test('request/response examples render as a single tabbed panel (no double frame)', async ({ page }) => {
    await page.goto('/api/post-orders')
    // The "Request example" panel exposes its code fences as a tablist with
    // the curl block plus the named examples as tabs. The whole panel is the
    // container that holds the tablist labeled "Request example".
    const requestTablist = page.getByRole('tablist', { name: 'Request example' })
    // The panel shell is the accent-colored container that directly holds the
    // request tablist (rounded-2xl bg-accent). Scoping here avoids matching a
    // shared ancestor that also wraps the Response example panel.
    const requestPanel = page.locator('div.rounded-2xl', { has: requestTablist }).first()
    await expect(requestPanel).toBeVisible()
    await expect(requestTablist.getByRole('tab', { name: 'cURL' })).toBeVisible()
    await expect(requestTablist.getByRole('tab', { name: 'Single item' })).toBeVisible()
    await expect(requestTablist.getByRole('tab', { name: 'Multiple items' })).toBeVisible()
    // A persistent copy button is present in the panel.
    await expect(requestPanel.getByRole('button', { name: 'Copy code' }).first()).toBeVisible()
    // The panel renders a single accent shell (no nested double frame): the
    // request example holds exactly one tablist (no CodeGroup-inside-CodeCard).
    await expect(requestPanel.getByRole('tablist', { name: 'Request example' })).toHaveCount(1)
    // Switching to the "Multiple items" tab reveals that example's payload
    // (productId prod-002 only appears in the multiple-items example). The
    // request shell renders exactly one active tabpanel at a time. Retry the
    // click via expect.poll so the assertion is robust against the slower
    // client hydration in dev mode (the tab is inert until React mounts).
    const multipleTab = requestTablist.getByRole('tab', { name: 'Multiple items' })
    await expect(async () => {
      await multipleTab.click()
      await expect(multipleTab).toHaveAttribute('aria-selected', 'true', { timeout: 1000 })
    }).toPass()
    await expect(requestPanel.getByRole('tabpanel')).toContainText('prod-002')

    // Response example is also a single tablist (Confirmed / Empty order).
    const responseTablist = page.getByRole('tablist', { name: 'Response example' })
    await expect(responseTablist.getByRole('tab', { name: 'Confirmed order' })).toBeVisible()
    await expect(responseTablist.getByRole('tab', { name: 'Empty order' })).toBeVisible()
  })

  test('markdown in endpoint description renders as HTML, not raw text', async ({ page }) => {
    // POST /orders has a Markdown description (heading, list, inline code, link).
    await page.goto('/api/post-orders')
    // The markdown link becomes a real, visible anchor element.
    const link = page.locator('a[href="https://example.com/orders"]', { hasText: 'orders guide' })
    await expect(link).toBeVisible()
    // The "## Pricing notes" heading renders as a heading element, not literal
    // "## Pricing notes" body text.
    await expect(page.getByText('## Pricing notes')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Pricing notes' })).toBeVisible()
    // Inline code `gift-wrap` renders inside a <code> element.
    await expect(page.locator('code', { hasText: 'gift-wrap' }).first()).toBeVisible()
  })

  test('204 no-content response renders gracefully', async ({ request }) => {
    // DELETE /users/{userId} returns 204 with no content
    const res = await request.get('/api/delete-users-userid')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('204')
  })

  test('sidebar shows method badge for API pages', async ({ request }) => {
    const res = await request.get('/api/get-users')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    // The sidebar should show the method badge (from frontmatter api: "GET /users")
    expect(html).toContain('GET')
    expect(html).toContain('POST')
    expect(html).toContain('DELETE')
  })

  test('path parameters appear in parameter section', async ({ request }) => {
    // GET /users/{userId} has a path param
    const res = await request.get('/api/get-users-userid')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('userId')
    expect(html).toContain('Path Parameters')
  })
})

test.describe('OpenAPI selective mode (custom pages + endpoint refs)', () => {
  test('custom MDX page in an openapi tab renders its prose', async ({ request }) => {
    const res = await request.get('/guide/authentication')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('Authentication')
    expect(html).toContain('Where to get your API key')
  })

  test('endpoint ref renders a generated endpoint page under base', async ({ request }) => {
    // "POST /auth/login" → slug guide/post-auth-login (base: "guide")
    const res = await request.get('/guide/post-auth-login')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('Login')
    expect(html).toContain('/auth/login')
  })

  test('custom page appears before endpoint page in the sidebar', async ({ request }) => {
    const res = await request.get('/guide/overview')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    const authIdx = html.indexOf('Authentication')
    const loginIdx = html.indexOf('Login')
    expect(authIdx).toBeGreaterThan(-1)
    expect(loginIdx).toBeGreaterThan(-1)
    // The authored order puts the Authentication guide before POST /auth/login.
    expect(authIdx).toBeLessThan(loginIdx)
  })

  test('authored groups are preserved (not replaced by tag groups)', async ({ request }) => {
    const res = await request.get('/guide/overview')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    // Authored group names, not the spec's tag names (users/orders/products)
    expect(html).toContain('Getting Started')
    expect(html).toContain('Orders')
  })

  test('the same endpoint can render under two tabs with different slugs', async ({ request }) => {
    // GET /users is auto-grouped under /api/... in the dedicated tab and
    // explicitly referenced under /guide/... in the selective tab.
    const dedicated = await request.get('/api/get-users')
    const selective = await request.get('/guide/get-users')
    expect(dedicated.ok()).toBe(true)
    expect(selective.ok()).toBe(true)
    expect(await selective.text()).toContain('List users')
  })
})

test.describe('OpenAPI "..." rest expansion', () => {
  test('intro MDX page renders before the auto-expanded endpoints', async ({ request }) => {
    const res = await request.get('/ref/intro')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    expect(html).toContain('Reference Intro')
    // The "..." entry expanded into tag groups, so the sidebar shows them.
    expect(html).toContain('List users')
  })

  test('"..." expands every endpoint under the tab base', async ({ request }) => {
    // No endpoints were listed explicitly, so "..." includes all of them.
    for (const slug of ['ref/get-users', 'ref/post-users', 'ref/get-health']) {
      const res = await request.get(`/${slug}`)
      expect(res.ok()).toBe(true)
    }
  })

  test('rest expansion includes endpoints from every tag', async ({ request }) => {
    // "..." expanded into tag groups (auth, users, orders, products, default).
    // Verify at least one endpoint from each major tag is routable under /ref.
    for (const slug of [
      'ref/post-auth-login',
      'ref/get-users',
      'ref/post-orders',
      'ref/get-products',
      'ref/get-health',
    ]) {
      const res = await request.get(`/${slug}`)
      expect(res.ok()).toBe(true)
    }
  })
})

// ── OpenAPI spec file HMR ─────────────────────────────────────────────

const fixtureRoot = path.resolve(import.meta.dirname, '../../fixtures/openapi')
const specPath = path.join(fixtureRoot, 'api.yaml')

test.describe.serial('OpenAPI spec HMR @dev', () => {
  let originalSpec: string

  test.beforeEach(() => {
    originalSpec = fs.readFileSync(specPath, 'utf-8')
  })

  test.afterEach(() => {
    fs.writeFileSync(specPath, originalSpec)
  })

  test('adding an endpoint to the spec creates a new routable page', async ({
    page,
    request,
  }) => {
    // Verify the new endpoint does NOT exist yet
    const before = await request.get('/api/get-ping')
    expect(before.ok()).toBe(false)

    // Navigate to an existing page so we can detect HMR updates
    await page.goto('/api/get-health', { waitUntil: 'commit' })
    await page.waitForFunction(
      () => document.readyState !== 'loading',
      undefined,
      { timeout: 30_000 },
    )

    // Append a new endpoint to the spec. Re-write with a unique comment on
    // each poll iteration so chokidar reliably fires a change event.
    const newEndpoint = `
  /ping:
    get:
      summary: Ping
      description: Simple ping endpoint for HMR testing.
      tags:
        - default
      security: []
      responses:
        "200":
          description: Pong
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
              example:
                message: pong`

    await expect
      .poll(
        async () => {
          fs.writeFileSync(specPath, `${originalSpec}\n${newEndpoint}\n# hmr ${Date.now()}\n`)
          const res = await request.get('/api/get-ping')
          return res.ok()
        },
        { timeout: 20_000 },
      )
      .toBe(true)

    // Verify the page content is correct
    const html = await (await request.get('/api/get-ping')).text()
    expect(html).toContain('Ping')
    expect(html).toContain('/ping')
  })
})
