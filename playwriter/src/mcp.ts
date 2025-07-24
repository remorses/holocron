import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { Page } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

// Store for maintaining state across tool calls
interface ToolState {
    isConnected: boolean
    page: Page | null
    consoleLogs: ConsoleMessage[]
    networkRequests: NetworkRequest[]
}

const state: ToolState = {
    isConnected: false,
    page: null,
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

// Initialize MCP server
const server = new McpServer({
    name: 'playwright-tools',
    version: '1.0.0',
})

// Helper to ensure connection
function ensureConnected(): Page {
    if (!state.isConnected || !state.page) {
        throw new Error(
            "Not connected. Please call the 'connect' tool first with a Playwright page instance.",
        )
    }
    return state.page
}

// Tool 1: Connect - Must be called first
server.tool(
    'connect',
    'Connect to a Playwright page and set up event listeners',
    {},
    async ({}) => {
        // In real implementation, get the page from your context
        const page = getActivePage() // This would come from your context

        // Set up event listeners
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

        state.page = page
        state.isConnected = true

        return {
            content: [
                {
                    type: 'text',
                    text: 'Connected to Playwright page. Event listeners configured for console and network monitoring.',
                },
            ],
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
        ensureConnected() // Ensure we're connected first

        // Filter and paginate logs
        let logs = [...state.consoleLogs]
        if (type) {
            logs = logs.filter((log) => log.type === type)
        }

        const paginatedLogs = logs.slice(offset, offset + limit)

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(
                        {
                            total: logs.length,
                            offset: offset,
                            logs: paginatedLogs,
                        },
                        null,
                        2,
                    ),
                },
            ],
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
        const page = ensureConnected()

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
                if (statusCode.min && req.status < statusCode.min) return false
                if (statusCode.max && req.status > statusCode.max) return false
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
    },
)

// Tool 4: Execute - Run arbitrary JavaScript code with page and context in scope
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
                'JavaScript code to execute with page and context in scope. The code should use the Playwright API to accomplish browser automation tasks.',
            ),
    },
    async ({ code }) => {
        const page = ensureConnected()
        const context = page.context()

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

            // Execute the code with page, context, and custom console
            const result = await executeCode(page, context, customConsole)

            // Format the response with both console output and return value
            let responseText = ''
            
            // Add console logs if any
            if (consoleLogs.length > 0) {
                responseText += 'Console output:\n'
                consoleLogs.forEach(({ method, args }) => {
                    const formattedArgs = args
                        .map(arg => {
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

main().catch(console.error)

// Helper function - in real implementation this would get the active page
function getActivePage(): Page {
    // This would be implemented based on your architecture
    // For example, it might come from a browser context manager
    throw new Error('Implement based on your page management strategy')
}
