// CLI config file management. Stores auth session tokens in ~/.holocron/config.json,
// keyed by normalized server URL so multiple environments (prod, preview, etc.)
// can coexist without overwriting each other.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const CONFIG_DIR = path.join(os.homedir(), '.holocron')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

const DEFAULT_URL = 'https://holocron.so'

export interface CliConfig {
  /** Auth credentials keyed by normalized base URL */
  servers?: Record<string, { sessionToken: string }>
}

/** Strip trailing slashes so the same server always gets the same key. */
export function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

export function loadConfig(): CliConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as CliConfig
  } catch {
    return {}
  }
}

export function saveConfig(config: CliConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n')
}

/** Save a session token for a specific server URL. */
export function setServerAuth(baseUrl: string, sessionToken: string): void {
  const config = loadConfig()
  const url = normalizeUrl(baseUrl)
  config.servers = config.servers || {}
  config.servers[url] = { sessionToken }
  saveConfig(config)
}

/** Remove auth for a specific server URL. */
export function clearServerAuth(baseUrl: string): void {
  const config = loadConfig()
  const url = normalizeUrl(baseUrl)
  if (config.servers) {
    delete config.servers[url]
  }
  saveConfig(config)
}

/** Resolve the base URL from env var or default. */
export function getBaseUrl(): string {
  return process.env.HOLOCRON_API_URL || DEFAULT_URL
}

/** Get the session token for a specific base URL. */
export function getSessionToken(baseUrl?: string): string | undefined {
  const url = normalizeUrl(baseUrl || getBaseUrl())
  return loadConfig().servers?.[url]?.sessionToken
}

/** Get auth for a specific URL. Throws if not logged in for that server. */
export function requireAuth(baseUrl?: string): { sessionToken: string; baseUrl: string } {
  const url = normalizeUrl(baseUrl || getBaseUrl())
  const token = loadConfig().servers?.[url]?.sessionToken
  if (!token) {
    throw new Error(`Not logged in to ${url}. Run \`holocron login --api-url ${url}\` first.`)
  }
  return { sessionToken: token, baseUrl: url }
}
