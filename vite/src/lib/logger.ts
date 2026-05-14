// Tiny terminal color helpers and console-backed logger for Holocron build logs.
// Vendored instead of depending on picocolors so the Vite plugin stays dependency-light.
//
// Also provides HolocronMdxParseError — a formatted parse error with a code frame
// showing source context. normalizeMdx/processMdx return this error when remark
// fails to parse MDX syntax. The code frame shows 3 lines before and after the error line.
// Remark throws VFileMessage errors with `line`, `column`, and `reason` properties.

import type { SafeMdxError } from 'safe-mdx'

const env = typeof process === 'undefined' ? undefined : process.env

const enabled =
  env?.NO_COLOR === undefined &&
  env?.NODE_DISABLE_COLORS === undefined &&
  env?.FORCE_COLOR !== '0'

function formatter(open: string, close: string) {
  return (value: string) => enabled ? `${open}${value}${close}` : value
}

export const colors = {
  cyan: formatter('\x1b[36m', '\x1b[39m'),
  dim: formatter('\x1b[2m', '\x1b[22m'),
  green: formatter('\x1b[32m', '\x1b[39m'),
  red: formatter('\x1b[31m', '\x1b[39m'),
  yellow: formatter('\x1b[33m', '\x1b[39m'),
}

export const logger = console

export function formatHolocronStep({
  icon = colors.cyan('⏹'),
  message,
}: {
  icon?: string
  message: string
}) {
  return `${icon} ${colors.cyan('holocron')} ${message}`
}

export function formatHolocronSuccess(message: string) {
  return formatHolocronStep({ icon: colors.green('✓'), message })
}

export function formatHolocronWarning(message: string) {
  return formatHolocronStep({ icon: colors.yellow('▲'), message })
}

export function formatHolocronError(message: string) {
  return formatHolocronStep({ icon: colors.red('✗'), message })
}

function formatMdxErrorLocation(source: string | undefined, line: number | undefined): string | undefined {
  if (source && line) return `${colors.cyan(source)}:${colors.yellow(String(line))}`
  if (source) return colors.cyan(source)
  if (line) return `line ${colors.yellow(String(line))}`
  return undefined
}

export function formatMdxError(error: SafeMdxError, source?: string): string {
  const location = formatMdxErrorLocation(source, error.line)
  return formatHolocronWarning(`${colors.yellow('MDX')}${location ? ` ${location}` : ''} ${error.message}`)
}

export function logMdxError(error: SafeMdxError, source?: string): void {
  try {
    logger.warn(formatMdxError(error, source))
  } catch {
    // Best-effort terminal output only. Rendering can continue with the
    // placeholder/null node that safe-mdx already returns for recoverable errors.
  }
}

/* ── Code frame for parse errors ────────────────────────────────────── */

const FRAME_CONTEXT_LINES = 3

/**
 * Build a code frame string showing the error location in source.
 * 3 lines of context before and after, with a `>` marker on the error line
 * and a `^` caret pointing at the column.
 */
export function buildCodeFrame(source: string, line: number, column?: number): string {
  const lines = source.split('\n')
  const start = Math.max(0, line - 1 - FRAME_CONTEXT_LINES)
  const end = Math.min(lines.length, line + FRAME_CONTEXT_LINES)
  const gutterWidth = String(end).length

  const frameLines: string[] = []
  for (let i = start; i < end; i++) {
    const lineNum = String(i + 1).padStart(gutterWidth, ' ')
    const marker = i === line - 1 ? colors.red('>') : ' '
    const lineContent = lines[i] ?? ''
    frameLines.push(`${marker} ${colors.dim(lineNum)} | ${lineContent}`)

    // Add caret line under the error line
    if (i === line - 1 && column && column > 0) {
      const padding = ' '.repeat(gutterWidth + 3) + ' '.repeat(column - 1)
      frameLines.push(`  ${padding}${colors.red('^')}`)
    }
  }
  return frameLines.join('\n')
}

/**
 * Structured MDX parse error with source location and code frame.
 * Returned by normalizeMdx/processMdx when remark fails to parse.
 * Properties are designed for both terminal output and dev error overlay rendering.
 */
export class HolocronMdxParseError extends Error {
  /** 1-based line number in the MDX source */
  line: number
  /** 1-based column number in the MDX source */
  column: number | undefined
  /** The slug or file path of the MDX page */
  source: string | undefined
  /** The reason/description from the parser (without location prefix) */
  reason: string
  /** Pre-formatted code frame for terminal output */
  codeFrame: string
  /** The raw MDX source (for dev error overlay rendering) */
  mdxSource: string

  constructor({
    reason,
    line,
    column,
    source,
    mdxSource,
  }: {
    reason: string
    line: number
    column?: number
    source?: string
    mdxSource: string
  }) {
    const locationStr = source
      ? `${source}:${line}${column ? ':' + column : ''}`
      : `line ${line}${column ? ', column ' + column : ''}`
    const codeFrame = buildCodeFrame(mdxSource, line, column)

    const fullMessage = [
      `MDX parse error in ${locationStr}`,
      '',
      reason,
      '',
      codeFrame,
    ].join('\n')

    super(fullMessage)
    this.name = 'HolocronMdxParseError'
    this.reason = reason
    this.line = line
    this.column = column
    this.source = source
    this.codeFrame = codeFrame
    this.mdxSource = mdxSource
  }

  toJSON() {
    return {
      reason: this.reason,
      line: this.line,
      column: this.column,
      source: this.source,
      mdxSource: this.mdxSource,
    }
  }
}

/** Shape of remark's VFileMessage error (line/column/reason). */
type VFileMessageLike = { line: number; column?: number; reason: string }

/** Type guard for remark/VFileMessage errors thrown during MDX parsing. */
export function isVFileMessage(err: unknown): err is VFileMessageLike {
  if (err == null || typeof err !== 'object') return false
  const line = Reflect.get(err, 'line')
  const reason = Reflect.get(err, 'reason')
  const column = Reflect.get(err, 'column')
  return (
    typeof line === 'number' &&
    typeof reason === 'string' &&
    (column === undefined || typeof column === 'number')
  )
}

/** Extract line, column, and reason from an unknown error.
 *  Handles VFileMessage (remark), HolocronMdxParseError, and generic Error. */
export function extractParseErrorInfo(err: unknown): { line: number; column: number | undefined; reason: string } {
  if (isVFileMessage(err)) {
    return { line: err.line, column: err.column, reason: err.reason }
  }
  return { line: 1, column: undefined, reason: err instanceof Error ? err.message : String(err) }
}
