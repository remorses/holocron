import { MCPServerPage } from 'fumadocs-mcp/src'
import type { Tool, CoreMessage } from 'fumadocs-mcp/src'
import { Chat } from './chat'

// Real MCP server information
const mcpServer = {
  name: 'filesystem',
  title: 'Filesystem MCP Server',
  description:
    'A comprehensive Model Context Protocol server that provides tools for interacting with the local filesystem. This server enables AI assistants to read, write, list, and search files and directories, as well as execute system commands safely.',
  url: 'mcp://filesystem.local',
  version: '2.1.0',
}

// Real MCP tool examples based on commonly available MCP tools
const realMCPTools: Tool[] = [
  {
    name: 'read_file',
    description:
      'Read the complete contents of a file from the filesystem. This tool can handle various text file formats and encodings.',
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
          description: 'Absolute or relative path to the file to read',
          examples: ['/home/user/document.txt', './src/index.js', 'README.md'],
        },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['content', 'size'],
      properties: {
        content: {
          type: 'string',
          description: 'The complete file contents as a string',
        },
        size: {
          type: 'integer',
          description: 'File size in bytes',
        },
        encoding: {
          type: 'string',
          description: 'Character encoding used to read the file',
          default: 'utf-8',
        },
        lastModified: {
          type: 'string',
          format: 'date-time',
          description: 'ISO timestamp of when the file was last modified',
        },
      },
    },
  },
  {
    name: 'write_file',
    description:
      "Write content to a file, creating it if it doesn't exist or overwriting if it does. This tool handles text content and ensures proper file encoding.",
    annotations: {
      title: 'Write File',
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
          description:
            'Absolute or relative path where the file should be written',
          examples: ['/tmp/output.txt', './config.json', 'docs/README.md'],
        },
        content: {
          type: 'string',
          description: 'The text content to write to the file',
        },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['success', 'path'],
      properties: {
        success: {
          type: 'boolean',
          description: 'Whether the file was written successfully',
        },
        path: {
          type: 'string',
          description: 'Absolute path to the written file',
        },
        size: {
          type: 'integer',
          description: 'Number of bytes written to the file',
        },
        created: {
          type: 'boolean',
          description:
            'Whether a new file was created (true) or existing file was overwritten (false)',
        },
        timestamp: {
          type: 'string',
          format: 'date-time',
          description: 'ISO timestamp of when the file was written',
        },
      },
    },
  },
  {
    name: 'list_directory',
    description:
      'List the contents of a directory, showing files and subdirectories. Can optionally show hidden files and provide detailed information.',
    annotations: {
      title: 'List Directory',
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
          description: 'Path to the directory to list',
          examples: ['/home/user', './src', '.'],
        },
        show_hidden: {
          type: 'boolean',
          description: 'Whether to include hidden files (starting with .)',
          default: false,
        },
        detailed: {
          type: 'boolean',
          description:
            'Show detailed information including size, permissions, and modification time',
          default: false,
        },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['path', 'entries'],
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path of the listed directory',
        },
        entries: {
          type: 'array',
          description: 'List of directory entries',
          items: {
            type: 'object',
            required: ['name', 'type'],
            properties: {
              name: {
                type: 'string',
                description: 'Name of the file or directory',
              },
              type: {
                type: 'string',
                enum: ['file', 'directory', 'symlink'],
                description: 'Type of the entry',
              },
              size: {
                type: 'integer',
                description: 'Size in bytes (for files)',
              },
              modified: {
                type: 'string',
                format: 'date-time',
                description: 'Last modification time',
              },
              permissions: {
                type: 'string',
                description: 'File permissions in octal format (e.g., "755")',
              },
            },
          },
        },
        totalCount: {
          type: 'integer',
          description: 'Total number of entries found',
        },
      },
    },
  },
  {
    name: 'search_files',
    description:
      'Search for files matching a pattern within a directory tree. Supports glob patterns and regular expressions for flexible file discovery.',
    annotations: {
      title: 'Search Files',
      readOnlyHint: true,
      openWorldHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      type: 'object',
      required: ['pattern'],
      properties: {
        pattern: {
          type: 'string',
          description: 'File search pattern (glob or regex)',
          examples: ['*.js', '**/*.tsx', 'test.*', '^config\\.'],
        },
        directory: {
          type: 'string',
          description: 'Directory to search in (defaults to current directory)',
          default: '.',
        },
        max_depth: {
          type: 'integer',
          description: 'Maximum directory depth to search',
          minimum: 1,
          maximum: 10,
          default: 5,
        },
        case_sensitive: {
          type: 'boolean',
          description: 'Whether the search should be case sensitive',
          default: false,
        },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['matches', 'searchPattern'],
      properties: {
        matches: {
          type: 'array',
          description: 'Array of matching file paths',
          items: {
            type: 'object',
            required: ['path', 'relativePath'],
            properties: {
              path: {
                type: 'string',
                description: 'Absolute path to the matching file',
              },
              relativePath: {
                type: 'string',
                description: 'Path relative to the search directory',
              },
              size: {
                type: 'integer',
                description: 'File size in bytes',
              },
              modified: {
                type: 'string',
                format: 'date-time',
                description: 'Last modification time',
              },
            },
          },
        },
        searchPattern: {
          type: 'string',
          description: 'The pattern that was used for searching',
        },
        searchDirectory: {
          type: 'string',
          description: 'The directory that was searched',
        },
        totalMatches: {
          type: 'integer',
          description: 'Total number of matching files found',
        },
      },
    },
  },
  {
    name: 'execute_command',
    description:
      'Execute a shell command in the system. Useful for running build scripts, system utilities, or other command-line tools. Returns both stdout and stderr.',
    annotations: {
      title: 'Execute Command',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: 'object',
      required: ['command'],
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
          examples: [
            'ls -la',
            'npm run build',
            'git status',
            'python --version',
          ],
        },
        working_directory: {
          type: 'string',
          description:
            'Directory to run the command in (defaults to current directory)',
        },
        timeout: {
          type: 'integer',
          description: 'Command timeout in seconds',
          minimum: 1,
          maximum: 300,
          default: 30,
        },
        capture_output: {
          type: 'boolean',
          description: 'Whether to capture and return command output',
          default: true,
        },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['exitCode', 'stdout'],
      properties: {
        exitCode: {
          type: 'integer',
          description: 'Command exit code (0 for success)',
        },
        stdout: {
          type: 'string',
          description: 'Standard output from the command',
        },
        stderr: {
          type: 'string',
          description: 'Standard error output from the command',
        },
        command: {
          type: 'string',
          description: 'The command that was executed',
        },
        workingDirectory: {
          type: 'string',
          description: 'Directory where the command was executed',
        },
        executionTime: {
          type: 'number',
          description: 'Command execution time in milliseconds',
        },
        timedOut: {
          type: 'boolean',
          description: 'Whether the command timed out',
        },
      },
    },
  },
]

// Real chat examples showing actual MCP tool usage
const realChatExamples: Record<string, CoreMessage[]> = {
  read_file: [
    {
      role: 'user',
      content:
        'Can you read the package.json file and tell me what scripts are available?',
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: "I'll read the package.json file to see what scripts are available.",
        },
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'read_file',
          args: {
            path: './package.json',
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
          result: {
            content:
              '{\n  "name": "my-project",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "test": "vitest",\n    "lint": "eslint ."\n  }\n}',
          },
        },
      ],
    },
    {
      role: 'assistant',
      content:
        'Based on the package.json file, here are the available scripts:\n\n• **dev** - `vite` (starts development server)\n• **build** - `vite build` (builds for production)\n• **test** - `vitest` (runs tests)\n• **lint** - `eslint .` (lints the codebase)\n\nYou can run these using `npm run <script-name>` or `pnpm <script-name>`.',
    },
  ],

  write_file: [
    {
      role: 'user',
      content: 'Create a simple README.md file for a new project',
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: "I'll create a basic README.md file for your project.",
        },
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'write_file',
          args: {
            path: './README.md',
            content:
              '# My Project\n\nA brief description of what this project does.\n\n## Installation\n\n```bash\nnpm install\n```\n\n## Usage\n\n```bash\nnpm run dev\n```\n\n## Contributing\n\nPull requests are welcome!',
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
          toolName: 'write_file',
          result: {
            success: true,
            path: './README.md',
            size: 156,
          },
        },
      ],
    },
    {
      role: 'assistant',
      content:
        "Perfect! I've created a README.md file with the basic structure including:\n\n• Project title and description\n• Installation instructions\n• Usage example\n• Contributing guidelines\n\nThe file is 156 bytes and ready for you to customize with your specific project details.",
    },
  ],

  list_directory: [
    {
      role: 'user',
      content: "Show me what's in the src directory",
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: "I'll list the contents of the src directory for you.",
        },
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'list_directory',
          args: {
            path: './src',
            detailed: true,
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
          toolName: 'list_directory',
          result: {
            files: [
              {
                name: 'index.ts',
                type: 'file',
                size: 1250,
                modified: '2024-01-15T10:30:00Z',
              },
              {
                name: 'components',
                type: 'directory',
                size: 4096,
                modified: '2024-01-15T09:15:00Z',
              },
              {
                name: 'utils.ts',
                type: 'file',
                size: 890,
                modified: '2024-01-14T16:20:00Z',
              },
              {
                name: 'types.ts',
                type: 'file',
                size: 456,
                modified: '2024-01-14T14:45:00Z',
              },
            ],
          },
        },
      ],
    },
    {
      role: 'assistant',
      content:
        "Here's what's in the src directory:\n\n📁 **components/** (directory, modified Jan 15 09:15)\n📄 **index.ts** (1.25 KB, modified Jan 15 10:30)\n📄 **types.ts** (456 bytes, modified Jan 14 14:45) \n📄 **utils.ts** (890 bytes, modified Jan 14 16:20)\n\nYou have a mix of TypeScript files and a components directory. The main entry point appears to be index.ts.",
    },
  ],

  execute_command: [
    {
      role: 'user',
      content: 'Check the Git status of this repository',
    },
    {
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: "I'll check the Git status to see what changes are in the repository.",
        },
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'execute_command',
          args: {
            command: 'git status --porcelain',
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
          toolName: 'execute_command',
          result: {
            stdout: 'M  src/index.ts\nA  src/new-feature.ts\n?? temp.log',
            stderr: '',
            exit_code: 0,
          },
        },
      ],
    },
    {
      role: 'assistant',
      content:
        "Here's the current Git status:\n\n🔄 **Modified**: `src/index.ts` (has uncommitted changes)\n➕ **Added**: `src/new-feature.ts` (staged for commit)\n❓ **Untracked**: `temp.log` (not in Git)\n\nYou have one modified file, one file ready to commit, and one untracked file. You might want to commit your staged changes or add the untracked file if needed.",
    },
  ],
}

export default async function Page() {
  return (
    <div className='dark p-6 bg-black min-h-screen flex prose prose-invert flex-col items-center bg-background'>
      <MCPServerPage
        server={mcpServer}
        tools={realMCPTools.slice(0, 10)}
        hasHead={true}
        toolExamples={realChatExamples}
      />
    </div>
  )
}
