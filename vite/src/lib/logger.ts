// Tiny terminal color helpers and console-backed logger for Holocron build logs.
// Vendored instead of depending on picocolors so the Vite plugin stays dependency-light.

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
