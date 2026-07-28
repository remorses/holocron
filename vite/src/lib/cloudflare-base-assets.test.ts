import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'

import {
  baseToAssetsDir,
  nestClientOutputUnderBase,
} from './cloudflare-base-assets.ts'

const tempRoots: string[] = []

function makeClientOutDir(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-cf-assets-'))
  tempRoots.push(root)
  const clientOutDir = path.join(root, 'client')

  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(clientOutDir, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }

  return clientOutDir
}

/** Sorted list of every file path inside `dir`, relative and posix-style. */
function listFiles(dir: string): string[] {
  const out: string[] = []
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else out.push(path.relative(dir, full).split(path.sep).join('/'))
    }
  }
  walk(dir)
  return out.sort()
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('baseToAssetsDir', () => {
  test('maps vite bases to asset directory names', () => {
    expect({
      root: baseToAssetsDir('/'),
      single: baseToAssetsDir('/docs/'),
      noTrailingSlash: baseToAssetsDir('/docs'),
      nested: baseToAssetsDir('/en/docs/'),
      absoluteUrl: baseToAssetsDir('https://cdn.example.com/app/'),
    }).toMatchInlineSnapshot(`
      {
        "absoluteUrl": undefined,
        "nested": "en/docs",
        "noTrailingSlash": "docs",
        "root": undefined,
        "single": "docs",
      }
    `)
  })
})

describe('nestClientOutputUnderBase', () => {
  test('moves assets under the base folder and keeps .assetsignore at the root', () => {
    const clientOutDir = makeClientOutDir({
      '.assetsignore': 'wrangler.json\n',
      'assets/app-abc123.js': 'console.log(1)',
      'assets/style-abc123.css': 'body{}',
      'icons/logo.svg': '<svg />',
    })

    const moved = nestClientOutputUnderBase({ clientOutDir, base: '/docs/' })

    expect({ moved, files: listFiles(clientOutDir) }).toMatchInlineSnapshot(`
      {
        "files": [
          ".assetsignore",
          "docs/assets/app-abc123.js",
          "docs/assets/style-abc123.css",
          "docs/icons/logo.svg",
        ],
        "moved": "docs",
      }
    `)
  })

  test('handles a multi-segment base', () => {
    const clientOutDir = makeClientOutDir({
      '.assetsignore': 'wrangler.json\n',
      'assets/app.js': 'console.log(1)',
    })

    const moved = nestClientOutputUnderBase({ clientOutDir, base: '/en/docs/' })

    expect({ moved, files: listFiles(clientOutDir) }).toMatchInlineSnapshot(`
      {
        "files": [
          ".assetsignore",
          "en/docs/assets/app.js",
        ],
        "moved": "en/docs",
      }
    `)
  })

  test('handles a public folder that already has the base name', () => {
    const clientOutDir = makeClientOutDir({
      '.assetsignore': 'wrangler.json\n',
      'assets/app.js': 'console.log(1)',
      'docs/handbook.pdf': 'pdf',
    })

    const moved = nestClientOutputUnderBase({ clientOutDir, base: '/docs/' })

    expect({ moved, files: listFiles(clientOutDir) }).toMatchInlineSnapshot(`
      {
        "files": [
          ".assetsignore",
          "docs/assets/app.js",
          "docs/docs/handbook.pdf",
        ],
        "moved": "docs",
      }
    `)
  })

  test('is a no-op for the root base', () => {
    const clientOutDir = makeClientOutDir({ 'assets/app.js': 'console.log(1)' })

    const moved = nestClientOutputUnderBase({ clientOutDir, base: '/' })

    expect({ moved, files: listFiles(clientOutDir) }).toMatchInlineSnapshot(`
      {
        "files": [
          "assets/app.js",
        ],
        "moved": undefined,
      }
    `)
  })

  test('does not double-nest when called twice', () => {
    const clientOutDir = makeClientOutDir({
      '.assetsignore': 'wrangler.json\n',
      'assets/app.js': 'console.log(1)',
    })

    const first = nestClientOutputUnderBase({ clientOutDir, base: '/docs/' })
    const second = nestClientOutputUnderBase({ clientOutDir, base: '/docs/' })

    expect({ first, second, files: listFiles(clientOutDir) })
      .toMatchInlineSnapshot(`
        {
          "files": [
            ".assetsignore",
            "docs/assets/app.js",
          ],
          "first": "docs",
          "second": undefined,
        }
      `)
  })
})
