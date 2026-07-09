/**
 * Public API for the Holocron AI Chat widget.
 *
 * Usage:
 *   import { ChatWidget, useChatWidget, defineTool, pageTools } from '@holocron.so/vite/chat'
 *
 *   <ChatWidget domain="docs.myapp.com" tools={[...]} context={{}} />
 */

export { ChatWidget } from './chat-widget.tsx'
export type { ChatWidgetProps } from './chat-widget.tsx'
export { useChatWidget } from './use-chat-widget.ts'
export type { ChatWidgetConfig } from './chat-widget-store.ts'
export type { ChatMessage, ChatPart } from './chat-store.ts'
export { defineTool } from './define-tool.ts'
export type { ChatToolDefinition, ChatToolSchema, ToolApprovalCheck } from './define-tool.ts'
export { pageTools } from './page-tools.ts'
export type { PageDefinition, PageAction, PageToolsOptions } from './page-tools.ts'
