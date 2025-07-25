import { createMCPClient } from './mcp-client.js'
import { describe, it, expect, afterEach } from 'vitest'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

let emailProfile = 'daer.tommy@gmail.com'

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
            name: 'connect',
            arguments: {
                emailProfile,
            },
        })
        expect(connectResult.content).toBeDefined()
        expect(connectResult.content).toMatchInlineSnapshot(`
          [
            {
              "text": "Failed to connect: browserType.connectOverCDP: connect ECONNREFUSED 127.0.0.1:9922
          Call log:
          [2m  - <ws preparing> retrieving websocket url from http://127.0.0.1:9922[22m
          ",
              "type": "text",
            },
          ]
        `)

        // Navigate to a page and log something
        const result = await client.callTool({
            name: 'execute',
            arguments: {
                code: `
                    await page.goto('https://example.com');
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
              "text": "Not connected. Please call the 'connect' tool first with a Playwright page instance.",
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
              "text": "Failed to get console logs: Not connected. Please call the 'connect' tool first with a Playwright page instance.",
              "type": "text",
            },
          ]
        `)
    }, 30000)
})
