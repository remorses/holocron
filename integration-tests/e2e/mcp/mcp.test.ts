/**
 * MCP fixture integration tests.
 *
 * Verifies that an MCP definition file referenced from a tab in docs.json
 * produces auto-generated tool and resource pages with correct navigation
 * structure and rendered content.
 */

import fs from 'node:fs'
import path from 'node:path'
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

// ── MCP definition file HMR ──────────────────────────────────────────

const fixtureRoot = path.resolve(import.meta.dirname, '../../fixtures/mcp')
const mcpPath = path.join(fixtureRoot, 'mcp-tools.json')

test.describe.serial('MCP definition HMR @dev', () => {
  let originalContent: string

  test.beforeEach(() => {
    originalContent = fs.readFileSync(mcpPath, 'utf-8')
  })

  test.afterEach(() => {
    fs.writeFileSync(mcpPath, originalContent)
  })

  test('adding a tool to the definition file creates a new routable page', async ({
    page,
    request,
  }) => {
    // Verify the new tool does NOT exist yet
    const before = await request.get('/mcp/ping-server')
    expect(before.ok()).toBe(false)

    // Navigate to an existing page so we can detect HMR updates
    await page.goto('/mcp/query-database', { waitUntil: 'commit' })
    await page.waitForFunction(
      () => document.readyState !== 'loading',
      undefined,
      { timeout: 30_000 },
    )

    // Add a new tool to the definition file
    const defs = JSON.parse(originalContent)
    defs.tools.push({
      name: 'ping_server',
      description: 'Ping the server to check if it is alive.',
      inputSchema: {
        type: 'object',
        properties: {
          host: { type: 'string', description: 'Hostname to ping', example: 'localhost' },
        },
        required: ['host'],
      },
    })

    await expect
      .poll(
        async () => {
          fs.writeFileSync(mcpPath, JSON.stringify(defs, null, 2))
          const res = await request.get('/mcp/ping-server')
          return res.ok()
        },
        { timeout: 20_000 },
      )
      .toBe(true)

    const html = await (await request.get('/mcp/ping-server')).text()
    expect(html).toContain('ping_server')
    expect(html).toContain('TOOL')
  })
})
