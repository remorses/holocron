# MCP (Model Context Protocol) Documentation Components

This directory contains components for rendering MCP tool documentation, similar to OpenAPI documentation but specifically designed for MCP tools.

## Components

### `MCPPage`
Main component for rendering a complete page with multiple MCP tools. Similar to `APIPage` but for MCP tools.

**Props:**
- `tools: Tool[]` - Array of MCP tools to display
- `serverUrl?: string` - MCP server URL to display 
- `hasHead?: boolean` - Whether to include page header
- `toolExamples?: Record<string, CoreMessage[]>` - Chat examples for each tool
- `renderContext?: Partial<RenderContext>` - Custom rendering context

### `MCPTool`
Component for rendering a single MCP tool with its schema and chat examples.

**Props:**
- `tool: Tool` - The MCP tool definition
- `serverUrl?: string` - MCP server URL
- `hasHead?: boolean` - Whether to include tool header
- `headingLevel?: number` - HTML heading level
- `chatExample?: CoreMessage[]` - Chat messages showing tool usage
- `ctx: RenderContext` - Rendering context

### `ChatExample`
Component for displaying chat conversation examples showing how tools are used.

**Props:**
- `messages: CoreMessage[]` - Array of chat messages
- `toolName: string` - Tool name for context

## Features

### Tool Input Schema Rendering
- Renders MCP tool input schemas using the same mechanism as OpenAPI request bodies
- Supports JSON Schema validation rules (required fields, types, constraints)
- Shows field descriptions, defaults, and validation rules

### Chat Examples
- Displays example conversations showing tool usage
- Shows user messages, assistant responses, and tool calls
- Supports the AI SDK's `CoreMessage` format
- Renders tool call arguments and results

### Tool Metadata Display
- Shows tool name, description, and annotations
- Displays server URL and tool type
- Shows read-only and open-world hints
- Clean layout with proper styling

## Usage Examples

### Basic MCP Tools Page

```tsx
import { MCPPage, createSampleMCPTools, createSampleChatExamples } from 'fumadocs-openapi/mcp';

export function MyMCPPage() {
  const tools = createSampleMCPTools();
  const chatExamples = createSampleChatExamples();

  return (
    <MCPPage
      tools={tools}
      serverUrl="mcp://localhost:3000"
      hasHead={true}
      toolExamples={chatExamples}
    />
  );
}
```

### Individual Tool Display

```tsx
import { MCPTool } from 'fumadocs-openapi/mcp';

export async function SingleTool() {
  const tool = {
    name: 'search_web',
    description: 'Search the web for information',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
      },
    },
  };

  const chatExample = [
    {
      role: 'user',
      content: 'Search for AI news',
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'I\'ll search for AI news.',
        },
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'search_web',
          args: { query: 'AI news' },
        },
      ],
    },
  ];

  const ctx = await createRenderContext({});
  
  return (
    <MCPTool
      tool={tool}
      serverUrl="mcp://example.com"
      chatExample={chatExample}
      ctx={ctx}
    />
  );
}
```

### Custom Tools with Complex Schema

```tsx
import { MCPPage } from 'fumadocs-openapi/mcp';

export function CustomMCPTools() {
  const customTools = [
    {
      name: 'send_email',
      description: 'Send an email to recipients',
      annotations: {
        title: 'Send Email',
        readOnlyHint: false,
      },
      inputSchema: {
        type: 'object',
        required: ['to', 'subject', 'body'],
        properties: {
          to: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            description: 'Email recipients',
          },
          subject: {
            type: 'string',
            description: 'Email subject',
            maxLength: 200,
          },
          body: {
            type: 'string',
            description: 'Email content',
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high'],
            default: 'normal',
          },
        },
      },
    },
  ];

  return (
    <MCPPage
      tools={customTools}
      serverUrl="mcp://email.service.com"
    />
  );
}
```

## Integration with MCP Servers

The components are designed to work with actual MCP server responses:

```tsx
// Example using MCP client
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

export async function LiveMCPPage() {
  // Connect to MCP server
  const client = new Client({
    name: 'my-client',
    version: '1.0.0',
  });
  
  // Get tools from server
  const response = await client.listTools();
  
  return (
    <MCPPage
      tools={response.tools}
      serverUrl="mcp://your-server.com"
      hasHead={true}
    />
  );
}
```

## Styling

The components use Fumadocs UI styling and are fully compatible with:
- Light/dark theme support
- Responsive design
- Consistent typography and spacing
- Tailwind CSS classes

## Type Safety

All components are fully typed with TypeScript:
- `Tool` type from MCP SDK
- `CoreMessage` type from AI SDK
- `RenderContext` from Fumadocs OpenAPI
- Proper schema validation types

## Comparison with OpenAPI Components

| Feature | OpenAPI | MCP |
|---------|---------|-----|
| **Input** | OpenAPI spec | MCP tools list |
| **Schema** | Request/response body | Tool input schema |
| **Examples** | Code samples | Chat conversations |
| **Layout** | Operation-focused | Tool-focused |
| **Protocol** | HTTP REST | MCP protocol |

Both share the same underlying rendering infrastructure for schemas and UI components.