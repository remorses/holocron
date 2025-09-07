import { tool } from 'ai'
import z from 'zod'

export const INVALID_TOOL_NAME = 'invalidTool'

export const invalidToolInputSchema = z.object({
  tool: z.string(),
  error: z.string(),
})

export const invalidToolDescription = "Internal tool. Do not use"

export type InvalidToolInput = z.infer<typeof invalidToolInputSchema>
export type InvalidToolOutput = string

export function createInvalidTool(tools: Record<string, any>) {
  const invalidTool = tool({
    description: invalidToolDescription,
    inputSchema: invalidToolInputSchema,
    async execute(params) {
      if (!Object.prototype.hasOwnProperty.call(tools, params.tool)) {
        return `${params.tool} does not exist in tools, available tools are ${Object.keys(tools).filter(x => x !== INVALID_TOOL_NAME)}`
      }
      return `Error! The arguments provided to the tool ${params.tool} are invalid, try again: ${params.error}`
    },
  })

  const repairToolCall = async (input: any) => {
    return {
      ...input.toolCall,
      input: JSON.stringify({
        tool: input.toolCall.toolName,
        error: input.error.message,
      }),
      toolName: INVALID_TOOL_NAME,
    }
  }

  return {
    invalidTool,
    repairToolCall,
  }
}