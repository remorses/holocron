// Centralized CLI logger for Holocron commands.
// Returns formatted strings so callers can route to output.log / output.error
// (goke's injected console) or plain console. Uses goke's built-in colors
// (vendored picocolors) so no extra dependency is needed.

import { colors } from 'goke'

export { colors }

/** Formatted log helpers — each returns a string, does not print. */
export const logger = {
  /** Neutral step: cyan ● */
  step(msg: string) {
    return `${colors.cyan('●')} ${colors.cyan('holocron')} ${msg}`
  },
  /** Success: green ✓ */
  success(msg: string) {
    return `${colors.green('✓')} ${colors.cyan('holocron')} ${msg}`
  },
  /** Error: red ✗ with red message */
  error(msg: string) {
    return `${colors.red('✗')} ${colors.cyan('holocron')} ${colors.red(msg)}`
  },
  /** Warning: yellow ▲ with yellow message */
  warn(msg: string) {
    return `${colors.yellow('▲')} ${colors.cyan('holocron')} ${colors.yellow(msg)}`
  },
  /** Informational: dim ● */
  info(msg: string) {
    return `${colors.dim('●')} ${colors.cyan('holocron')} ${msg}`
  },
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
