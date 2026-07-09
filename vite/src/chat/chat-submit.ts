'use client'

/**
 * Chat submission logic — extracted from ChatDrawer so both the holocron
 * integration and the standalone widget can share the same fetch+stream code.
 *
 * Reads/writes chatStore directly. Caller provides the API URL and current slug
 * via chatWidgetStore (already set before submitChat is called).
 *
 * Client tool execution: tools come from two sources, merged at submit time:
 *   1. document.modelContext (custom tools registered via defineTool())
 *   2. chatWidgetStore.tools (browser automation tools from pageTools())
 * When the model calls a client tool, the widget executes it locally,
 * appends the tool result to modelMessages, and re-POSTs to continue the
 * conversation. Max 10 re-POST iterations to prevent infinite loops.
 *
 * Session persistence: conversations are stored server-side keyed by a
 * chs_... bearer token. Embedded mode uses a first-party cookie (JS-readable,
 * not httpOnly) so the client can detect an existing session on page load
 * and eagerly restore the conversation. Cross-origin widget mode keeps the id
 * in localStorage and sends it as the x-holocron-chat-session header.
 * ensureSessionRestored() is called eagerly by HolocronChatBridge when a
 * session cookie exists, and also awaited by submitChat to prevent races.
 */

import type { ToolModelMessage } from 'ai'
import { decodeFederationPayload } from 'spiceflow/react'
import { chatStore, respondToApproval } from './chat-store.ts'
import type { ChatMessage, ChatModelMessage, ChatPart } from './chat-store.ts'
import { chatWidgetStore } from './chat-widget-store.ts'
import { previewFromText, upsertStoredSession } from './chat-sessions.ts'
import { getRegisteredTools, getNativeModelContextTools } from './define-tool.ts'
import type { ChatToolDefinition, ChatToolSchema, ToolApprovalCheck } from './define-tool.ts'

const MAX_CLIENT_TOOL_ITERATIONS = 10

/** Turn raw stream/fetch errors into short, user-facing messages. */
function humanizeChatError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  if (msg.includes('No output generated'))
    return 'The AI model did not return a response. Please try again.'
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('network'))
    return 'Network error. Check your connection and try again.'
  if (msg.includes('timeout') || msg.includes('Timeout'))
    return 'The request timed out. Please try again.'
  // Fallback: show the actual message instead of a generic label
  return msg
}

function appendAssistantPart(messages: ChatMessage[], part: ChatPart): ChatMessage[] {
  const lastMessage = messages.at(-1)
  if (lastMessage?.role === 'assistant') {
    return [
      ...messages.slice(0, -1),
      { role: 'assistant', parts: [...lastMessage.parts, part] },
    ]
  }
  return [...messages, { role: 'assistant', parts: [part] }]
}

/** Extract tool schemas (without run functions) for sending to the gateway. */
function extractToolSchemas(tools: ChatToolDefinition[]): ChatToolSchema[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputJsonSchema: t.inputJsonSchema,
  }))
}

type StreamChunk =
  | ChatPart
  | { type: 'model-messages'; messages: ChatModelMessage[] }
  | { type: 'session'; sessionId: string }
  | { type: 'title'; title: string }

// ── Tool approvals ──────────────────────────────────────────────────

const DENIED_TOOL_MESSAGE = 'User denied this tool call'

/**
 * Ask the user to approve a tool call when the tool declares needsApproval.
 * Returns true when execution may proceed. Appends a tool-approval-request
 * part to the chat and waits for the Approve/Deny buttons; aborting the
 * generation resolves as denied so the loop never hangs.
 */
async function requestApprovalIfNeeded(
  pending: PendingClientToolCall,
  signal: AbortSignal,
): Promise<boolean> {
  const needsApproval = pending.tool.needsApproval
  if (!needsApproval) return true

  let check: ToolApprovalCheck
  if (typeof needsApproval === 'function') {
    try {
      check = await needsApproval({ input: pending.args })
    } catch {
      // Fail safe: if the check itself throws, require approval
      check = true
    }
  } else {
    check = needsApproval
  }
  if (check === false) return true
  const message = typeof check === 'object' ? check.message : undefined

  // Prefer the model-provided human readable `description` input field over raw args
  const description =
    typeof pending.args.description === 'string' && pending.args.description
      ? pending.args.description
      : JSON.stringify(pending.args)

  chatStore.setState((s) => ({
    messages: appendAssistantPart(s.messages, {
      type: 'tool-approval-request',
      toolCallId: pending.toolCallId,
      toolName: pending.toolName,
      description,
      ...(message ? { message } : {}),
      state: 'pending',
    }),
  }))

  return new Promise<boolean>((resolve) => {
    chatStore.setState((s) => ({
      approvalResolvers: { ...s.approvalResolvers, [pending.toolCallId]: resolve },
    }))
    if (signal.aborted) {
      respondToApproval(pending.toolCallId, false)
      return
    }
    signal.addEventListener(
      'abort',
      () => respondToApproval(pending.toolCallId, false),
      { once: true },
    )
  })
}

// ── Session id persistence ──────────────────────────────────────────

/** Cross-origin widget mode is detected by an absolute chatApiUrl. Embedded
 *  mode uses a relative URL and the first-party cookie. */
function isWidgetMode(chatApiUrl: string): boolean {
  return /^https?:\/\//.test(chatApiUrl)
}

const CHAT_SESSION_COOKIE_RE = /(?:^|;\s*)holocron_chat=(chs_[A-Za-z0-9_-]{43})/

/** Read the session id from document.cookie. Works in embedded mode where
 *  the cookie is first-party and JS-readable (not httpOnly). */
function readSessionIdFromCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(CHAT_SESSION_COOKIE_RE)
  return match?.[1] ?? null
}

function sessionStorageKey(chatApiUrl: string): string {
  // Host + pathname so two docs sites on one origin (different base paths)
  // keep separate widget sessions.
  const url = new URL(chatApiUrl)
  return `holocron-chat-session:${url.host}${url.pathname}`
}

/** Resolve the known session id: widget store first, then cookie (embedded
 *  mode) or localStorage (widget mode). */
function getSessionId(chatApiUrl: string): string | null {
  const stored = chatWidgetStore.getState().sessionId
  if (stored) return stored
  // Embedded mode: read from document.cookie (JS-readable, not httpOnly)
  if (!isWidgetMode(chatApiUrl)) {
    const fromCookie = readSessionIdFromCookie()
    if (fromCookie) {
      chatWidgetStore.setState({ sessionId: fromCookie })
      return fromCookie
    }
    return null
  }
  // Widget mode: localStorage fallback (cross-origin cookie won't work)
  if (typeof localStorage !== 'undefined') {
    try {
      const fromStorage = localStorage.getItem(sessionStorageKey(chatApiUrl))
      if (fromStorage) {
        chatWidgetStore.setState({ sessionId: fromStorage })
        return fromStorage
      }
    } catch {
      // localStorage unavailable (private mode, blocked) — session won't persist
    }
  }
  return null
}

function storeSessionId(chatApiUrl: string, sessionId: string): void {
  chatWidgetStore.setState({ sessionId })
  // Embedded mode: also write the cookie so switching to a past session
  // survives a page reload (the server only refreshes the cookie on POST).
  writeEmbeddedSessionCookie(chatApiUrl, sessionId)
  if (isWidgetMode(chatApiUrl) && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(sessionStorageKey(chatApiUrl), sessionId)
    } catch {
      // best effort
    }
  }
}

/** Preview label for the session list: the most recent user message. */
function latestUserPreview(): string {
  const lastUser = chatStore.getState().messages.findLast((m) => m.role === 'user')
  const text = (lastUser?.parts ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
  return previewFromText(text)
}

function sessionHeaders(chatApiUrl: string): Record<string, string> {
  const sessionId = getSessionId(chatApiUrl)
  return sessionId ? { 'x-holocron-chat-session': sessionId } : {}
}

/** Returns true when a chat session id exists (cookie or localStorage),
 *  meaning the page should eagerly restore the conversation. */
export function hasExistingSession(): boolean {
  const { chatApiUrl } = chatWidgetStore.getState()
  if (!chatApiUrl) return false
  return getSessionId(chatApiUrl) !== null
}

// Restore runs at most once per page load (singleton promise). Replaced by
// startNewChat() (resolved no-op, so a fresh chat can't resurrect the old
// conversation) and by switchChatSession() (new restore for the chosen id).
let restorePromise: Promise<void> | null = null

/**
 * Restore the persisted conversation into chatStore, once per page load.
 * Called eagerly by HolocronChatBridge when a session cookie exists, and
 * also awaited by submitChat so a submit right after a page refresh cannot
 * overwrite the server-side history with a fresh turn.
 * Failures are silent — the user just starts a new conversation.
 */
export function ensureSessionRestored(): Promise<void> {
  if (!restorePromise) {
    restorePromise = restoreChatSession().catch((error) => {
      console.error('Chat session restore failed:', error)
    })
  }
  return restorePromise
}

async function restoreChatSession(): Promise<void> {
  const { chatApiUrl } = chatWidgetStore.getState()
  if (!chatApiUrl) return
  if (chatStore.getState().messages.length > 0) return

  // Capture the id being restored so a New chat / session switch during the
  // fetch can't write another conversation's messages into the store.
  const expectedSessionId = getSessionId(chatApiUrl)
  if (!expectedSessionId) return

  const response = await fetch(`${chatApiUrl}/session`, {
    headers: { 'x-holocron-chat-session': expectedSessionId },
  })
  if (!response.ok) return

  const decoded = await decodeFederationPayload<{
    messages: ChatMessage[]
    modelMessages: ChatModelMessage[]
  }>(response)
  if (!decoded.messages?.length) return

  // Session changed while the restore was in flight (New chat / switch) —
  // discard the stale payload instead of resurrecting the old conversation.
  if (chatWidgetStore.getState().sessionId !== expectedSessionId) return
  // Don't clobber a conversation that started while the restore was in flight.
  const state = chatStore.getState()
  if (state.messages.length > 0 || state.isGenerating) return
  chatStore.setState({
    messages: decoded.messages,
    modelMessages: decoded.modelMessages ?? [],
  })

  // Make sure the restored session appears in the local session list
  // (covers sessions created before the list existed, or another device).
  const firstUser = decoded.messages.find((m) => m.role === 'user')
  const text = (firstUser?.parts ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
  upsertStoredSession(chatApiUrl, { id: expectedSessionId, preview: previewFromText(text) })
}

/** Derive the cookie path from the chatApiUrl so embedded-mode cookie
 *  expiration matches the path the server set. */
function embeddedCookiePath(chatApiUrl: string): string {
  const path = chatApiUrl.replace(/\/holocron-api\/chat$/, '')
  return path ? `${path.replace(/\/$/, '')}/` : '/'
}

/** Expire the embedded-mode cookie synchronously via document.cookie so
 *  a quick resubmit after "New chat" can't re-read the old session id. */
function expireEmbeddedSessionCookie(chatApiUrl: string): void {
  if (isWidgetMode(chatApiUrl) || typeof document === 'undefined') return
  document.cookie = `holocron_chat=; Path=${embeddedCookiePath(chatApiUrl)}; Max-Age=0; SameSite=Lax`
}

/** Write the embedded-mode cookie via document.cookie (JS-writable, matches
 *  the server's cookie attributes) so a reload restores the chosen session. */
function writeEmbeddedSessionCookie(chatApiUrl: string, sessionId: string): void {
  if (isWidgetMode(chatApiUrl) || typeof document === 'undefined') return
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  const maxAge = 30 * 24 * 60 * 60
  document.cookie = `holocron_chat=${sessionId}; Path=${embeddedCookiePath(chatApiUrl)}; Max-Age=${maxAge}; SameSite=Lax${secure}`
}

/** Reset the live chat state (messages, generation, draft). */
function resetChatStoreState(): void {
  chatStore.getState().abortController?.abort()
  chatStore.setState({
    isGenerating: false,
    abortController: null,
    messages: [],
    modelMessages: [],
    draftText: '',
    pendingSubmit: false,
    errorMessage: null,
    approvalResolvers: {},
  })
}

/**
 * Start a fresh conversation ("New chat"): forgets the current session id
 * locally (cookie + localStorage + store) and resets the live chat state.
 * The old conversation is NOT deleted — it stays in the local session list
 * and server-side, so the user can switch back to it from the select.
 */
export function startNewChat(): void {
  const { chatApiUrl } = chatWidgetStore.getState()
  // Nothing to restore for a fresh session — disable the eager restore.
  restorePromise = Promise.resolve()
  if (chatApiUrl) {
    // Expire the cookie synchronously BEFORE clearing the store, so a quick
    // resubmit can't re-read the old session id from document.cookie.
    expireEmbeddedSessionCookie(chatApiUrl)
    if (isWidgetMode(chatApiUrl) && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(sessionStorageKey(chatApiUrl))
      } catch {
        // best effort
      }
    }
  }
  chatWidgetStore.setState({ sessionId: null })
  resetChatStoreState()
}

/**
 * Switch to a past conversation from the session select: aborts any live
 * generation, points the session id at the chosen conversation, and
 * re-fetches its server-side snapshot into the store.
 */
export async function switchChatSession(sessionId: string): Promise<void> {
  const { chatApiUrl, sessionId: currentId } = chatWidgetStore.getState()
  if (!chatApiUrl || sessionId === currentId) return
  resetChatStoreState()
  storeSessionId(chatApiUrl, sessionId)
  restorePromise = restoreChatSession().catch((error) => {
    console.error('Chat session switch failed:', error)
  })
  await restorePromise
}

/** Pending client tool call detected during streaming. */
type PendingClientToolCall = {
  toolCallId: string
  toolName: string
  args: Record<string, unknown>
  tool: ChatToolDefinition
}

/**
 * Stream a single chat request and return any pending client tool calls
 * that need local execution before the next turn.
 */
async function streamChatRequest(
  chatApiUrl: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
  clientToolsByName: Map<string, ChatToolDefinition>,
): Promise<{ pendingToolCalls: PendingClientToolCall[]; requestSessionId: string | null }> {
  // The session this request belongs to. Session-list writes (preview,
  // title) target THIS id — never the store's current id, which may point
  // at a different conversation if the user switches mid-stream.
  let requestSessionId = getSessionId(chatApiUrl)

  const response = await fetch(chatApiUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...sessionHeaders(chatApiUrl) },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => undefined)
    chatStore.setState({
      errorMessage: typeof errorBody?.error === 'string'
        ? errorBody.error
        : `Chat request failed: ${response.status} ${response.statusText}`,
    })
    return { pendingToolCalls: [], requestSessionId }
  }

  const decoded = await decodeFederationPayload<{ stream: AsyncIterable<StreamChunk> }>(response)
  const pendingToolCalls: PendingClientToolCall[] = []

  for await (const part of decoded.stream) {
    if (part.type === 'session') {
      // Freshly minted session id from the proxy — persist it so this
      // conversation can be restored after a page refresh, and register it
      // in the local session list with the first message as preview label.
      requestSessionId = part.sessionId
      storeSessionId(chatApiUrl, part.sessionId)
      upsertStoredSession(chatApiUrl, { id: part.sessionId, preview: latestUserPreview() })
      continue
    }

    if (part.type === 'title') {
      // AI-generated conversation title (first turn only) — replaces the
      // preview placeholder in the session select for this request's session.
      if (requestSessionId) {
        upsertStoredSession(chatApiUrl, { id: requestSessionId, title: part.title })
      }
      continue
    }

    if (part.type === 'model-messages') {
      chatStore.setState({ modelMessages: part.messages })
      continue
    }

    // Detect client tool calls: tool-call parts where the name matches a client tool
    if (part.type === 'tool-call') {
      const clientTool = clientToolsByName.get(part.toolName)
      if (clientTool) {
        pendingToolCalls.push({
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          args: part.args,
          tool: clientTool,
        })
      }
    }

    chatStore.setState((s) => ({
      messages: appendAssistantPart(s.messages, part),
    }))
  }

  return { pendingToolCalls, requestSessionId }
}

/**
 * Submit a chat message. Reads chatApiUrl and currentSlug from chatWidgetStore,
 * manages chatStore state (messages, isGenerating, etc.), and streams the response.
 *
 * When the model calls client-side tools, executes them locally and re-POSTs
 * with the results so the model can continue.
 *
 * @param text - Optional override text. If not provided, reads from chatStore.draftText.
 * @param onScrollToLastUser - Optional callback to scroll UI after user message is added.
 */
export async function submitChat(
  text?: string,
  onScrollToLastUser?: () => void,
): Promise<void> {
  const submitText = text || chatStore.getState().draftText.trim()
  if (!submitText) return
  if (chatStore.getState().isGenerating) return

   const { chatApiUrl, currentSlug, tools: storeBrowserTools, context } = chatWidgetStore.getState()
   if (!chatApiUrl) {
     console.error('chatWidgetStore.chatApiUrl is not set')
     return
   }

   // Load any persisted conversation before reading modelMessages, otherwise
   // a submit right after a page refresh would snapshot only the new turn and
   // overwrite the stored history server-side.
   await ensureSessionRestored()

   const modelMessages = chatStore.getState().modelMessages
   const nextUserMessage: ChatMessage = { role: 'user', parts: [{ type: 'text', text: submitText }] }

   const controller = new AbortController()
   chatStore.setState((s) => ({
     isGenerating: true,
     messages: [...s.messages, nextUserMessage],
     draftText: '',
     pendingSubmit: false,
     errorMessage: null,
     abortController: controller,
   }))

   if (onScrollToLastUser) {
     setTimeout(onScrollToLastUser, 0)
   }

   // Merge tools from three sources (lowest → highest priority):
   //   1. Native document.modelContext — tools registered by third-party code
   //   2. chatWidgetStore.tools — browser automation tools from pageTools()
   //   3. getRegisteredTools() — custom tools registered via defineTool()
   // Higher priority wins on name collision.
   const clientToolsByName = new Map<string, ChatToolDefinition>()
   for (const t of await getNativeModelContextTools()) {
     clientToolsByName.set(t.name, t)
   }
   for (const t of storeBrowserTools) {
     clientToolsByName.set(t.name, t)
   }
   for (const t of getRegisteredTools()) {
     clientToolsByName.set(t.name, t)
   }
   const allTools = [...clientToolsByName.values()]
   const toolSchemas = allTools.length > 0 ? extractToolSchemas(allTools) : undefined
   const contextPayload = Object.keys(context).length > 0 ? context : undefined

  // The session this submit belongs to — used by the finally block so a
  // mid-stream session switch can't bump the wrong session's recency.
  let submitSessionId = getSessionId(chatApiUrl)

  try {
    let currentBody: Record<string, unknown> = {
      modelMessages,
      message: submitText,
      currentSlug: currentSlug || '/',
      ...(toolSchemas ? { toolSchemas } : {}),
      ...(contextPayload ? { context: contextPayload } : {}),
    }

    for (let iteration = 0; iteration < MAX_CLIENT_TOOL_ITERATIONS; iteration++) {
      const { pendingToolCalls, requestSessionId } = await streamChatRequest(
        chatApiUrl,
        currentBody,
        controller.signal,
        clientToolsByName,
      )
      if (requestSessionId) submitSessionId = requestSessionId

      // No client tool calls pending: conversation turn is complete
      if (pendingToolCalls.length === 0) break

      // Execute each pending client tool call locally and collect results.
      // Each result tracks toolName + error flag for AI SDK v6 ToolResultPart.
      const toolResults: { toolCallId: string; toolName: string; result: string; isError: boolean }[] = []

      for (const pending of pendingToolCalls) {
        let output: unknown
        let error: string | undefined
        const approved = await requestApprovalIfNeeded(pending, controller.signal)
        if (!approved) {
          error = DENIED_TOOL_MESSAGE
          output = { error }
        } else {
          try {
            output = await pending.tool.run({ input: pending.args })
          } catch (e) {
            error = e instanceof Error ? e.message : String(e)
            output = { error }
          }
        }

        const outputStr = typeof output === 'string' ? output : JSON.stringify(output)
        toolResults.push({
          toolCallId: pending.toolCallId,
          toolName: pending.toolName,
          result: outputStr,
          isError: !!error,
        })

        // Show tool result in the UI
        chatStore.setState((s) => ({
          messages: appendAssistantPart(s.messages, {
            type: 'tool-result',
            toolCallId: pending.toolCallId,
            toolName: pending.toolName,
            output: outputStr.slice(0, 500),
            ...(error ? { error } : {}),
          }),
        }))
      }

      // Build AI SDK v6 ToolModelMessage for the next turn.
      const toolResultMessages: ToolModelMessage[] = toolResults.map((tr) => ({
        role: 'tool' as const,
        content: [{
          type: 'tool-result' as const,
          toolCallId: tr.toolCallId,
          toolName: tr.toolName,
          output: tr.isError
            ? { type: 'error-text' as const, value: tr.result }
            : { type: 'text' as const, value: tr.result },
        }],
      }))

      // Re-POST with updated model messages (includes tool results)
      const updatedModelMessages = [
        ...chatStore.getState().modelMessages,
        ...toolResultMessages,
      ]
      chatStore.setState({ modelMessages: updatedModelMessages })

      currentBody = {
        modelMessages: updatedModelMessages,
        message: '',
        currentSlug: currentSlug || '/',
        ...(toolSchemas ? { toolSchemas } : {}),
        ...(contextPayload ? { context: contextPayload } : {}),
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // User clicked stop — keep whatever parts arrived
    } else {
      console.error('Chat error:', error)
      chatStore.setState({
        errorMessage: humanizeChatError(error),
      })
    }
  } finally {
    chatStore.setState({
      isGenerating: false,
      abortController: null,
    })
    // Bump the session's recency in the local list (creates the entry when
    // the id predates the list feature, e.g. restored empty sessions).
    // Uses the id captured for THIS submit — never the store's current id,
    // which may already point at another session after a mid-stream switch.
    if (submitSessionId) {
      upsertStoredSession(chatApiUrl, { id: submitSessionId, preview: previewFromText(submitText) })
    }
  }
}
