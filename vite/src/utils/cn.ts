/**
 * Holocron className joiner used by the sidebar port.
 */

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}
