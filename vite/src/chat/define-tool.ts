/**
 * Client-side tool definition for the Holocron AI chat widget.
 *
 * Tools defined here run in the browser, not on the server. The model
 * calls them during a conversation, the widget executes them locally,
 * and sends results back to continue the conversation.
 *
 * Usage:
 *   import { defineTool } from '@holocron.so/vite/chat'
 *   import { z } from 'zod'
 *
 *   const timeTool = defineTool({
 *     name: 'get_time',
 *     description: 'Get the current time',
 *     input: z.object({}),
 *     async run() {
 *       return { time: new Date().toISOString() }
 *     },
 *   })
 */

'use client'

import { z } from 'zod'

/** Tool names reserved for server-side tools. Client tools cannot use these. */
const RESERVED_TOOL_NAMES = new Set(['bash'])

/** Validates that a tool name is alphanumeric/underscore/hyphen and not reserved. */
function validateToolName(name: string): void {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name)) {
    throw new Error(`Invalid tool name "${name}": must be 1-64 alphanumeric, underscore, or hyphen characters`)
  }
  if (RESERVED_TOOL_NAMES.has(name)) {
    throw new Error(`Tool name "${name}" is reserved for server-side use`)
  }
}

/** Schema sent to the gateway so AI SDK can register a manual tool. */
export type ChatToolSchema = {
  name: string
  description: string
  inputJsonSchema: Record<string, unknown>
}

/**
 * Shared `description` input property injected into every tool's input schema.
 * The model fills it with a short human readable summary of the action, and
 * the chat UI shows it as the tool call label (and in approval prompts).
 */
export const toolDescriptionProperty = {
  description: {
    type: 'string',
    description:
      'Short human readable description of this action shown to the user, e.g. "Click the Delete account button"',
  },
} as const

/**
 * Add the shared `description` property to a JSON schema object unless the
 * tool already defines its own. Also marks it required so the model always
 * provides a label for the UI.
 */
export function withDescriptionProperty(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (schema.type !== 'object') return schema
  const properties = (schema.properties ?? {}) as Record<string, unknown>
  if ('description' in properties) return schema
  const required = Array.isArray(schema.required) ? schema.required : []
  return {
    ...schema,
    properties: { ...properties, ...toolDescriptionProperty },
    required: [...required, 'description'],
  }
}

/** Result of a needsApproval check. `true` or an object means approval is
 *  required; the object can carry a custom confirmation message shown to
 *  the user (e.g. from a data-holocron-requires-approval attribute). */
export type ToolApprovalCheck = boolean | { message?: string }

/** Full client-side tool definition with schema + execution function. */
export type ChatToolDefinition = ChatToolSchema & {
  run: (args: { input: Record<string, unknown> }) => Promise<unknown>
  /** When true (or a function returning true / an object), the widget shows
   *  an Approve/Deny prompt before executing the tool. Mirrors the AI SDK's
   *  needsApproval naming. Denial is sent back to the model as a tool error. */
  needsApproval?:
    | boolean
    | ((args: { input: Record<string, unknown> }) => ToolApprovalCheck | Promise<ToolApprovalCheck>)
}

/**
 * Define a client-side tool with a Zod input schema.
 *
 * The schema is converted to JSON Schema via `z.toJSONSchema()` and sent
 * to the gateway. The `run` function executes in the browser when the
 * model calls this tool.
 *
 * Tool names must be 1-64 alphanumeric/underscore/hyphen characters.
 * The name "bash" is reserved for the server-side docs search tool.
 *
 * A `description` string property is automatically added to the input schema
 * (unless the schema already defines one): the model fills it with a short
 * human readable summary shown as the tool call label in the chat UI. The
 * field is passed to `run` inside `input` — tools can simply ignore it.
 */
export function defineTool<T extends z.ZodObject<any>>({
  name,
  description,
  input,
  run,
  needsApproval,
}: {
  name: string
  description: string
  input: T
  run: (args: { input: z.infer<T> }) => Promise<unknown>
  needsApproval?:
    | boolean
    | ((args: { input: z.infer<T> }) => ToolApprovalCheck | Promise<ToolApprovalCheck>)
}): ChatToolDefinition {
  validateToolName(name)
  return {
    name,
    description,
    inputJsonSchema: withDescriptionProperty(z.toJSONSchema(input)),
    run: run as ChatToolDefinition['run'],
    needsApproval: needsApproval as ChatToolDefinition['needsApproval'],
  }
}
