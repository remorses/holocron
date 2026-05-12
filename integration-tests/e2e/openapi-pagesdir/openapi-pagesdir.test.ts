/**
 * Verifies that OpenAPI spec resolution works when the spec file lives
 * inside pagesDir (e.g. pagesDir: './src' with api.yaml in src/).
 * Regression test for the deploy failure where the provider only probed
 * projectRoot and missed specs inside pagesDir.
 */

import { test, expect } from '@playwright/test'

test('API endpoint page loads when spec is inside pagesDir', async ({ request }) => {
  const res = await request.get('/api/get-users')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  expect(html).toContain('List all users')
  expect(html).toContain('GET')
  expect(html).toContain('/users')
})

test('docs tab still works alongside OpenAPI tab', async ({ request }) => {
  const res = await request.get('/')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  expect(html).toContain('Welcome')
  expect(html).toContain('Documentation')
  expect(html).toContain('API Reference')
})
