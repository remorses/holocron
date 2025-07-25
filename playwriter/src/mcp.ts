import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { Page, Browser, BrowserContext, chromium } from 'rebrowser-playwright'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import { getBrowserExecutablePath } from './browser-config.js'

// Chrome executable finding logic moved to browser-config.ts

// Store for maintaining state across tool calls
interface ToolState {
    isConnected: boolean
    page: Page | null
    browser: Browser | null
    chromeProcess: ChildProcess | null
    consoleLogs: Map<Page, ConsoleMessage[]>
    networkRequests: Map<Page, NetworkRequest[]>
}

const state: ToolState = {
    isConnected: false,
    page: null,
    browser: null,
    chromeProcess: null,
    consoleLogs: new Map(),
    networkRequests: new Map(),
}

interface ConsoleMessage {
    type: string
    text: string
    timestamp: number
    location?: {
        url: string
        lineNumber: number
        columnNumber: number
    }
}

interface NetworkRequest {
    url: string
    method: string
    status: number
    headers: Record<string, string>
    timestamp: number
    duration: number
    size: number
    requestBody?: any
    responseBody?: any
}

const CDP_PORT = 9922

// Check if CDP is available on the specified port
async function isCDPAvailable(): Promise<boolean> {
    try {
        const response = await fetch(
            `http://127.0.0.1:${CDP_PORT}/json/version`,
        )
        return response.ok
    } catch {
        return false
    }
}

// Launch Chrome with CDP enabled
async function launchChromeWithCDP(): Promise<ChildProcess> {
    const userDataDir = path.join(os.homedir(), '.playwriter')
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true })
    }

    const executablePath = getBrowserExecutablePath()

    const chromeArgs = [
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-session-crashed-bubble',
        '--disable-features=DevToolsDebuggingRestrictions',
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-web-security',
        '--disable-infobars',
        '--disable-translate',
    ]

    const chromeProcess = spawn(executablePath, chromeArgs, {
        detached: true,
        stdio: 'ignore',
    })

    // Unref the process so it doesn't keep the parent process alive
    chromeProcess.unref()

    // Give Chrome time to start up
    await new Promise((resolve) => setTimeout(resolve, 2000))

    return chromeProcess
}

// Ensure connection to Chrome via CDP
async function ensureConnection(): Promise<{ browser: Browser; page: Page }> {
    if (state.isConnected && state.browser && state.page) {
        return { browser: state.browser, page: state.page }
    }

    // Check if CDP is already available
    const cdpAvailable = await isCDPAvailable()

    if (!cdpAvailable) {
        // Launch Chrome with CDP
        const chromeProcess = await launchChromeWithCDP()
        state.chromeProcess = chromeProcess
    }

    // Connect to Chrome via CDP
    const browser = await chromium.connectOverCDP(
        `http://127.0.0.1:${CDP_PORT}`,
    )

    // Get the default context
    const contexts = browser.contexts()
    let context: BrowserContext

    if (contexts.length > 0) {
        context = contexts[0]
    } else {
        context = await browser.newContext()
    }

    // Generate user agent and set it on context
    const ua = require('user-agents')
    const userAgent = new ua({
        platform: 'MacIntel',
        deviceCategory: 'desktop',
    })

    // Get or create page
    const pages = context.pages()
    let page: Page

    if (pages.length > 0) {
        page = pages[0]
        // Set user agent on existing page
        await page.setExtraHTTPHeaders({
            'User-Agent': userAgent.toString(),
        })
    } else {
        page = await context.newPage()
        // Set user agent on new page
        await page.setExtraHTTPHeaders({
            'User-Agent': userAgent.toString(),
        })
    }

    // Set up event listeners if not already set
    if (!state.isConnected) {
        page.on('console', (msg) => {
            // Get or create logs array for this page
            let pageLogs = state.consoleLogs.get(page)
            if (!pageLogs) {
                pageLogs = []
                state.consoleLogs.set(page, pageLogs)
            }
            
            // Add new log
            pageLogs.push({
                type: msg.type(),
                text: msg.text(),
                timestamp: Date.now(),
                location: msg.location(),
            })
            
            // Keep only last 1000 logs
            if (pageLogs.length > 1000) {
                pageLogs.shift()
            }
        })
        
        // Clean up logs and network requests when page is closed
        page.on('close', () => {
            state.consoleLogs.delete(page)
            state.networkRequests.delete(page)
        })

        page.on('request', (request) => {
            const startTime = Date.now()
            const entry: Partial<NetworkRequest> = {
                url: request.url(),
                method: request.method(),
                headers: request.headers(),
                timestamp: startTime,
            }

            request
                .response()
                .then((response) => {
                    if (response) {
                        entry.status = response.status()
                        entry.duration = Date.now() - startTime
                        entry.size = response.headers()['content-length']
                            ? parseInt(response.headers()['content-length'])
                            : 0

                        // Get or create requests array for this page
                        let pageRequests = state.networkRequests.get(page)
                        if (!pageRequests) {
                            pageRequests = []
                            state.networkRequests.set(page, pageRequests)
                        }
                        
                        // Add new request
                        pageRequests.push(entry as NetworkRequest)
                        
                        // Keep only last 1000 requests
                        if (pageRequests.length > 1000) {
                            pageRequests.shift()
                        }
                    }
                })
                .catch(() => {
                    // Handle response errors silently
                })
        })
    }

    state.browser = browser
    state.page = page
    state.isConnected = true

    return { browser, page }
}

// Initialize MCP server
const server = new McpServer({
    name: 'playwriter',
    title: 'Playwright MCP Server',
    version: '1.0.0',
})


// Tool 1: New Page - Creates a new browser page
server.tool(
    'new_page',
    'Create a new browser page in the shared Chrome instance',
    {},
    async () => {
        try {
            const { browser, page } = await ensureConnection()

            // Always create a new page
            const context = browser.contexts()[0] || await browser.newContext()
            const newPage = await context.newPage()

            // Set user agent on new page
            const ua = require('user-agents')
            const userAgent = new ua({
                platform: 'MacIntel',
                deviceCategory: 'desktop',
            })
            await newPage.setExtraHTTPHeaders({
                'User-Agent': userAgent.toString()
            })

            // Update state to use the new page
            state.page = newPage

            // Set up event listeners on the new page
            newPage.on('console', (msg) => {
                // Get or create logs array for this page
                let pageLogs = state.consoleLogs.get(newPage)
                if (!pageLogs) {
                    pageLogs = []
                    state.consoleLogs.set(newPage, pageLogs)
                }
                
                // Add new log
                pageLogs.push({
                    type: msg.type(),
                    text: msg.text(),
                    timestamp: Date.now(),
                    location: msg.location(),
                })
                
                // Keep only last 1000 logs
                if (pageLogs.length > 1000) {
                    pageLogs.shift()
                }
            })
            
            // Clean up logs and network requests when page is closed
            newPage.on('close', () => {
                state.consoleLogs.delete(newPage)
                state.networkRequests.delete(newPage)
            })

            newPage.on('request', (request) => {
                const startTime = Date.now()
                const entry: Partial<NetworkRequest> = {
                    url: request.url(),
                    method: request.method(),
                    headers: request.headers(),
                    timestamp: startTime,
                }

                request
                    .response()
                    .then((response) => {
                        if (response) {
                            entry.status = response.status()
                            entry.duration = Date.now() - startTime
                            entry.size = response.headers()['content-length']
                                ? parseInt(response.headers()['content-length'])
                                : 0

                            // Get or create requests array for this page
                            let pageRequests = state.networkRequests.get(newPage)
                            if (!pageRequests) {
                                pageRequests = []
                                state.networkRequests.set(newPage, pageRequests)
                            }
                            
                            // Add new request
                            pageRequests.push(entry as NetworkRequest)
                            
                            // Keep only last 1000 requests
                            if (pageRequests.length > 1000) {
                                pageRequests.shift()
                            }
                        }
                    })
                    .catch(() => {
                        // Handle response errors silently
                    })
            })

            return {
                content: [
                    {
                        type: 'text',
                        text: `Created new page. URL: ${newPage.url()}. Total pages: ${context.pages().length}`,
                    },
                ],
            }
        } catch (error: any) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to create new page: ${error.message}`,
                    },
                ],
                isError: true,
            }
        }
    },
)

// Tool 2: Console Logs
server.tool(
    'console_logs',
    'Retrieve console messages from the page',
    {
        limit: z
            .number()
            .default(50)
            .describe('Maximum number of messages to return'),
        type: z
            .enum(['log', 'info', 'warning', 'error', 'debug'])
            .optional()
            .describe('Filter by message type'),
        offset: z.number().default(0).describe('Start from this index'),
    },
    async ({ limit, type, offset }) => {
        try {
            const { page } = await ensureConnection() // Ensure we're connected first

            // Get logs for current page
            const pageLogs = state.consoleLogs.get(page) || []
            
            // Filter and paginate logs
            let logs = [...pageLogs]
            if (type) {
                logs = logs.filter((log) => log.type === type)
            }

            const paginatedLogs = logs.slice(offset, offset + limit)

            // Format logs to look like Chrome console output
            let consoleOutput = ''

            if (paginatedLogs.length === 0) {
                consoleOutput = 'No console messages'
            } else {
                consoleOutput = paginatedLogs
                    .map((log) => {
                        const timestamp = new Date(
                            log.timestamp,
                        ).toLocaleTimeString()
                        const location = log.location
                            ? ` ${log.location.url}:${log.location.lineNumber}:${log.location.columnNumber}`
                            : ''
                        return `[${log.type}]: ${log.text}${location}`
                    })
                    .join('\n')

                if (logs.length > paginatedLogs.length) {
                    consoleOutput += `\n\n(Showing ${paginatedLogs.length} of ${logs.length} total messages)`
                }
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: consoleOutput,
                    },
                ],
            }
        } catch (error: any) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to get console logs: ${error.message}`,
                    },
                ],
                isError: true,
            }
        }
    },
)

// Tool 3: Network History
server.tool(
    'network_history',
    'Get history of network requests',
    {
        limit: z
            .number()
            .default(50)
            .describe('Maximum number of requests to return'),
        urlPattern: z
            .string()
            .optional()
            .describe('Filter by URL pattern (supports wildcards)'),
        method: z
            .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
            .optional()
            .describe('Filter by HTTP method'),
        statusCode: z
            .object({
                min: z.number().optional(),
                max: z.number().optional(),
            })
            .optional()
            .describe('Filter by status code range'),
        includeBody: z
            .boolean()
            .default(false)
            .describe('Include request/response bodies'),
    },
    async ({ limit, urlPattern, method, statusCode, includeBody }) => {
        try {
            const { page } = await ensureConnection()

            // Get requests for current page
            const pageRequests = state.networkRequests.get(page) || []

            // If includeBody is requested, we need to fetch bodies for existing requests
            if (includeBody && pageRequests.length > 0) {
                // Note: In a real implementation, you'd store bodies during capture
                console.warn('Body capture not implemented in this example')
            }

            // Filter requests
            let requests = [...pageRequests]

            if (urlPattern) {
                const pattern = new RegExp(urlPattern.replace(/\*/g, '.*'))
                requests = requests.filter((req) => pattern.test(req.url))
            }

            if (method) {
                requests = requests.filter((req) => req.method === method)
            }

            if (statusCode) {
                requests = requests.filter((req) => {
                    if (statusCode.min && req.status < statusCode.min)
                        return false
                    if (statusCode.max && req.status > statusCode.max)
                        return false
                    return true
                })
            }

            const limitedRequests = requests.slice(-limit)

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                total: requests.length,
                                requests: limitedRequests,
                            },
                            null,
                            2,
                        ),
                    },
                ],
            }
        } catch (error: any) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to get network history: ${error.message}`,
                    },
                ],
                isError: true,
            }
        }
    },
)

// Tool 4: Accessibility Snapshot - Get page accessibility tree as JSON
server.tool(
    'accessibility_snapshot',
    'Get the accessibility snapshot of the current page as JSON',
    {},
    async ({}) => {
        try {
            const { page } = await ensureConnection()

            const snapshot = await page.accessibility.snapshot({
                interestingOnly: true,
                root: undefined,
            })

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(snapshot, null, 2),
                    },
                ],
            }
        } catch (error: any) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to get accessibility snapshot: ${error.message}`,
                    },
                ],
                isError: true,
            }
        }
    },
)

// Tool 5: Execute - Run arbitrary JavaScript code with page and context in scope
const promptContent = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), 'prompt.md'),
    'utf-8',
)

server.tool(
    'execute',
    promptContent,
    {
        code: z
            .string()
            .describe(
                'JavaScript code to execute with page and context in scope. Should be one line, using ; to execute multiple statements. To execute complex actions call execute multiple times. ',
            ),
        timeout: z
            .number()
            .default(3000)
            .describe('Timeout in milliseconds for code execution (default: 3000ms)'),
    },
    async ({ code, timeout }) => {
        const { page } = await ensureConnection()
        const context = page.context()
        console.error('Executing code:', code)
        try {
            // Collect console logs during execution
            const consoleLogs: Array<{ method: string; args: any[] }> = []

            // Create a custom console object that collects logs
            const customConsole = {
                log: (...args: any[]) => {
                    consoleLogs.push({ method: 'log', args })
                },
                info: (...args: any[]) => {
                    consoleLogs.push({ method: 'info', args })
                },
                warn: (...args: any[]) => {
                    consoleLogs.push({ method: 'warn', args })
                },
                error: (...args: any[]) => {
                    consoleLogs.push({ method: 'error', args })
                },
                debug: (...args: any[]) => {
                    consoleLogs.push({ method: 'debug', args })
                },
            }

            // Create a function that has page, context, and console in scope
            const executeCode = new Function(
                'page',
                'context',
                'console',
                `
                return (async () => {
                    ${code}
                })();
            `,
            )

            // Execute the code with page, context, and custom console with timeout
            const result = await Promise.race([
                executeCode(page, context, customConsole),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Code execution timed out after ${timeout}ms`)), timeout)
                )
            ])

            // Format the response with both console output and return value
            let responseText = ''

            // Add console logs if any
            if (consoleLogs.length > 0) {
                responseText += 'Console output:\n'
                consoleLogs.forEach(({ method, args }) => {
                    const formattedArgs = args
                        .map((arg) => {
                            if (typeof arg === 'object') {
                                return JSON.stringify(arg, null, 2)
                            }
                            return String(arg)
                        })
                        .join(' ')
                    responseText += `[${method}] ${formattedArgs}\n`
                })
                responseText += '\n'
            }

            // Add return value if any
            if (result !== undefined) {
                responseText += 'Return value:\n'
                responseText += JSON.stringify(result, null, 2)
            } else if (consoleLogs.length === 0) {
                responseText += 'Code executed successfully (no output)'
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: responseText.trim(),
                    },
                ],
            }
        } catch (error: any) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Error executing code: ${error.message}\n${error.stack}`,
                    },
                ],
                isError: true,
            }
        }
    },
)

// Start the server
async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error('Playwright MCP server running on stdio')
}

// Cleanup function
async function cleanup() {
    console.error('Shutting down MCP server...')

    if (state.browser) {
        try {
            // Close the browser connection but not the Chrome process
            // Since we're using CDP, closing the browser object just closes
            // the connection, not the actual Chrome instance
            await state.browser.close()
        } catch (e) {
            // Ignore errors during browser close
        }
    }

    // Don't kill the Chrome process - let it continue running
    // The process was started with detached: true and unref() 
    // so it will persist after this process exits

    process.exit(0)
}

// Handle process termination
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
process.on('exit', () => {
    // Browser cleanup is handled by the async cleanup function
})

main().catch(console.error)
