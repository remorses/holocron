Tabs /**
 *
 * MCP (Model Context Protocol) Documentation Components
 *
 * This file provides components for rendering MCP tool documentation,
 * similar to OpenAPI documentation but specifically for MCP tools.
 */
export type { Tool } from '@modelcontextprotocol/sdk/types.js'
export type { CoreMessage } from 'ai'
export { Chat } from './chat'

import { type ReactNode } from 'react'
import { Schema } from 'fumadocs-openapi/render/schema'
import { getContext } from 'fumadocs-openapi/render/api-page'
import { processDocument } from 'fumadocs-openapi/utils/process-document'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { CoreMessage } from 'ai'
import type { RenderContext } from 'fumadocs-openapi/types'
import { heading } from 'fumadocs-openapi/render/heading'
import { Markdown } from 'fumadocs-openapi/render/markdown'
import { MethodLabel } from 'fumadocs-openapi/ui/components/method-label'
import type { ResolvedSchema } from 'fumadocs-openapi/utils/schema'
import { Tabs, Tab } from 'fumadocs-ui/components/tabs'
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { RightSideTabs } from './tabs'
import { APIPlayground } from 'fumadocs-openapi/playground'
import { CodeExampleProvider } from 'fumadocs-openapi/ui/lazy'
import { Chat } from './chat'

export interface MCPPageProps {
    /**
     * The tool to display
     */
    tool: Tool

    /**
     * The MCP server URL
     */
    serverUrl?: string

    /**
     * Whether to include headers for the tool
     */
    hasHead?: boolean

    /**
     * Custom tool example for chat demonstration
     */
    chatExample?: CoreMessage[]

    /**
     * Custom context for rendering
     */
    renderContext?: Partial<RenderContext>
}

export interface MCPServerPageProps {
    /**
     * The tools to display
     */
    tools: Tool[]

    /**
     * MCP server information
     */
    server: {
        /**
         * Server name or identifier
         */
        name: string
        /**
         * Human-readable title for the server
         */
        title?: string
        /**
         * Server description
         */
        description?: string
        /**
         * Server URL
         */
        url?: string
        /**
         * Server version
         */
        version?: string
    }

    /**
     * Whether to include headers for each tool
     */
    hasHead?: boolean

    /**
     * Custom tool examples for chat demonstrations
     */
    toolExamples?: Record<string, CoreMessage[]>

    /**
     * Custom context for rendering
     */
    renderContext?: Partial<RenderContext>
}

export interface MCPToolProps {
    /**
     * The tool definition from MCP
     */
    tool: Tool

    /**
     * The MCP server URL
     */
    serverUrl?: string

    /**
     * Whether to include header
     */
    hasHead?: boolean

    /**
     * Heading level for the tool
     */
    headingLevel?: number

    /**
     * Chat messages example for this tool
     */
    chatExample?: CoreMessage[]

    /**
     * Whether to show the playground
     */
    showPlayground?: boolean

    /**
     * Callback for playground tool execution
     */
    onExecute?: (params: any) => Promise<any>

    /**
     * Render context
     */
    ctx: RenderContext
}

/**
 * Main component for rendering MCP tool documentation
 */
export async function MCPPage({
    tool,
    serverUrl,
    hasHead = true,
    chatExample,
    renderContext = {},
}: MCPPageProps) {
    // Create a basic context for rendering schemas

    const document = await processDocument({
        openapi: '3.1.0',
        info: { title: 'MCP Tool', version: '1.0.0' },

        servers: serverUrl ? [{ url: serverUrl }] : [],
        paths: {},
    })
    const ctx = await getContext(document, renderContext)

    return (
        <ctx.renderer.Root ctx={ctx}>
            <MCPTool
                tool={tool}
                serverUrl={serverUrl}
                hasHead={hasHead}
                headingLevel={2}
                chatExample={chatExample}
                ctx={ctx}
            />
        </ctx.renderer.Root>
    )
}

/**
 * Component for rendering multiple MCP tools from a server
 */
export async function MCPServerPage({
    tools,
    server,
    hasHead = true,
    toolExamples = {},
    renderContext = {},
}: MCPServerPageProps) {
    // Create a basic context for rendering schemas
    const dummyDocument = {
        openapi: '3.1.0',
        info: {
            title: server.title || server.name,
            version: server.version || '1.0.0',
            description: server.description,
        },
        paths: {},
    }

    const document = await processDocument(dummyDocument)
    const ctx = await getContext(document, renderContext)

    let headNode: ReactNode = null

    if (hasHead) {
        const title = server.title || server.name
        headNode = (
            <div className='flex flex-col lg:max-w-[700px]'>
                {heading(1, title, ctx)}
                {server.description && <Markdown text={server.description} />}
                {server.url && (
                    <div className='flex items-center gap-2 mb-4'>
                        <span className='text-sm font-medium'>Server:</span>
                        <code className='text-sm bg-fd-secondary px-2 py-1 rounded'>
                            {server.url}
                        </code>
                    </div>
                )}
                {server.version && (
                    <div className='flex items-center gap-2 mb-6'>
                        <span className='text-sm font-medium'>Version:</span>
                        <span className='text-sm text-fd-muted-foreground'>
                            {server.version}
                        </span>
                    </div>
                )}
            </div>
        )
    }

    return (
        <ctx.renderer.Root ctx={ctx}>
            <div className='space-y-12'>
                {headNode}

                {tools.map((tool, index) => (
                    <MCPTool
                        key={tool.name}
                        tool={tool}
                        serverUrl={server.url}
                        hasHead={true}
                        headingLevel={hasHead ? 2 : 1}
                        chatExample={toolExamples[tool.name]}
                        ctx={ctx}
                    />
                ))}
            </div>
        </ctx.renderer.Root>
    )
}

/**
 * Component for rendering a single MCP tool
 */
export function MCPTool({
    tool,
    serverUrl,
    hasHead = true,
    headingLevel = 2,
    chatExample,

    ctx,
}: MCPToolProps): ReactNode {
    let headNode: ReactNode = null

    if (hasHead) {
        const title = tool.annotations?.title || tool.name

        headNode = (
            <div className='[&>*:first-child]:mt-0'>
                {heading(headingLevel, title, ctx)}
                {tool.description && <Markdown text={tool.description} />}
            </div>
        )
        headingLevel++
    }

    let inputSchemaNode: ReactNode = null
    let outputSchemaNode: ReactNode = null

    // Render input schema if available
    if (tool.inputSchema) {
        inputSchemaNode = (
            <>
                {heading(headingLevel, 'Input Schema', ctx)}
                <Schema
                    name='input'
                    schema={tool.inputSchema as ResolvedSchema}
                    ctx={ctx}
                    as='body'
                    required={true}
                />
            </>
        )
    }

    // Render output schema if available
    if (tool.outputSchema) {
        outputSchemaNode = (
            <>
                {heading(headingLevel, 'Output Schema', ctx)}
                <Schema
                    name='output'
                    schema={tool.outputSchema as ResolvedSchema}
                    ctx={ctx}
                    as='body'
                    required={true}
                />
            </>
        )
    }

    return (
        <div className='flex  flex-col lg:flex-row gap-6'>
            <div className='max-w-[600px] '>
                {/* <CodeExampleProvider examples={[{ key: '1', data: {} }]}>
                    <APIPlayground
                        path={`/tools/${tool.name}`}
                        method={{
                            method: 'POST',
                            operationId: 'xx',
                            requestBody: {
                                content: {
                                    'application/json': {
                                        schema: tool.inputSchema as any,
                                    },
                                },
                            },
                        }}
                        ctx={ctx}
                    />
                </CodeExampleProvider> */}
                <ctx.renderer.APIInfo
                    head={headNode}
                    method='POST'
                    route={tool.name}
                >
                    {/* Tool metadata */}
                    <div className='space-y-3  mb-6'>
                        {tool.annotations?.readOnlyHint !== undefined && (
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='text-sm font-medium'>
                                    Read-only:
                                </span>
                                <span className='text-sm text-fd-muted-foreground'>
                                    {tool.annotations.readOnlyHint
                                        ? 'This tool does not modify its environment'
                                        : 'This tool may modify its environment'}
                                </span>
                            </div>
                        )}

                        {tool.annotations?.destructiveHint !== undefined &&
                            !tool.annotations?.readOnlyHint && (
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className='text-sm font-medium'>
                                        Destructive:
                                    </span>
                                    <span className='text-sm text-fd-muted-foreground'>
                                        {tool.annotations.destructiveHint
                                            ? 'This tool may perform destructive updates'
                                            : 'This tool performs only additive updates'}
                                    </span>
                                </div>
                            )}

                        {tool.annotations?.idempotentHint !== undefined &&
                            !tool.annotations?.readOnlyHint && (
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className='text-sm font-medium'>
                                        Idempotent:
                                    </span>
                                    <span className='text-sm text-fd-muted-foreground'>
                                        {tool.annotations.idempotentHint
                                            ? 'Repeated calls with same arguments have no additional effect'
                                            : 'Repeated calls may have additional effects'}
                                    </span>
                                </div>
                            )}

                        {tool.annotations?.openWorldHint !== undefined && (
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='text-sm font-medium'>
                                    Open-world:
                                </span>
                                <span className='text-sm text-fd-muted-foreground'>
                                    {tool.annotations.openWorldHint
                                        ? 'This tool interacts with external entities'
                                        : 'This tool operates in a closed domain'}
                                </span>
                            </div>
                        )}
                    </div>

                    {inputSchemaNode}
                    {outputSchemaNode}
                </ctx.renderer.APIInfo>
            </div>
            <div className='flex flex-col'>
                {chatExample && (
                    <RightSideTabs
                        messages={chatExample}
                        toolName={tool.name}
                    />
                )}
            </div>
        </div>
    )
}

/**
 * Utility function to create a sample MCP tool for demonstration
 */
/**
 * Utility function to create sample MCP server data
 */
export function createSampleMCPServer() {
    return {
        server: {
            name: 'filesystem',
            title: 'Filesystem MCP Server',
            description:
                'Provides tools for interacting with the local filesystem including reading, writing, and listing files and directories.',
            url: 'mcp://filesystem.local',
            version: '1.2.0',
        },
        tools: [
            createSampleMCPTool(),
            sampleTools.read_file,
            sampleTools.execute_command,
        ],
        toolExamples: {
            search_web: createSampleChatExample(),
        },
    }
}

export function createSampleMCPTool(): Tool {
    return {
        name: 'search_web',
        description: 'Search the web for information using a search engine',
        annotations: {
            title: 'Web Search',
            readOnlyHint: true,
            openWorldHint: true,
            idempotentHint: true,
            destructiveHint: false,
        },
        inputSchema: {
            type: 'object',
            required: ['query'],
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query to execute',
                    minLength: 1,
                    maxLength: 500,
                },
                limit: {
                    type: 'integer',
                    description: 'Maximum number of results to return',
                    minimum: 1,
                    maximum: 20,
                    default: 10,
                },
                include_snippets: {
                    type: 'boolean',
                    description:
                        'Whether to include content snippets in results',
                    default: true,
                },
            },
        },
        outputSchema: {
            type: 'object',
            required: ['results', 'total_count'],
            properties: {
                results: {
                    type: 'array',
                    description: 'Array of search results',
                    items: {
                        type: 'object',
                        required: ['title', 'url'],
                        properties: {
                            title: {
                                type: 'string',
                                description: 'Title of the search result',
                            },
                            url: {
                                type: 'string',
                                description: 'URL of the search result',
                            },
                            snippet: {
                                type: 'string',
                                description: 'Text snippet from the result',
                            },
                        },
                    },
                },
                total_count: {
                    type: 'integer',
                    description: 'Total number of results found',
                },
            },
        },
    }
}

/**
 * Additional sample tools for demonstration
 */
export const sampleTools = {
    read_file: {
        name: 'read_file',
        description: 'Read the contents of a file from the filesystem',
        annotations: {
            title: 'Read File',
            readOnlyHint: true,
            openWorldHint: false,
            idempotentHint: true,
        },
        inputSchema: {
            type: 'object',
            required: ['path'],
            properties: {
                path: {
                    type: 'string',
                    description: 'The file path to read',
                    pattern: '^[^\\0]+$',
                },
                encoding: {
                    type: 'string',
                    description: 'Text encoding to use',
                    enum: ['utf8', 'ascii', 'base64'],
                    default: 'utf8',
                },
            },
        },
        outputSchema: {
            type: 'object',
            required: ['content'],
            properties: {
                content: {
                    type: 'string',
                    description: 'The file contents',
                },
                size: {
                    type: 'integer',
                    description: 'File size in bytes',
                },
            },
        },
    } as Tool,
    execute_command: {
        name: 'execute_command',
        description: 'Execute a shell command and return the output',
        annotations: {
            title: 'Execute Command',
            readOnlyHint: false,
            openWorldHint: true,
            destructiveHint: true,
            idempotentHint: false,
        },
        inputSchema: {
            type: 'object',
            required: ['command'],
            properties: {
                command: {
                    type: 'string',
                    description: 'The shell command to execute',
                    minLength: 1,
                },
                working_directory: {
                    type: 'string',
                    description: 'Working directory for command execution',
                },
                timeout: {
                    type: 'integer',
                    description: 'Timeout in seconds',
                    minimum: 1,
                    maximum: 300,
                    default: 30,
                },
            },
        },
        outputSchema: {
            type: 'object',
            required: ['stdout', 'exit_code'],
            properties: {
                stdout: {
                    type: 'string',
                    description: 'Standard output from the command',
                },
                stderr: {
                    type: 'string',
                    description: 'Standard error output from the command',
                },
                exit_code: {
                    type: 'integer',
                    description: 'Command exit code',
                },
            },
        },
    } as Tool,
}

/**
 * Utility function to create a sample chat example
 */
export function createSampleChatExample(): CoreMessage[] {
    return [
        {
            role: 'user',
            content:
                'Can you search for information about the latest AI developments?',
        },
        {
            role: 'assistant',
            content: [
                {
                    type: 'text',
                    text: "I'll search for the latest AI developments for you.",
                },
                {
                    type: 'tool-call',
                    toolCallId: 'call_1',
                    toolName: 'search_web',
                    args: {
                        query: 'latest AI developments 2024',
                        limit: 5,
                        include_snippets: true,
                    },
                },
            ],
        },
        {
            role: 'tool',
            content: [
                {
                    type: 'tool-result',
                    toolCallId: 'call_1',
                    toolName: 'search_web',
                    result: {
                        results: [
                            {
                                title: 'Breakthrough in Multimodal AI Understanding',
                                url: 'https://example.com/ai-multimodal',
                                snippet:
                                    'Researchers have developed new architectures that seamlessly integrate text, image, and audio processing...',
                            },
                            {
                                title: 'Language Models Show Improved Reasoning',
                                url: 'https://example.com/llm-reasoning',
                                snippet:
                                    'Recent studies demonstrate significant improvements in logical reasoning and mathematical problem solving...',
                            },
                        ],
                        total_count: 150,
                    },
                },
            ],
        },
        {
            role: 'assistant',
            content:
                'Based on my search, here are the latest AI developments:\n\n1. **Multimodal AI Understanding**: Researchers have developed new architectures that seamlessly integrate text, image, and audio processing, leading to more comprehensive AI systems.\n\n2. **Improved Language Model Reasoning**: Recent studies show significant improvements in logical reasoning and mathematical problem solving capabilities.\n\nThese advances are pushing AI towards more human-like understanding and reasoning abilities.',
        },
    ]
}
