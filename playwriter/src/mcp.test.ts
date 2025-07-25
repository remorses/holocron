import { createMCPClient } from './mcp-client.js'
import { describe, it, expect, afterEach } from 'vitest'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

// No longer need email profile - always uses ~/.playwriter

describe('MCP Server Tests', () => {
    let cleanup: (() => Promise<void>) | null = null

    afterEach(async () => {
        if (cleanup) {
            await cleanup()
            cleanup = null
        }
    })

    it('should capture console logs', async () => {
        const { client, cleanup: cleanupFn } = await createMCPClient()
        cleanup = cleanupFn

        // Connect first
        const connectResult = await client.callTool({
            name: 'new_page',
            arguments: {},
        })
        expect(connectResult.content).toBeDefined()
        expect(connectResult.content).toMatchInlineSnapshot(`
          [
            {
              "text": "Created new page. URL: about:blank. Total pages: 6",
              "type": "text",
            },
          ]
        `)

        // Navigate to a page and log something
        const result = await client.callTool({
            name: 'execute',
            arguments: {
                code: `
                    await page.goto('https://news.ycombinator.com');
                    await page.evaluate(() => {
                        console.log('Test log message');
                        console.error('Test error message');
                    });
                `,
            },
        })
        expect(result.content).toBeDefined()
        expect(result.content).toMatchInlineSnapshot(`
          [
            {
              "text": "Code executed successfully (no output)",
              "type": "text",
            },
          ]
        `)

        // Get console logs
        const logsResult = (await client.callTool({
            name: 'console_logs',
            arguments: {
                limit: 10,
            },
        })) as CallToolResult

        expect(logsResult.content).toBeDefined()
        expect(logsResult.content).toMatchInlineSnapshot(`
          [
            {
              "text": "No console messages",
              "type": "text",
            },
          ]
        `)
    }, 30000)
})
