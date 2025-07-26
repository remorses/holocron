import { createMCPClient } from './mcp-client.js'
import { describe, it, expect, afterEach } from 'vitest'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

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
              "text": "Created new page. URL: about:blank. Total pages: 20",
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
              "text": "[log]: Test log message :1:32
          [error]: Test error message :2:32",
              "type": "text",
            },
          ]
        `)
    }, 30000)

    it('should capture accessibility snapshot of hacker news', async () => {
        const { client, cleanup: cleanupFn } = await createMCPClient()
        cleanup = cleanupFn

        // Create new page
        await client.callTool({
            name: 'new_page',
            arguments: {},
        })

        // Navigate to a specific old Hacker News story that won't change
        await client.callTool({
            name: 'execute',
            arguments: {
                code: `await page.goto('https://news.ycombinator.com/item?id=1', { waitUntil: 'networkidle' })`,
            },
        })

        // Get initial accessibility snapshot
        const initialSnapshot = await client.callTool({
            name: 'accessibility_snapshot',
            arguments: {},
        })
        expect(initialSnapshot.content).toBeDefined()

        // Save initial snapshot
        const initialData =
            typeof initialSnapshot === 'object' && initialSnapshot.content?.[0]?.text
                ? tryJsonParse(initialSnapshot.content[0].text)
                : initialSnapshot
        expect(initialData).toMatchFileSnapshot('snapshots/hacker-news-initial-accessibility.md')
        expect(initialData).toContain('table')
        expect(initialData).toContain('Hacker News')

        // Focus on first link on the page
        await client.callTool({
            name: 'execute',
            arguments: {
                code: `
                    // Find and focus the first link
                    const firstLink = await page.$('a')
                    if (firstLink) {
                        await firstLink.focus()
                        const linkText = await firstLink.textContent()
                        console.log('Focused on first link:', linkText)
                    }
                `,
            },
        })

        // Get snapshot after focusing
        const focusedSnapshot = await client.callTool({
            name: 'accessibility_snapshot',
            arguments: {},
        })
        expect(focusedSnapshot.content).toBeDefined()

        // Save focused snapshot
        const focusedData =
            typeof focusedSnapshot === 'object' && focusedSnapshot.content?.[0]?.text
                ? tryJsonParse(focusedSnapshot.content[0].text)
                : focusedSnapshot
        expect(focusedData).toMatchFileSnapshot('snapshots/hacker-news-focused-accessibility.md')

        // Verify the snapshot contains expected content
        expect(focusedData).toBeDefined()
        expect(focusedData).toContain('link')

        // Press Tab to go to next item
        await client.callTool({
            name: 'execute',
            arguments: {
                code: `
                    await page.keyboard.press('Tab')
                    console.log('Pressed Tab key')
                `,
            },
        })

        // Get snapshot after tab navigation
        const tabbedSnapshot = await client.callTool({
            name: 'accessibility_snapshot',
            arguments: {},
        })
        expect(tabbedSnapshot.content).toBeDefined()

        // Save tabbed snapshot
        const tabbedData =
            typeof tabbedSnapshot === 'object' && tabbedSnapshot.content?.[0]?.text
                ? tryJsonParse(tabbedSnapshot.content[0].text)
                : tabbedSnapshot
        expect(tabbedData).toMatchFileSnapshot('snapshots/hacker-news-tabbed-accessibility.md')

        // Verify the snapshot is different
        expect(tabbedData).toBeDefined()
        expect(tabbedData).toContain('Hacker News')
    }, 30000)

    it('should capture accessibility snapshot of shadcn UI', async () => {
        const { client, cleanup: cleanupFn } = await createMCPClient()
        cleanup = cleanupFn

        // Create new page
        await client.callTool({
            name: 'new_page',
            arguments: {},
        })

        // Navigate to shadcn UI
        await client.callTool({
            name: 'execute',
            arguments: {
                code: `await page.goto('https://ui.shadcn.com/', { waitUntil: 'networkidle' })`,
            },
        })

        // Get accessibility snapshot
        const snapshot = await client.callTool({
            name: 'accessibility_snapshot',
            arguments: {},
        })
        expect(snapshot.content).toBeDefined()

        // Save snapshot
        const data =
            typeof snapshot === 'object' && snapshot.content?.[0]?.text
                ? tryJsonParse(snapshot.content[0].text)
                : snapshot
        expect(data).toMatchFileSnapshot('snapshots/shadcn-ui-accessibility.md')
        expect(data).toContain('shadcn')
    }, 30000)
})
function tryJsonParse(str: string) {
    try {
        return JSON.parse(str)
    } catch {
        return str
    }
}
