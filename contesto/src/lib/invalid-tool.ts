import { LanguageModelV2ToolCall } from '@ai-sdk/provider'
import { tool, ToolCallRepairFunction } from 'ai'
import z from 'zod'

export const INVALID_TOOL_NAME = 'invalidTool'

export const invalidToolInputSchema = z.object({
  tool: z.string(),
  error: z.string(),
})

export const invalidToolDescription = "Internal tool. Do not use"

export type InvalidToolInput = z.infer<typeof invalidToolInputSchema>
export type InvalidToolOutput = string

// taken from https://github.com/sst/opencode/blob/93c2f5060e2391e9a579cc9e0d5065d205ca412a/packages/opencode/src/tool/invalid.ts#L11
export function createInvalidTool(tools: Record<string, any>) {
  const invalidTool = tool({
    description: invalidToolDescription,
    inputSchema: invalidToolInputSchema,
    async execute(params) {
      if (!params.tool || !(params.tool in tools)) {
        throw new Error(`${JSON.stringify(params.tool)} does not exist in tools. Available tools: ${Object.keys(tools).filter(x => x !== INVALID_TOOL_NAME).join(', ')}`)
      }
      throw new Error(`Error! The arguments provided to the tool ${params.tool} are invalid, fix them and try again: ${params.error}`)
      return {}
    },
  })

  const repairToolCall: ToolCallRepairFunction<any> = async (input) => {
    const lower = input.toolCall.toolName.toLowerCase()
    if (lower !== input.toolCall.toolName && tools[lower]) {
      return {
        ...input.toolCall,
        toolName: lower,
      }
    }
    return {
      ...input.toolCall,
      input: JSON.stringify({
        tool: input.toolCall.toolName || '',
        error: String(input.error.message || ''),
      }),
      toolName: INVALID_TOOL_NAME,
    }
  }

  return {
    invalidTool,
    repairToolCall,
  }
}
