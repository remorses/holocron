# MCP Demo Website

A demonstration website showcasing Fumadocs OpenAPI MCP (Model Context Protocol) components using real MCP tools.

## Overview

This demo website displays real filesystem MCP tools commonly used with AI agents, complete with:
- **Interactive Chat Examples**: Realistic conversations showing tool usage
- **Schema Rendering**: Tool input schemas using Fumadocs OpenAPI components  
- **Professional Styling**: Built with Tailwind CSS and Fumadocs UI
- **Workspace Integration**: Uses `fumadocs-openapi` workspace package

## Featured Tools

### 🔍 **read_file** 
Read complete contents of files from the filesystem
- Shows reading package.json to explore available scripts
- Demonstrates file content parsing and explanation

### ✏️ **write_file**
Write content to files, creating or overwriting as needed
- Example: Creating a README.md file with project structure
- Shows successful file creation with size confirmation

### 📁 **list_directory**
List directory contents with detailed information
- Explores project structure with file sizes and modification dates
- Shows both files and directories with metadata

### 🔍 **search_files**
Search for files using patterns within directory trees
- Pattern matching for finding specific file types
- Recursive search with configurable depth

### ⚡ **execute_command**
Execute shell commands in the system
- Example: Checking Git repository status
- Shows command output parsing and interpretation

## Quick Start

```bash
# From the fumadocs root directory
pnpm install

# Build the openapi package (contains MCP components)
cd packages/openapi && pnpm build

# Start the demo website
cd ../mcp-demo && pnpm dev
```

The demo will be available at `http://localhost:3001`

### Project Structure
```
demo-website/
├── src/
│   ├── App.tsx          # Main component with MCP tools
│   ├── main.tsx         # React entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
└── package.json         # Dependencies and scripts
```

## Development Server

The demo runs on `http://localhost:3001` to avoid conflicts with other development servers.

## Integration

This demo shows how to integrate MCP components into a real application:

1. **Import MCP Components**: `import { MCPPage } from 'fumadocs-openapi/mcp'`
2. **Define Tools**: Create tool definitions matching MCP tool schema
3. **Create Chat Examples**: Provide realistic conversation examples
4. **Render Documentation**: Use `MCPPage` component to display everything

## Real-World Usage

The tools demonstrated are based on actual MCP implementations:

- **Filesystem Tools**: Common for file management tasks
- **Command Execution**: Useful for development workflows  
- **Search Capabilities**: Essential for code exploration
- **Realistic Schemas**: Match real MCP tool specifications

## Styling

Uses Fumadocs UI theme system for consistent styling with:
- Dark/light mode support
- Responsive breakpoints
- Consistent typography
- Proper color scheme integration

This demo serves as both a showcase and a template for implementing MCP tool documentation in real applications.