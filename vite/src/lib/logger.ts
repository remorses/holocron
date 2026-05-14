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

function getMdxErrorTypeLabel(type: SafeMdxError['type']): string {
  switch (type) {
    case 'missing-component': return 'missing component'
    case 'validation': return 'validation'
    case 'expression': return 'expression'
    case 'esm-import': return 'ESM import'
    default: return type
  }
}

function formatMdxErrorMessage(message: string): string {
  const unsupportedComponent = /^Unsupported jsx component (.+)$/.exec(message)
  if (unsupportedComponent) {
    return `Unsupported JSX component ${colors.yellow(unsupportedComponent[1]!)}`
  }

  return message
}

export function formatMdxError(error: SafeMdxError, source?: string): string {
  const lines = [
    formatHolocronWarning(`${colors.yellow('MDX')} ${getMdxErrorTypeLabel(error.type)}`),
    `  ${colors.dim('reason')} ${formatMdxErrorMessage(error.message)}`,
  ]

  if (source) {
    lines.splice(1, 0, `  ${colors.dim('source')} ${colors.cyan(source)}`)
  } else if (error.line) {
    lines.splice(1, 0, `  ${colors.dim('line')} ${colors.yellow(String(error.line))}`)
  }

  if (source && error.line) {
    lines.splice(2, 0, `  ${colors.dim('line')} ${colors.yellow(String(error.line))}`)
  }

  if (error.type === 'missing-component') {
    lines.push(`  ${colors.dim('fix')} register the component or import it from this MDX file`)
  }

  return lines.join('\n')
}

export function logMdxError(error: SafeMdxError, source?: string): void {
  try {
    logger.warn(formatMdxError(error, source))
  } catch {
    // Best-effort terminal output only. Rendering can continue with the
    // placeholder/null node that safe-mdx already returns for recoverable errors.
  }
}
