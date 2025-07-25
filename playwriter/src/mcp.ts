import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { Page, Browser, BrowserContext, chromium } from 'rebrowser-playwright'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'

// Find Chrome executable path based on OS (from playwriter.ts)
function findChromeExecutablePath(): string {
    const osPlatform = os.platform()

    const paths: string[] = (() => {
        if (osPlatform === 'darwin') {
            return [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
                '~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            ]
        }
        if (osPlatform === 'win32') {
            return [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
                `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
                `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
            ].filter(Boolean)
        }
        // Linux
        return [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/snap/bin/chromium',
        ]
    })()

    for (const path of paths) {
        const resolvedPath = path.startsWith('~')
            ? path.replace('~', process.env.HOME || '')
            : path
        if (fs.existsSync(resolvedPath)) {
            return resolvedPath
        }
    }

    throw new Error(
        'Could not find Chrome executable. Please install Google Chrome.',
    )
}

// Store for maintaining state across tool calls
interface ToolState {
    isConnected: boolean
    page: Page | null
    browser: Browser | null
    chromeProcess: ChildProcess | null
    consoleLogs: ConsoleMessage[]
    networkRequests: NetworkRequest[]
}

const state: ToolState = {
    isConnected: false,
    page: null,
    browser: null,
    chromeProcess: null,
    consoleLogs: [],
    networkRequests: [],
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

    const executablePath = findChromeExecutablePath()

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
        detached: false,
        stdio: 'ignore',
    })

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
            state.consoleLogs.push({
                type: msg.type(),
                text: msg.text(),
                timestamp: Date.now(),
                location: msg.location(),
            })
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

                        state.networkRequests.push(entry as NetworkRequest)
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

// Helper to ensure connection (deprecated - methods now auto-connect)
function ensureConnected(): Page {
    if (!state.isConnected || !state.page) {
        throw new Error("Not connected. Please call the 'connect' tool first.")
    }
    return state.page
}

// Tool 1: Connect - Must be called first
server.tool(
    'connect',
    'Connect to Chrome via CDP and set up event listeners',
    {},
    async () => {
        try {
            const { browser, page } = await ensureConnection()

            return {
                content: [
                    {
                        type: 'text',
                        text: `Connected to Chrome via CDP on port ${CDP_PORT}. Page URL: ${page.url()}. Event listeners configured for console and network monitoring.`,
                    },
                ],
            }
        } catch (error: any) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Failed to connect: ${error.message}`,
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
            await ensureConnection() // Ensure we're connected first

            // Filter and paginate logs
            let logs = [...state.consoleLogs]
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
            await ensureConnection()

            // If includeBody is requested, we need to fetch bodies for existing requests
            if (includeBody && state.networkRequests.length > 0) {
                // Note: In a real implementation, you'd store bodies during capture
                console.warn('Body capture not implemented in this example')
            }

            // Filter requests
            let requests = [...state.networkRequests]

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
            await state.browser.close()
        } catch (e) {
            // Ignore errors during browser close
        }
    }

    if (state.chromeProcess) {
        try {
            state.chromeProcess.kill()
        } catch (e) {
            // Ignore errors during process kill
        }
    }

    process.exit(0)
}

// Handle process termination
process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)
process.on('exit', () => {
    // Browser cleanup is handled by the async cleanup function
})

main().catch(console.error)
