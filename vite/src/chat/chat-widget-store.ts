/**
 * Chat widget config store — vanilla zustand state for the standalone
 * ChatWidget component. Holds configuration that differs between the
 * holocron integration path and the external widget path.
 *
 * In holocron: initialized by HolocronChatBridge with values from useHolocronData.
 * In standalone widget: initialized by ChatWidget with the user-provided domain.
 */

import { createStore } from 'zustand'
import type { ChatToolDefinition } from './define-tool.ts'
import type { StoredChatSession } from './chat-sessions.ts'

export type ChatWidgetConfig = {
  /** Full API URL for chat requests (e.g. "https://docs.myapp.com/holocron-api/chat") */
  chatApiUrl: string
  /** Current page slug for context (e.g. "/quickstart") */
  currentSlug: string
  /** Site name shown in welcome message */
  siteName: string
  /** Portal target for drawers/tooltips (shadow mount container or document.body) */
  portalTarget: HTMLElement | null
  /** Client-side tools that execute in the browser when the model calls them. */
  tools: ChatToolDefinition[]
  /** Arbitrary context object injected into the system prompt as XML. */
  context: Record<string, unknown>
  /** Persistent chat session id (chs_...). In embedded mode read from the
   *  JS-readable cookie on page load; in cross-origin widget mode loaded
   *  from/persisted to localStorage. */
  sessionId: string | null
  /** Past sessions for this site (mirrored from localStorage by
   *  chat-sessions.ts) so the drawer's session select can list them. */
  sessions: StoredChatSession[]
  /** Client-side navigation function used by browser_navigate tool.
   *  Set by HolocronChatBridge (router.push) or ChatWidget prop. */
  navigate: (path: string) => void | Promise<void>
}

export const chatWidgetStore = createStore<ChatWidgetConfig>(() => ({
  chatApiUrl: '',
  currentSlug: '/',
  siteName: '',
  portalTarget: null,
  tools: [],
  context: {},
  sessionId: null,
  sessions: [],
  navigate: (path: string) => {
    // Default: pushState + popstate. Overridden by HolocronChatBridge
    // or ChatWidget's navigate prop with the framework's client-side router.
    history.pushState(null, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  },
}))
