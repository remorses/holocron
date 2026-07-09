/**
 * Client-side tool definition for the Holocron AI chat widget.
 *
 * Tools defined here run in the browser, not on the server. The model
 * calls them during a conversation, the widget executes them locally,
 * and sends results back to continue the conversation.
 *
 * Custom tools are auto-registered on `document.modelContext` (the WebMCP
 * standard) so browser AI agents can discover them. On browsers without
 * native support, a minimal polyfill is installed. Browser automation
 * tools from `pageTools()` are NOT registered on modelContext; they stay
 * internal to the holocron chat widget.
 *
 * Usage:
 *   import { defineTool } from '@holocron.so/vite/chat'
 *   import { z } from 'zod'
 *
 *   // Auto-registered on document.modelContext for agent discovery
 *   const timeTool = defineTool({
 *     name: 'get_time',
 *     description: 'Get the current time',
 *     input: z.object({}),
 *     async run() {
 *       return { time: new Date().toISOString() }
 *     },
 *   })
 *
 *   // Cleanup when no longer needed
 *   unregisterTool('get_time')
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

// ── document.modelContext polyfill + internal registry ───────────────
//
// The internal Map stores full ChatToolDefinition objects (with needsApproval,
// our run() shape, etc.). document.modelContext stores the WebMCP-standard
// shape so external browser agents can discover tools.

/**
 * Internal registry — full extended definitions for the chat widget.
 * Stored on globalThis so the registry is shared across all module instances
 * (package code and user code may be in separate client bundles in RSC).
 */
const REGISTRY_KEY = '__holocron_tool_registry__'
function getToolRegistry(): Map<string, ChatToolDefinition> {
  if (typeof globalThis !== 'undefined') {
    if (!(REGISTRY_KEY in globalThis)) {
      ;(globalThis as any)[REGISTRY_KEY] = new Map<string, ChatToolDefinition>()
    }
    return (globalThis as any)[REGISTRY_KEY]
  }
  return new Map()
}

/** WebMCP-standard tool shape for document.modelContext. */
type ModelContextTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (input: Record<string, unknown>) => Promise<unknown>
}

type ModelContext = {
  registerTool: (tool: ModelContextTool) => void
  unregisterTool: (name: string) => void
  getTools: () => ModelContextTool[]
}

/** Install the polyfill if document.modelContext is not natively available. */
function ensureModelContext(): ModelContext | null {
  if (typeof document === 'undefined') return null
  if (!('modelContext' in document)) {
    const tools = new Map<string, ModelContextTool>()
    ;(document as any).modelContext = {
      registerTool(tool: ModelContextTool) {
        tools.set(tool.name, tool)
      },
      unregisterTool(name: string) {
        tools.delete(name)
      },
      getTools() {
        return [...tools.values()]
      },
    } satisfies ModelContext
  }
  return (document as any).modelContext as ModelContext
}

/** Adapt a ChatToolDefinition to the WebMCP-standard shape. */
function toModelContextTool(tool: ChatToolDefinition): ModelContextTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputJsonSchema,
    async execute(input) {
      const result = await tool.run({ input })
      const text = typeof result === 'string' ? result : JSON.stringify(result)
      return { content: [{ type: 'text', text }] }
    },
  }
}

/**
 * Register a tool on document.modelContext and the internal registry.
 * Called automatically by defineTool(). Can also be called directly for
 * tools created without defineTool() (e.g. from ChatWidget props).
 */
export function registerToolOnModelContext(tool: ChatToolDefinition): void {
  getToolRegistry().set(tool.name, tool)
  const ctx = ensureModelContext()
  if (ctx) ctx.registerTool(toModelContextTool(tool))
}

/**
 * Remove a tool from document.modelContext and the internal registry.
 */
export function unregisterTool(name: string): void {
  getToolRegistry().delete(name)
  const ctx = ensureModelContext()
  if (ctx) ctx.unregisterTool(name)
}

/**
 * Get all tools registered via defineTool() / registerToolOnModelContext().
 * Returns full ChatToolDefinition objects (with needsApproval, run, etc.).
 */
export function getRegisteredTools(): ChatToolDefinition[] {
  return [...getToolRegistry().values()]
}

/**
 * Discover tools registered on the native document.modelContext by third-party
 * code (not through defineTool()). Adapts the WebMCP execute(input) shape into
 * our ChatToolDefinition run({input}) shape. Tools already in our internal
 * registry are excluded to avoid duplicates.
 */
export function getNativeModelContextTools(): ChatToolDefinition[] {
  if (typeof document === 'undefined' || !('modelContext' in document)) return []
  const ctx = (document as any).modelContext as ModelContext
  const registry = getToolRegistry()
  const tools: ChatToolDefinition[] = []
  for (const native of ctx.getTools()) {
    // Skip tools we registered ourselves (already in the internal registry)
    if (registry.has(native.name)) continue
    tools.push({
      name: native.name,
      description: native.description,
      inputJsonSchema: native.inputSchema,
      async run({ input }) {
        const result = await native.execute(input)
        // WebMCP returns { content: [{ type, text }] }; flatten to plain text
        if (result && typeof result === 'object' && 'content' in result) {
          const parts = (result as any).content
          if (Array.isArray(parts)) {
            return parts.map((p: any) => p.text ?? JSON.stringify(p)).join('\n')
          }
        }
        return result
      },
    })
  }
  return tools
}

// ── defineTool ──────────────────────────────────────────────────────

/**
 * Define a client-side tool with a Zod input schema.
 *
 * The schema is converted to JSON Schema via `z.toJSONSchema()` and sent
 * to the gateway. The `run` function executes in the browser when the
 * model calls this tool.
 *
 * The tool is automatically registered on `document.modelContext` (the
 * WebMCP standard) so browser AI agents can discover it. Call
 * `unregisterTool(name)` to remove it.
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
  const tool: ChatToolDefinition = {
    name,
    description,
    inputJsonSchema: withDescriptionProperty(z.toJSONSchema(input)),
    run: run as ChatToolDefinition['run'],
    needsApproval: needsApproval as ChatToolDefinition['needsApproval'],
  }
  registerToolOnModelContext(tool)
  return tool
}
