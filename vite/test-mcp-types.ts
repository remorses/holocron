import type { Tool, Resource, Prompt } from '@modelcontextprotocol/sdk'

export function example() {
  const tool: Tool = {
    name: "test_tool",
    inputSchema: { type: "object" }
  }
  
  const resource: Resource = {
    uri: "file://test",
    name: "test_resource"
  }
  
  const prompt: Prompt = {
    name: "test_prompt"
  }
  
  return { tool, resource, prompt }
}
