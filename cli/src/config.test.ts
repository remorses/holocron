// Tests for multi-URL config storage.
// Uses HOLOCRON_CONFIG_DIR to isolate tests from real ~/.holocron/config.json.

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { normalizeUrl, loadConfig, saveConfig, setServerAuth, clearServerAuth, getSessionToken } from './config.ts'

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
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-config-test-'))
    process.env.HOLOCRON_CONFIG_DIR = tmpDir
  })

  afterEach(() => {
    delete process.env.HOLOCRON_CONFIG_DIR
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('setServerAuth stores tokens keyed by URL', () => {
    setServerAuth('https://holocron.so', 'token-prod')
    setServerAuth('https://preview.holocron.so/', 'token-preview')

    const config = loadConfig()
    expect(config.servers?.['https://holocron.so']?.sessionToken).toBe('token-prod')
    expect(config.servers?.['https://preview.holocron.so']?.sessionToken).toBe('token-preview')
  })

  test('setServerAuth does not overwrite other servers', () => {
    setServerAuth('https://holocron.so', 'token-prod')
    setServerAuth('https://preview.holocron.so', 'token-preview')

    const config = loadConfig()
    expect(Object.keys(config.servers || {})).toHaveLength(2)
    expect(config.servers?.['https://holocron.so']?.sessionToken).toBe('token-prod')
  })

  test('clearServerAuth removes only the specified server', () => {
    setServerAuth('https://holocron.so', 'token-prod')
    setServerAuth('https://preview.holocron.so', 'token-preview')
    clearServerAuth('https://preview.holocron.so')

    const config = loadConfig()
    expect(config.servers?.['https://preview.holocron.so']).toBeUndefined()
    expect(config.servers?.['https://holocron.so']?.sessionToken).toBe('token-prod')
  })

  test('getSessionToken returns token for the right URL', () => {
    setServerAuth('https://holocron.so', 'token-prod')
    setServerAuth('https://preview.holocron.so', 'token-preview')

    expect(getSessionToken('https://holocron.so')).toBe('token-prod')
    expect(getSessionToken('https://preview.holocron.so')).toBe('token-preview')
    expect(getSessionToken('https://unknown.example.com')).toBeUndefined()
  })

  test('loadConfig returns empty object for missing config file', () => {
    const config = loadConfig()
    expect(config).toEqual({})
  })

  test('saveConfig creates dir and writes file', () => {
    const nested = path.join(tmpDir, 'nested')
    process.env.HOLOCRON_CONFIG_DIR = nested

    saveConfig({ servers: { 'https://holocron.so': { sessionToken: 'x' } } })

    const raw = JSON.parse(fs.readFileSync(path.join(nested, 'config.json'), 'utf-8'))
    expect(raw.servers['https://holocron.so'].sessionToken).toBe('x')
  })
})
