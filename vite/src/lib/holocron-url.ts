/**
 * Hosted Holocron service URL helpers.
 *
 * Runtime integrations default to https://holocron.so but can be pointed at a
 * custom deployment for local development or self-hosted testing.
 */

const DEFAULT_HOLOCRON_URL = 'https://holocron.so'

function normalizeBaseUrl(value: string | undefined): string {
  const raw = value?.trim() || DEFAULT_HOLOCRON_URL
  return raw.replace(/\/+$/, '')
}

function readHolocronUrlOverride(): string | undefined {
  const processEnv = typeof process === 'undefined' ? undefined : process.env
  return import.meta.env?.VITE_HOLOCRON_URL
    ?? import.meta.env?.HOLOCRON_URL
    ?? processEnv?.HOLOCRON_URL
}

export function getHolocronBaseUrl(): string {
  return normalizeBaseUrl(readHolocronUrlOverride())
}

export function holocronUrl(path: string): string {
  return new URL(path, getHolocronBaseUrl()).toString()
}

/**
 * Environment variable names that can hold a Holocron API key (`holo_xxx`).
 * Checked in order; the first defined value wins. Add new aliases here.
 */
export const HOLOCRON_API_KEY_ENV_NAMES = ['HOLOCRON_KEY', 'HOLOCRON_TOKEN'] as const

/**
 * Read the Holocron API key from environment variables.
 * Returns the first defined value from HOLOCRON_API_KEY_ENV_NAMES, or `''`.
 */
export function getHolocronApiKey(): string {
  const processEnv = typeof process === 'undefined' ? undefined : process.env
  if (!processEnv) return ''
  for (const name of HOLOCRON_API_KEY_ENV_NAMES) {
    if (processEnv[name]) return processEnv[name]!
  }
  return ''
}

/**
 * Check whether any Holocron API key env var is set.
 */
export function hasHolocronApiKey(): boolean {
  return getHolocronApiKey() !== ''
}
