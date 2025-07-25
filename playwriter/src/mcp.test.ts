import { createMCPClient } from './mcp-client.js'
import { describe, it, expect, afterEach } from 'vitest'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import fs from 'node:fs'
import path from 'node:path'

// No longer need email profile - always uses ~/.playwriter

// Helper function to save/compare snapshots
function compareSnapshot(name: string, content: any) {
    const snapshotsDir = path.join(__dirname, '__snapshots__')
    const snapshotPath = path.join(snapshotsDir, `${name}.json`)
    
    // Ensure snapshots directory exists
    if (!fs.existsSync(snapshotsDir)) {
        fs.mkdirSync(snapshotsDir, { recursive: true })
    }
    
    // Parse the content if it's in the MCP format
    const data = typeof content === 'object' && content.content?.[0]?.text 
        ? JSON.parse(content.content[0].text)
        : content
    
    // Write the snapshot
    fs.writeFileSync(snapshotPath, JSON.stringify(data, null, 2))
    
    return data
}

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
        const initialData = compareSnapshot('hacker-news-initial-accessibility', initialSnapshot)
        expect(initialData.role).toBe('WebArea')
        expect(initialData.name).toBe('Y Combinator | Hacker News')

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
        const focusedData = compareSnapshot('hacker-news-focused-accessibility', focusedSnapshot)
        
        // Check that the first link now has focus
        const focusedLink = focusedData.children.find((child: any) => child.focused === true)
        expect(focusedLink).toBeDefined()
        expect(focusedLink.role).toBe('link')

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
        const tabbedData = compareSnapshot('hacker-news-tabbed-accessibility', tabbedSnapshot)
        
        // Check that a different element now has focus
        const tabbedFocusedLink = tabbedData.children.find((child: any) => child.focused === true)
        expect(tabbedFocusedLink).toBeDefined()
        expect(tabbedFocusedLink.name).toBe('Hacker News') // Should be the "Hacker News" link
    }, 30000)
})