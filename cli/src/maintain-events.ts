// Streams OpenCode server events during `holocron maintain` and prints tool calls,
// assistant text, task sessions, and errors, so CI logs show what the model did.

import path from 'node:path'
import type { Event, Part, ToolPart } from '@opencode-ai/sdk/v2/types'
import type { OpencodeClient } from '@opencode-ai/sdk/v2/client'
import { colors as c } from './logger.ts'

const MAX_SUMMARY = 100
const MAX_TEXT_LINES = 12

type Printer = {
  handle: (event: Event) => void
}

// Pure event → lines formatter. Keeps only "print once" bookkeeping, no I/O.
export function createEventPrinter({
  repoRoot,
  rootSessionID,
  write,
}: {
  repoRoot: string
  rootSessionID: string
  write: (line: string) => void
}): Printer {
  const printed = new Set<string>()
  const taskLabels = new Map<string, string>()

  const prefix = (sessionID: string) => {
    if (sessionID === rootSessionID) return '  '
    return `  ${c.magenta(`[${taskLabels.get(sessionID) ?? 'task'}]`)} `
  }

  const printPart = (part: Part) => {
    if (part.type === 'tool') {
      if (part.state.status !== 'completed' && part.state.status !== 'error') return
      const key = `${part.id}:${part.state.status}`
      if (printed.has(key)) return
      printed.add(key)
      write(prefix(part.sessionID) + formatToolPart(part, repoRoot))
      return
    }
    if (part.type === 'text') {
      if (part.synthetic || !part.time?.end || !part.text.trim()) return
      if (printed.has(part.id)) return
      printed.add(part.id)
      for (const line of truncateLines(part.text.trim(), MAX_TEXT_LINES)) {
        write(prefix(part.sessionID) + c.dim(`│ ${line}`))
      }
    }
  }

  return {
    handle(event) {
      if (event.type === 'session.created') {
        const { info } = event.properties
        if (!info.parentID) return
        const label = `task ${taskLabels.size + 1}`
        taskLabels.set(info.id, label)
        write(`  ${c.magenta(`◆ ${label}`)}${c.dim(` ${info.title}`)}`)
        return
      }
      if (event.type === 'message.part.updated') {
        printPart(event.properties.part)
        return
      }
      if (event.type === 'session.error') {
        const { error, sessionID } = event.properties
        if (!error) return
        const message = 'message' in error.data && typeof error.data.message === 'string' ? error.data.message : ''
        write(prefix(sessionID ?? rootSessionID) + c.red(`✗ ${error.name}${message ? `: ${message}` : ''}`))
      }
    },
  }
}

export function formatToolPart(part: ToolPart, repoRoot: string) {
  const { state } = part
  const summary = summarizeToolInput({ tool: part.tool, input: state.input, repoRoot })
  const duration = state.status === 'completed' || state.status === 'error'
    ? c.dim(` ${formatDuration(state.time.end - state.time.start)}`)
    : ''
  if (state.status === 'error') {
    const error = firstLine(state.error)
    return `${c.red('✗')} ${c.bold(part.tool)} ${summary}${duration}${c.red(` → ${error}`)}`
  }
  return `${c.green('└')} ${c.bold(part.tool)} ${summary}${duration}`
}

export function summarizeToolInput({ tool, input, repoRoot }: { tool: string; input: ToolPart['state']['input']; repoRoot: string }) {
  const str = (key: string) => typeof input[key] === 'string' ? input[key] : undefined
  const rel = (file: string | undefined) => file && path.isAbsolute(file) ? path.relative(repoRoot, file) || '.' : file
  const value = (() => {
    switch (tool) {
      case 'bash': return str('command')
      case 'read':
      case 'edit':
      case 'write': return rel(str('filePath'))
      case 'glob': return [str('pattern'), rel(str('path'))].filter(Boolean).join(' in ')
      case 'grep': return [str('pattern'), rel(str('path'))].filter(Boolean).join(' in ')
      case 'task': return str('description')
      case 'webfetch': return str('url')
      case 'todowrite': return Array.isArray(input.todos) ? `${input.todos.length} todos` : undefined
      default: return JSON.stringify(input)
    }
  })()
  const line = firstLine(value ?? '')
  return line.length > MAX_SUMMARY ? `${line.slice(0, MAX_SUMMARY - 1)}…` : line
}

// Subscribes before the prompt starts and prints until `signal` aborts.
export async function streamOpencodeEvents({
  client,
  directory,
  printer,
  signal,
}: {
  client: OpencodeClient
  directory: string
  printer: Printer
  signal: AbortSignal
}) {
  const { stream } = await client.event.subscribe({ directory }, { signal, sseMaxRetryAttempts: 0 })
  try {
    for await (const event of stream) printer.handle(event)
  } catch (error) {
    if (!signal.aborted) throw error
  }
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

// Fields that repeat on every line or are already shown by holocron (model, session ids).
const HIDDEN_LOG_FIELDS = new Set(['timestamp', 'run', 'level', 'message', 'session.id', 'providerID', 'modelID', 'small', 'mode'])

// OpenCode server logs are logfmt: `timestamp=… level=WARN run=… message="…" key=value`.
// Drops timestamp and run id, colors the level, and keeps the remaining fields.
export function formatServerLog(line: string) {
  const fields = [...line.matchAll(/(\S+?)=("(?:[^"\\]|\\.)*"|\S*)/g)].map(([, key, raw]) => ({
    key: key!,
    value: raw!.startsWith('"') ? raw!.slice(1, -1).replaceAll('\\"', '"') : raw!,
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
