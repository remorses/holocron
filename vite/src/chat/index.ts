/**
 * Public API for the Holocron AI Chat widget.
 *
 * Usage:
 *   import { ChatWidget, useChatWidget } from '@holocron.so/vite/chat'
 *
 *   <ChatWidget domain="docs.myapp.com" />
 */

export { ChatWidget } from './chat-widget.tsx'
export type { ChatWidgetProps } from './chat-widget.tsx'
export { useChatWidget } from './use-chat-widget.ts'
export type { ChatWidgetConfig } from './chat-widget-store.ts'
export type { ChatMessage, ChatPart } from './chat-store.ts'
