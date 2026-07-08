'use client'

/**
 * Local chat session registry — stores past AI chat sessions in localStorage
 * (id + AI-generated title + first-message preview) so the drawer's session
 * select can list and restore previous conversations.
 *
 * Server-side snapshots stay in ChatSessionDO keyed by the session id bearer
 * token; this list is client-only metadata. Entries are keyed per docs site
 * (host + chat API path, same scoping as the session cookie/localStorage id)
 * and capped so storage stays bounded.
 */

import { chatWidgetStore } from './chat-widget-store.ts'

export type StoredChatSession = {
  /** chs_... session id (the bearer token used to restore the conversation) */
  id: string
  /** AI-generated title. Null until the gateway's title chunk arrives. */
  title: string | null
  /** Truncated first user message — placeholder label while title is null. */
  preview: string
  updatedAt: number
}

const MAX_STORED_SESSIONS = 30
const PREVIEW_MAX_CHARS = 60

function storageKey(chatApiUrl: string): string {
  // Host + pathname so two docs sites on one origin (different base paths)
  // keep separate session lists. Relative URLs (embedded mode) resolve
  // against the current origin.
  const url = new URL(
    chatApiUrl,
    typeof location !== 'undefined' ? location.origin : 'http://localhost',
  )
  return `holocron-chat-sessions:${url.host}${url.pathname}`
}

function readSessions(chatApiUrl: string): StoredChatSession[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey(chatApiUrl))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (s): s is StoredChatSession =>
        typeof s === 'object' && s !== null && typeof (s as any).id === 'string',
    )
  } catch {
    return []
  }
}

function writeSessions(chatApiUrl: string, sessions: StoredChatSession[]): void {
  const sorted = [...sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_STORED_SESSIONS)
  chatWidgetStore.setState({ sessions: sorted })
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(storageKey(chatApiUrl), JSON.stringify(sorted))
  } catch {
    // localStorage unavailable (private mode, quota) — list won't persist
  }
}

/** Load the stored list into chatWidgetStore so the select can render it. */
export function hydrateStoredSessions(chatApiUrl: string): void {
  writeSessions(chatApiUrl, readSessions(chatApiUrl))
}

/**
 * Create or bump one entry (updatedAt always moves to now).
 * Title: a new value wins (the AI title arrives once, after the first turn).
 * Preview: the existing value wins so the first-message preview sticks and
 * later turns can't replace it.
 */
export function upsertStoredSession(
  chatApiUrl: string,
  entry: { id: string; title?: string; preview?: string },
): void {
  const sessions = readSessions(chatApiUrl)
  const existing = sessions.find((s) => s.id === entry.id)
  const next: StoredChatSession = {
    id: entry.id,
    title: entry.title ?? existing?.title ?? null,
    preview: existing?.preview || entry.preview || '',
    updatedAt: Date.now(),
  }
  writeSessions(chatApiUrl, [next, ...sessions.filter((s) => s.id !== entry.id)])
}

/** Display label: AI title, else first-message preview, else a placeholder. */
export function sessionLabel(session: StoredChatSession): string {
  return session.title || session.preview || 'Untitled chat'
}

/** Collapse whitespace and truncate a message into a short preview label. */
export function previewFromText(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= PREVIEW_MAX_CHARS) return collapsed
  return `${collapsed.slice(0, PREVIEW_MAX_CHARS - 1)}…`
}
