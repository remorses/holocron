// CLI config file management. Stores auth session token in ~/.holocron/config.json.

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const CONFIG_DIR = path.join(os.homedir(), '.holocron')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

export interface CliConfig {
  /** BetterAuth bearer token from device flow */
  sessionToken?: string
  /** Website base URL */
  baseUrl?: string
  /** Cached default org id */
  orgId?: string
}

export function loadConfig(): CliConfig {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
    return JSON.parse(raw) as CliConfig
  } catch {
    return {}
  }
}

export function saveConfig(config: CliConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n')
}

export function updateConfig(partial: Partial<CliConfig>): void {
  const existing = loadConfig()
  saveConfig({ ...existing, ...partial })
}

export function getSessionToken(): string | undefined {
  return loadConfig().sessionToken
}

export function getBaseUrl(): string {
  return loadConfig().baseUrl || 'https://holocron.so'
}

export function requireAuth(): { sessionToken: string; baseUrl: string } {
  const config = loadConfig()
  if (!config.sessionToken) {
    throw new Error('Not logged in. Run `holocron login` first.')
  }
  return {
    sessionToken: config.sessionToken,
    baseUrl: config.baseUrl || 'https://holocron.so',
  }
}
