// Tests for multi-URL config storage.

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { normalizeUrl } from './config.ts'

describe('normalizeUrl', () => {
  test('strips trailing slashes', () => {
    expect(normalizeUrl('https://holocron.so/')).toBe('https://holocron.so')
    expect(normalizeUrl('https://holocron.so///')).toBe('https://holocron.so')
  })

  test('preserves url without trailing slash', () => {
    expect(normalizeUrl('https://holocron.so')).toBe('https://holocron.so')
  })

  test('preserves path segments', () => {
    expect(normalizeUrl('https://preview.holocron.so/v2/')).toBe('https://preview.holocron.so/v2')
  })

  test('different urls produce different keys', () => {
    const prod = normalizeUrl('https://holocron.so')
    const preview = normalizeUrl('https://preview.holocron.so')
    expect(prod).not.toBe(preview)
  })

  test('same url with and without trailing slash produces same key', () => {
    expect(normalizeUrl('https://holocron.so/')).toBe(normalizeUrl('https://holocron.so'))
  })
})

describe('config file operations', () => {
  const configDir = path.join(os.homedir(), '.holocron')
  const configFile = path.join(configDir, 'config.json')
  let backup: string | null = null

  beforeEach(() => {
    try {
      backup = fs.readFileSync(configFile, 'utf-8')
    } catch {
      backup = null
    }
  })

  afterEach(() => {
    if (backup !== null) {
      fs.writeFileSync(configFile, backup)
    } else {
      try {
        fs.unlinkSync(configFile)
      } catch {
        // ignore
      }
    }
  })

  test('setServerAuth stores tokens keyed by URL', async () => {
    const { setServerAuth, loadConfig } = await import('./config.ts')

    setServerAuth('https://holocron.so', 'token-prod')
    setServerAuth('https://preview.holocron.so/', 'token-preview')

    const config = loadConfig()
    expect(config.servers?.['https://holocron.so']?.sessionToken).toBe('token-prod')
    expect(config.servers?.['https://preview.holocron.so']?.sessionToken).toBe('token-preview')
  })

  test('setServerAuth does not overwrite other servers', async () => {
    const { setServerAuth, loadConfig } = await import('./config.ts')

    setServerAuth('https://holocron.so', 'token-prod')
    setServerAuth('https://preview.holocron.so', 'token-preview')

    const config = loadConfig()
    expect(Object.keys(config.servers || {})).toHaveLength(2)
    expect(config.servers?.['https://holocron.so']?.sessionToken).toBe('token-prod')
  })

  test('clearServerAuth removes only the specified server', async () => {
    const { setServerAuth, clearServerAuth, loadConfig } = await import('./config.ts')

    setServerAuth('https://holocron.so', 'token-prod')
    setServerAuth('https://preview.holocron.so', 'token-preview')
    clearServerAuth('https://preview.holocron.so')

    const config = loadConfig()
    expect(config.servers?.['https://preview.holocron.so']).toBeUndefined()
    expect(config.servers?.['https://holocron.so']?.sessionToken).toBe('token-prod')
  })

  test('getSessionToken returns token for the right URL', async () => {
    const { setServerAuth, getSessionToken } = await import('./config.ts')

    setServerAuth('https://holocron.so', 'token-prod')
    setServerAuth('https://preview.holocron.so', 'token-preview')

    expect(getSessionToken('https://holocron.so')).toBe('token-prod')
    expect(getSessionToken('https://preview.holocron.so')).toBe('token-preview')
    expect(getSessionToken('https://unknown.example.com')).toBeUndefined()
  })
})
