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
