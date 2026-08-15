/**
 * MCP fixture integration tests.
 *
 * Verifies that an MCP definition file referenced from a tab in docs.json
 * produces auto-generated tool and resource pages with correct navigation
 * structure and rendered content.
 */

import { test, expect } from '../helpers/test.ts'

test('root page renders the documentation tab', async ({ request }) => {
  const res = await request.get('/')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  expect(html).toContain('MCP Fixture')
})

test('both tabs appear in navigation', async ({ request }) => {
  const res = await request.get('/')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  expect(html).toContain('Documentation')
  expect(html).toContain('MCP Tools')
})

test('tool page renders with tool name and parameters', async ({ request }) => {
  const res = await request.get('/mcp/query-database')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  expect(html).toContain('query_database')
  expect(html).toContain('TOOL')
  expect(html).toContain('query')
  expect(html).toContain('database')
})

test('tool page shows request example in aside', async ({ request }) => {
  const res = await request.get('/mcp/query-database')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  expect(html).toContain('tools/call')
  expect(html).toContain('query_database')
})

test('tool with outputSchema shows response example and response field list', async ({ request }) => {
  const res = await request.get('/mcp/query-database')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  expect(html).toContain('Response')
  expect(html).toContain('rows')
  expect(html).toContain('count')
})

test('tool with execution.taskSupport shows long-running badge', async ({ request }) => {
  const res = await request.get('/mcp/send-notification')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  expect(html).toContain('long-running')
})

test('resource page renders with resource name and URI', async ({ request }) => {
  const res = await request.get('/mcp/resources/users-table-schema')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  expect(html).toContain('Users Table Schema')
  expect(html).toContain('SOURCE')
  expect(html).toContain('db://schema/users')
})

test('sidebar shows Tools and Resources groups', async ({ request }) => {
  const res = await request.get('/mcp/query-database')
  expect(res.ok()).toBe(true)
  const html = await res.text()
  expect(html).toContain('Tools')
  expect(html).toContain('Resources')
})

test('all three tools have pages', async ({ request }) => {
  for (const slug of ['query-database', 'send-notification', 'get-weather']) {
    const res = await request.get(`/mcp/${slug}`)
    expect(res.ok()).toBe(true)
  }
})
