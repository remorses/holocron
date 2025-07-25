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

    it('should connect to Chrome via CDP', async () => {
        const { client, cleanup: cleanupFn } = await createMCPClient()
        cleanup = cleanupFn

        // First, let's get available profiles
        const profilesResult = (await client.callTool({
            name: 'connect',
            arguments: {},
        })) as CallToolResult
        console.log('Available profiles:', profilesResult)

        // Check if we got profiles or need to use a temp profile

        if (
            profilesResult.content &&
            profilesResult.content[0] &&
            profilesResult.content[0].type === 'text'
        ) {
            const text = profilesResult.content[0].text
            if (text.includes('Available Chrome profiles')) {
                // Extract first email from the profile list
                const emailMatch = text.match(/\(([^)]+@[^)]+)\)/)
                if (emailMatch) {
                    emailProfile = emailMatch[1]
                    console.log('Using existing profile:', emailProfile)
                }
            }
        }

        // Now connect with the email profile
        const connectResult = (await client.callTool({
            name: 'connect',
            arguments: {
                emailProfile,
            },
        })) as CallToolResult

        expect(connectResult.content).toBeDefined()
        expect(connectResult.content[0]).toBeDefined()
        if (connectResult.content[0].type === 'text') {
            expect(connectResult.content[0].text).toContain(
                'Connected to Chrome via CDP',
            )
        }

        // Test that we can execute some code
        const executeResult = (await client.callTool({
            name: 'execute',
            arguments: {
                code: `
                    const url = page.url();
                    console.log('Current URL:', url);
                    return { url, title: await page.title() };
                `,
            },
        })) as CallToolResult

        expect(executeResult.content).toBeDefined()
        if (executeResult.content[0]?.type === 'text') {
            const executeText = executeResult.content[0].text
            expect(executeText).toContain('Console output:')
            expect(executeText).toContain('Current URL:')
        }
    }, 30000) // 30 second timeout for Chrome to start

    it('should capture console logs', async () => {
        const { client, cleanup: cleanupFn } = await createMCPClient()
        cleanup = cleanupFn

        // Connect first
        await client.callTool({
            name: 'connect',
            arguments: {
                emailProfile,
            },
        })

        // Navigate to a page and log something
        await client.callTool({
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

        // Get console logs
        const logsResult = (await client.callTool({
            name: 'console_logs',
            arguments: {
                limit: 10,
            },
        })) as CallToolResult

        expect(logsResult.content).toBeDefined()
        if (logsResult.content[0]?.type === 'text') {
            const logsData = JSON.parse(logsResult.content[0].text || '{}')
            expect(logsData.logs).toBeDefined()
            expect(logsData.logs.length).toBeGreaterThan(0)

            const hasTestLog = logsData.logs.some((log: any) =>
                log.text.includes('Test log message'),
            )
            expect(hasTestLog).toBe(true)
        }
    }, 30000)
})
