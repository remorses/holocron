/**
 * MCP Documentation Examples
 *
 * This file demonstrates how to use the MCP components to render
 * tool documentation with chat examples.
 */

import {
  MCPPage,
  MCPTool,
  createSampleMCPTool,
  createSampleChatExample,
  sampleTools,
} from './index'
import { getContext } from 'fumadocs-openapi/render/api-page'
import { processDocument } from 'fumadocs-openapi/utils/process-document'
import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { CoreMessage } from 'ai'

/**
 * Example 1: Complete MCP Tool Page
 *
 * Shows how to render a complete page with an MCP tool
 */
export async function CompleteMCPToolExample() {
  const tool = createSampleMCPTool()
  const chatExample = createSampleChatExample()

  return (
    <MCPPage
      tool={tool}
      serverUrl='mcp://localhost:3000'
      hasHead={true}
      chatExample={chatExample}
    />
  )
}

/**
 * Example 2: Individual MCP Tool Component
 *
 * Shows how to use the MCPTool component directly
 */
export async function IndividualMCPToolExample() {
  const tool = sampleTools.read_file

  // Create basic context for rendering
  const dummyDocument = {
    openapi: '3.1.0',
    info: { title: 'MCP Tools', version: '1.0.0' },
    paths: {},
  }

  const document = await processDocument(dummyDocument)
  const ctx = await getContext(document)

  const chatExample: CoreMessage[] = [
    {
      role: 'user',
      content: 'Can you read the contents of config.json?',
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: "I'll read the config.json file for you.",
        },
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'read_file',
          input: {
            path: './config.json',
            encoding: 'utf8',
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
          toolName: 'read_file',
          output: {
            content:
              '{\n  "app_name": "MyApp",\n  "version": "1.0.0",\n  "debug": true\n}',
            size: 75,
          } as any,
        },
      ],
    },
    {
      role: 'assistant',
      content:
        'Here\'s the content of config.json:\n\n```json\n{\n  "app_name": "MyApp",\n  "version": "1.0.0",\n  "debug": true\n}\n```\n\nThe file contains your application configuration with the app name, version, and debug mode enabled.',
    },
  ]

  return (
    <MCPTool
      tool={tool}
      serverUrl='mcp://localhost:3000'
      hasHead={true}
      headingLevel={2}
      chatExample={chatExample}
      ctx={ctx}
    />
  )
}

/**
 * Example 3: Custom MCP Tool
 *
 * Shows how to create and display a custom MCP tool
 */
export async function CustomMCPToolExample() {
  const customTool: Tool = {
    name: 'send_email',
    description: 'Send an email to one or more recipients',
    annotations: {
      title: 'Send Email',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: 'object',
      required: ['to', 'subject', 'body'],
      properties: {
        to: {
          type: 'array',
          items: {
            type: 'string',
            format: 'email',
          },
          description: 'Email recipients',
          minItems: 1,
        },
        cc: {
          type: 'array',
          items: {
            type: 'string',
            format: 'email',
          },
          description: 'CC recipients',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
          minLength: 1,
          maxLength: 200,
        },
        body: {
          type: 'string',
          description: 'Email body content',
          minLength: 1,
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high'],
          description: 'Email priority level',
          default: 'normal',
        },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            required: ['filename', 'content'],
            properties: {
              filename: {
                type: 'string',
                description: 'Attachment filename',
              },
              content: {
                type: 'string',
                description: 'Base64 encoded file content',
              },
              contentType: {
                type: 'string',
                description: 'MIME type of the attachment',
              },
            },
          },
          description: 'Email attachments',
        },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['message_id', 'status'],
      properties: {
        message_id: {
          type: 'string',
          description: 'Unique identifier for the sent email',
        },
        status: {
          type: 'string',
          enum: ['sent', 'queued', 'failed'],
          description: 'Email delivery status',
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'When the email was sent',
        },
      },
    },
  }

  const customChatExample: CoreMessage[] = [
    {
      role: 'user',
      content: 'Send an email to john@example.com about the project update',
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: "I'll send that email for you.",
        },
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'send_email',
          input: {
            to: ['john@example.com'],
            subject: 'Project Update',
            body: 'Hi John,\n\nI wanted to update you on the current project status...',
            priority: 'normal',
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
          toolName: 'send_email',
          output: {
            message_id: 'msg_abc123',
            status: 'sent',
            timestamp: '2024-01-15T10:30:00Z',
          } as any,
        },
      ],
    },
    {
      role: 'assistant',
      content:
        'Email sent successfully! The message was delivered to john@example.com with the subject "Project Update". Message ID: msg_abc123',
    },
  ]

  return (
    <MCPPage
      tool={customTool}
      serverUrl='mcp://api.example.com'
      hasHead={true}
      chatExample={customChatExample}
    />
  )
}

/**
 * Example 4: MCP Tool from Server Response
 *
 * Shows how to use actual MCP server response data
 */
export async function MCPServerResponseExample() {
  // Simulate what you might get from an actual MCP server's listTools call
  const mcpServerTool: Tool = {
    name: 'create_file',
    description: 'Create a new file with the specified content',
    annotations: {
      title: 'Create File',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      required: ['path', 'content'],
      properties: {
        path: {
          type: 'string',
          description: 'The file path where the file should be created',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
        overwrite: {
          type: 'boolean',
          description: 'Whether to overwrite if file exists',
          default: false,
        },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['path', 'size'],
      properties: {
        path: {
          type: 'string',
          description: 'The absolute path of the created file',
        },
        size: {
          type: 'integer',
          description: 'File size in bytes',
        },
        created_at: {
          type: 'string',
          format: 'date-time',
          description: 'File creation timestamp',
        },
      },
    },
  }

  const serverChatExample: CoreMessage[] = [
    {
      role: 'user',
      content: 'Create a README.md file with some basic content',
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: "I'll create a README.md file for you.",
        },
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'create_file',
          input: {
            path: './README.md',
            content:
              '# My Project\n\nThis is a sample project.\n\n## Getting Started\n\nTo get started...',
            overwrite: false,
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
          toolName: 'create_file',
          output: {
            path: '/Users/example/project/README.md',
            size: 75,
            created_at: '2024-01-15T10:30:00Z',
          } as any,
        },
      ],
    },
    {
      role: 'assistant',
      content:
        'Successfully created README.md! The file is 75 bytes and contains basic project information.',
    },
  ]

  return (
    <MCPPage
      tool={mcpServerTool}
      serverUrl='mcp://filesystem.local'
      hasHead={true}
      chatExample={serverChatExample}
    />
  )
}

/**
 * Example 5: Minimal MCP Tool Display
 *
 * Shows the simplest way to display an MCP tool
 */
export async function MinimalMCPExample() {
  const simpleTool: Tool = {
    name: 'ping',
    description: 'Simple ping tool to test connectivity',
    inputSchema: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Hostname or IP address to ping',
          default: 'localhost',
        },
      },
    },
  }

  return <MCPPage tool={simpleTool} hasHead={false} />
}

// Example usage in documentation:
/*
// 1. Complete MCP tool page
const MyMCPPage = () => {
  return <CompleteMCPToolExample />;
};

// 2. Individual tool component
const SingleTool = () => {
  return <IndividualMCPToolExample />;
};

// 3. Custom tool
const CustomTool = () => {
  return <CustomMCPToolExample />;
};

// 4. Server response
const ServerTool = () => {
  return <MCPServerResponseExample />;
};

// 5. Minimal display
const MinimalTool = () => {
  return <MinimalMCPExample />;
};
*/
