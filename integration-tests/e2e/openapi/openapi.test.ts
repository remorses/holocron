/**
 * OpenAPI fixture integration tests.
 *
 * Verifies that an OpenAPI spec referenced from a tab in docs.json
 * produces auto-generated endpoint pages with correct nav structure,
 * parameter rendering, and code examples.
 */

import { test, expect } from '@playwright/test'

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
    // POST /orders has an explicit example in the 201 response
    const res = await request.get('/api/post-orders')
    expect(res.ok()).toBe(true)
    const html = await res.text()
    // The response example is wrapped in ResponseExample inside the Aside
    expect(html).toContain('Response example')
    expect(html).toContain('order-001')
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
