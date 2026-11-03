// Watches OpenCode V2 server events during `holocron maintain`: prints tool calls,
// assistant text, task sessions, and errors, so CI logs show what the model did,
// and decides when the run is finished from the same ordered event stream.

import path from 'node:path'
import type { OpenCodeClient, OpenCodeEvent, SessionStructuredError, SessionToolCalled } from '@opencode/client'
import { colors as c } from './logger.ts'

const MAX_SUMMARY = 100
const MAX_TEXT_LINES = 12

type ToolInput = SessionToolCalled['data']['input']

export type SessionOutcome =
  | { type: 'succeeded'; finalText: string }
  | { type: 'failed'; error: SessionStructuredError }
  | { type: 'interrupted'; reason: string }

type Monitor = {
  /** Prints the event. Returns the outcome once the root session and every task are idle. */
  handle: (event: OpenCodeEvent) => SessionOutcome | undefined
}

export function createSessionMonitor({
  repoRoot,
  rootSessionID,
  write,
}: {
  repoRoot: string
  rootSessionID: string
  write: (line: string) => void
}): Monitor {
  const taskLabels = new Map<string, string>()
  // Tool name and start time arrive on input.started, the input on called, the result on success/failed.
  const tools = new Map<string, { name: string; started: number; input: ToolInput }>()
  const running = new Set<string>()
  let rootText = ''
  let rootOutcome: SessionOutcome | undefined

  const prefix = (sessionID: string) => {
    if (sessionID === rootSessionID) return '  '
    return `  ${c.magenta(`[${taskLabels.get(sessionID) ?? 'task'}]`)} `
  }
  // A background task keeps running after the root turn ends, so wait until nothing runs.
  const settled = () => running.size === 0 ? rootOutcome : undefined

  return {
    handle(event) {
      switch (event.type) {
        case 'session.created': {
          const { data } = event
          if (!data.parentID) return
          const label = `task ${taskLabels.size + 1}`
          taskLabels.set(data.sessionID, label)
          write(`  ${c.magenta(`◆ ${label}`)}${c.dim(data.title ? ` ${data.title}` : '')}`)
          return
        }
        case 'session.execution.started': {
          running.add(event.data.sessionID)
          if (event.data.sessionID === rootSessionID) {
            rootOutcome = undefined
            rootText = ''
          }
          return
        }
        case 'session.tool.input.started': {
          const { data } = event
          tools.set(`${data.assistantMessageID}:${data.id}`, { name: data.name, started: event.created, input: {} })
          return
        }
        case 'session.tool.called': {
          const tool = tools.get(`${event.data.assistantMessageID}:${event.data.id}`)
          if (tool) tool.input = event.data.input
          return
        }
        case 'session.tool.success':
        case 'session.tool.failed': {
          const { data } = event
          const key = `${data.assistantMessageID}:${data.id}`
          const tool = tools.get(key)
          tools.delete(key)
          write(prefix(data.sessionID) + formatToolCall({
            name: tool?.name ?? 'tool',
            input: tool?.input ?? {},
            durationMs: tool ? event.created - tool.started : undefined,
            error: event.type === 'session.tool.failed' ? event.data.error.message : undefined,
            repoRoot,
          }))
          return
        }
        case 'session.text.ended': {
          const { data } = event
          const text = data.text.trim()
          if (!text) return
          if (data.sessionID === rootSessionID) rootText = text
          for (const line of truncateLines(text, MAX_TEXT_LINES)) {
            write(prefix(data.sessionID) + c.dim(`│ ${line}`))
          }
          return
        }
        case 'session.retry.scheduled': {
          const { data } = event
          write(prefix(data.sessionID) + c.yellow(`↻ retry ${data.attempt} after ${data.error.type}: ${firstLine(data.error.message)}`))
          return
        }
        case 'session.execution.succeeded':
        case 'session.execution.failed':
        case 'session.execution.interrupted': {
          const { sessionID } = event.data
          running.delete(sessionID)
          if (event.type === 'session.execution.failed') {
            write(prefix(sessionID) + c.red(`✗ ${event.data.error.type}: ${firstLine(event.data.error.message)}`))
          }
          // A finished background task restarts the root with its result, so only the root decides.
          if (sessionID !== rootSessionID) return
          rootOutcome = event.type === 'session.execution.succeeded'
            ? { type: 'succeeded', finalText: rootText }
            : event.type === 'session.execution.failed'
              ? { type: 'failed', error: event.data.error }
              : { type: 'interrupted', reason: event.data.reason }
          return settled()
        }
      }
    },
  }
}

// Subscribes, calls `start` once the subscription is live so no event is missed,
// and resolves with the outcome. Errors when the stream ends first.
export async function watchSession({
  client,
  monitor,
  start,
  signal,
}: {
  client: OpenCodeClient
  monitor: Monitor
  start: () => Promise<void>
  signal: AbortSignal
}): Promise<SessionOutcome | Error> {
  let started = false
  try {
    for await (const event of client.event.subscribe({ signal })) {
      if (event.type === 'server.connected') {
        if (started) continue
        started = true
        await start()
        continue
      }
      const outcome = monitor.handle(event)
      if (outcome) return outcome
    }
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error))
  }
  return new Error('OpenCode event stream ended before the session finished.')
}

export function formatToolCall({
  name,
  input,
  durationMs,
  error,
  repoRoot,
}: {
  name: string
  input: ToolInput
  durationMs?: number
  error?: string
  repoRoot: string
}) {
  const summary = summarizeToolInput({ tool: name, input, repoRoot })
  const duration = durationMs === undefined ? '' : c.dim(` ${formatDuration(durationMs)}`)
  if (error !== undefined) {
    return `${c.red('✗')} ${c.bold(name)} ${summary}${duration}${c.red(` → ${firstLine(error)}`)}`
  }
  return `${c.green('└')} ${c.bold(name)} ${summary}${duration}`
}

export function summarizeToolInput({ tool, input, repoRoot }: { tool: string; input: ToolInput; repoRoot: string }) {
  const str = (key: string) => typeof input[key] === 'string' ? input[key] : undefined
  const rel = (file: string | undefined) => file && path.isAbsolute(file) ? path.relative(repoRoot, file) || '.' : file
  const value = (() => {
    switch (tool) {
      case 'shell': return str('command')
      case 'read':
      case 'edit':
      case 'write': return rel(str('path'))
      case 'glob':
      case 'grep': return [str('pattern'), rel(str('path'))].filter(Boolean).join(' in ')
      case 'subagent': return str('description')
      case 'webfetch': return str('url')
      case 'todowrite': return Array.isArray(input.todos) ? `${input.todos.length} todos` : undefined
      default: return JSON.stringify(input)
    }
  })()
  const line = firstLine(value ?? '')
  return line.length > MAX_SUMMARY ? `${line.slice(0, MAX_SUMMARY - 1)}…` : line
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`
}

function firstLine(text: string) {
  const lines = text.trim().split('\n')
  return lines.length > 1 ? `${lines[0]} …` : lines[0] ?? ''
}

function truncateLines(text: string, max: number) {
  const lines = text.split('\n')
  if (lines.length <= max) return lines
  return [...lines.slice(0, max), `… ${lines.length - max} more lines`]
}

// Fields that repeat on every line or are already shown by holocron (session ids, run ids).
const HIDDEN_LOG_FIELDS = new Set(['timestamp', 'run', 'level', 'message', 'role', 'sessionID'])

// OpenCode server logs are logfmt: `timestamp=… level=WARN run=… message="…" key=value`.
// Drops timestamp and run id, colors the level, and keeps the first line of the remaining fields.
// Quoted values escape newlines as `\n`, so a `cause` stack trace is cut to its message.
export function formatServerLog(line: string) {
  const fields = [...line.matchAll(/(\S+?)=("(?:[^"\\]|\\.)*"|\S*)/g)].map(([, key, raw]) => ({
    key: key!,
    value: (raw!.startsWith('"') ? raw!.slice(1, -1) : raw!).split('\\n')[0]!.replaceAll('\\"', '"').trim(),
  }))
  if (fields.length === 0) return c.dim(`  opencode ${line}`)
  const get = (key: string) => fields.find((field) => field.key === key)?.value
  const level = get('level') ?? 'LOG'
  const rest = fields
    .filter((field) => !HIDDEN_LOG_FIELDS.has(field.key))
    .map((field) => `${field.key}=${field.value}`)
    .join(' ')
  const tag = level === 'ERROR' ? c.red(level) : c.yellow(level)
  return `  ${c.dim('opencode')} ${tag} ${get('message') ?? ''}${rest ? c.dim(` ${rest}`) : ''}`
}
