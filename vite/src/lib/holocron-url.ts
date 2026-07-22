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

/**
 * Prefix the Vite base path to a root-relative URL (logo, favicon, and other
 * docs.json asset paths). External URLs, protocol-relative URLs, and
 * non-root-relative paths pass through unchanged. Paths in docs.json are
 * written relative to the site root (Mintlify convention) and must not
 * include the base themselves — this helper applies it in one place so the
 * same config works with any `base` (e.g. `/docs/`) or none.
 */
export function withBasePath(url: string): string
export function withBasePath(url: string | undefined): string | undefined
export function withBasePath(url: string | undefined): string | undefined {
  if (!url) return url
  if (!url.startsWith('/') || url.startsWith('//')) return url
  let base = ''
  try {
    const raw = import.meta.env.BASE_URL
    if (raw && raw !== '/') base = raw.replace(/\/$/, '')
  } catch {
    base = ''
  }
  if (!base) return url
  return base + url
}
