// Tests for base path detection from deploy build output.
// The Vite plugin writes dist/.holocron/holocron-deploy.json with the resolved
// Vite base during deploy builds; readBuiltBasePath normalizes it so the CLI
// can forward it as deployment metadata (basePath).

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { readBuiltBasePath, DEPLOY_BASE_PATH_RE } from './deploy.ts'

let tmpDir: string

function writeMeta(content: string) {
  const dir = path.join(tmpDir, 'dist/.holocron')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'holocron-deploy.json'), content)
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-deploy-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('readBuiltBasePath', () => {
  test('returns undefined when metadata file is missing', () => {
    expect(readBuiltBasePath(tmpDir)).toBeUndefined()
  })

  test('returns undefined for root base', () => {
    writeMeta(JSON.stringify({ base: '/' }))
    expect(readBuiltBasePath(tmpDir)).toBeUndefined()
  })

  test('returns normalized base with trailing slash', () => {
    writeMeta(JSON.stringify({ base: '/docs/' }))
    expect(readBuiltBasePath(tmpDir)).toBe('/docs/')
  })

  test('adds missing trailing slash', () => {
    writeMeta(JSON.stringify({ base: '/docs' }))
    expect(readBuiltBasePath(tmpDir)).toBe('/docs/')
  })

  test('adds missing leading slash', () => {
    writeMeta(JSON.stringify({ base: 'docs/' }))
    expect(readBuiltBasePath(tmpDir)).toBe('/docs/')
  })

  test('handles nested base paths', () => {
    writeMeta(JSON.stringify({ base: '/help/docs/' }))
    expect(readBuiltBasePath(tmpDir)).toBe('/help/docs/')
  })

  test('returns undefined for relative base "./"', () => {
    writeMeta(JSON.stringify({ base: './' }))
    expect(readBuiltBasePath(tmpDir)).toBeUndefined()
  })

  test('returns undefined for invalid JSON', () => {
    writeMeta('not json')
    expect(readBuiltBasePath(tmpDir)).toBeUndefined()
  })

  test('returns undefined for non-string base', () => {
    writeMeta(JSON.stringify({ base: 42 }))
    expect(readBuiltBasePath(tmpDir)).toBeUndefined()
  })

  test('returns undefined for full-URL bases (external CDN)', () => {
    writeMeta(JSON.stringify({ base: 'https://cdn.example.com/docs/' }))
    expect(readBuiltBasePath(tmpDir)).toBeUndefined()
    writeMeta(JSON.stringify({ base: '//cdn.example.com/docs/' }))
    expect(readBuiltBasePath(tmpDir)).toBeUndefined()
  })

  test('returns bases that fail the deploy API regex so callers can reject them', () => {
    writeMeta(JSON.stringify({ base: '/Docs/' }))
    const detected = readBuiltBasePath(tmpDir)
    expect(detected).toBe('/Docs/')
    expect(DEPLOY_BASE_PATH_RE.test(detected!)).toBe(false)
  })
})

describe('DEPLOY_BASE_PATH_RE', () => {
  test('accepts valid base paths', () => {
    expect(DEPLOY_BASE_PATH_RE.test('/docs/')).toBe(true)
    expect(DEPLOY_BASE_PATH_RE.test('/help/docs-v2/')).toBe(true)
  })

  test('rejects uppercase, dots, and missing slashes', () => {
    expect(DEPLOY_BASE_PATH_RE.test('/Docs/')).toBe(false)
    expect(DEPLOY_BASE_PATH_RE.test('/docs.v2/')).toBe(false)
    expect(DEPLOY_BASE_PATH_RE.test('/docs')).toBe(false)
  })
})
