// Tests prompt reference extraction and changed-source matching for maintain.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import childProcess from 'node:child_process'
import { afterEach, describe, expect, test } from 'vitest'
import {
  discoverMaintainPages,
  extractPromptReferences,
  matchChangedReferences,
  parseFrontmatterObject,
} from './maintain-discovery.ts'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

function createRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-maintain-'))
  tempDirs.push(repoRoot)
  fs.mkdirSync(path.join(repoRoot, 'docs/guides'), { recursive: true })
  fs.mkdirSync(path.join(repoRoot, 'src/api'), { recursive: true })
  fs.writeFileSync(path.join(repoRoot, 'src/api/users.ts'), 'export const users = []\n')
  fs.writeFileSync(path.join(repoRoot, 'src/config.ts'), 'export const config = {}\n')
  return repoRoot
}

describe('maintain prompt references', () => {
  test('extracts generation prompt paths and URLs', () => {
    const repoRoot = createRepo()
    const pagePath = path.join(repoRoot, 'docs/guides/authentication.mdx')
    fs.writeFileSync(pagePath, '---\ntitle: Authentication\n---\n')
    const prompt = [
      'Write an authentication guide from @../../src/api/ and @../../src/config.ts.',
      'Use [the releases](https://github.com/Example/Project/releases/).',
      'Contact docs@example.com for questions.',
    ].join('\n')

    expect(extractPromptReferences({ prompt, pagePath, repoRoot })).toMatchInlineSnapshot(`
      {
        "local": [
          {
            "kind": "directory",
            "path": "src/api",
          },
          {
            "kind": "file",
            "path": "src/config.ts",
          },
        ],
        "urls": [],
      }
    `)
  })

  test('extracts only @https URL references', () => {
    const repoRoot = createRepo()
    const pagePath = path.join(repoRoot, 'docs/guides/authentication.mdx')
    fs.writeFileSync(pagePath, '---\ntitle: Authentication\n---\n')
    const prompt = [
      'Write from @https://github.com/Example/Project/releases/.',
      'Ignore https://github.com/Example/Project and [docs](https://example.com/docs).',
    ].join('\n')

    expect(extractPromptReferences({ prompt, pagePath, repoRoot })).toMatchInlineSnapshot(`
      {
        "local": [],
        "urls": [
          "https://github.com/example/project/releases",
        ],
      }
    `)
  })

  test('resolves @/ paths from the repository root', () => {
    const repoRoot = createRepo()
    const pagePath = path.join(repoRoot, 'docs/guides/authentication.mdx')
    fs.writeFileSync(pagePath, '---\ntitle: Authentication\n---\n')
    const prompt = [
      'Write an authentication guide from @/src/api/ and @/src/config.ts.',
      'Contact docs@example.com for questions.',
    ].join('\n')

    expect(extractPromptReferences({ prompt, pagePath, repoRoot })).toMatchInlineSnapshot(`
      {
        "local": [
          {
            "kind": "directory",
            "path": "src/api",
          },
          {
            "kind": "file",
            "path": "src/config.ts",
          },
        ],
        "urls": [],
      }
    `)
  })

  test('mixes repo-root and page-relative references', () => {
    const repoRoot = createRepo()
    const pagePath = path.join(repoRoot, 'docs/guides/authentication.mdx')
    fs.writeFileSync(pagePath, '---\ntitle: Authentication\n---\n')
    fs.writeFileSync(path.join(repoRoot, 'docs/guides/sessions.mdx'), '---\ntitle: Sessions\n---\n')

    expect(extractPromptReferences({
      prompt: 'Use @/src/config.ts and @./sessions.mdx.',
      pagePath,
      repoRoot,
    })).toMatchInlineSnapshot(`
      {
        "local": [
          {
            "kind": "file",
            "path": "src/config.ts",
          },
          {
            "kind": "file",
            "path": "docs/guides/sessions.mdx",
          },
        ],
        "urls": [],
      }
    `)
  })

  test('rejects @/ paths that escape the repository', () => {
    const repoRoot = createRepo()
    const pagePath = path.join(repoRoot, 'docs/guides/authentication.mdx')
    fs.writeFileSync(pagePath, '---\ntitle: Authentication\n---\n')

    expect(() => extractPromptReferences({
      prompt: 'Do not read @/../secret.ts.',
      pagePath,
      repoRoot,
    })).toThrowError(/escapes the repository/)
  })

  test('matches full folders and individual files', () => {
    const references = {
      local: [
        { kind: 'directory' as const, path: 'src/api' },
        { kind: 'file' as const, path: 'src/config.ts' },
      ],
      urls: [],
    }

    expect(matchChangedReferences({
      references,
      changedFiles: ['src/api/users.ts', 'README.md'],
      changedUrls: [],
    })).toMatchInlineSnapshot(`
      [
        "src/api",
      ]
    `)

    expect(matchChangedReferences({
      references,
      changedFiles: ['src/config.ts'],
      changedUrls: [],
    })).toMatchInlineSnapshot(`
      [
        "src/config.ts",
      ]
    `)
  })

  test('keeps references to files deleted by the current change', () => {
    const repoRoot = createRepo()
    const pagePath = path.join(repoRoot, 'docs/guides/configuration.mdx')
    fs.writeFileSync(pagePath, '---\ntitle: Configuration\n---\n')
    childProcess.execFileSync('git', ['init'], { cwd: repoRoot })
    childProcess.execFileSync('git', ['add', '.'], { cwd: repoRoot })
    childProcess.execFileSync('git', [
      '-c', 'user.name=Holocron', '-c', 'user.email=maintain@example.com',
      'commit', '-m', 'initial',
    ], { cwd: repoRoot })
    const baseSha = childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
    fs.unlinkSync(path.join(repoRoot, 'src/config.ts'))

    expect(extractPromptReferences({
      prompt: 'Write this page from @../../src/config.ts.',
      pagePath,
      repoRoot,
      baseSha,
    })).toMatchInlineSnapshot(`
      {
        "local": [
          {
            "kind": "file",
            "path": "src/config.ts",
          },
        ],
        "urls": [],
      }
    `)
  })

  test('parses the original generation prompt from frontmatter', () => {
    const source = [
      '---',
      'title: Authentication',
      'prompt: |',
      '  Write the authentication guide from @../../src/api/.',
      '  Include complete examples.',
      '---',
      '',
      '# Authentication',
    ].join('\n')

    expect(parseFrontmatterObject(source)).toMatchInlineSnapshot(`
      {
        "prompt": "Write the authentication guide from @../../src/api/.
      Include complete examples.
      ",
        "title": "Authentication",
      }
    `)
  })

  test('matches @https URL references against changed URLs', () => {
    expect(matchChangedReferences({
      references: {
        local: [],
        urls: ['https://github.com/example/project/releases'],
      },
      changedFiles: [],
      changedUrls: ['https://github.com/Example/Project/releases/'],
    })).toMatchInlineSnapshot(`
      [
        "https://github.com/example/project/releases",
      ]
    `)

    expect(matchChangedReferences({
      references: {
        local: [],
        urls: ['https://github.com/example/project/releases'],
      },
      changedFiles: [],
      changedUrls: ['https://github.com/example/project'],
    })).toMatchInlineSnapshot(`
      []
    `)
  })
})

describe('maintain site discovery', () => {
  function writePage(repoRoot: string, file = 'index.mdx') {
    fs.writeFileSync(path.join(repoRoot, file), '---\ntitle: Home\nprompt: Write from @/src/config.ts.\n---\n')
  }

  function track(repoRoot: string) {
    childProcess.execFileSync('git', ['init'], { cwd: repoRoot })
    childProcess.execFileSync('git', ['add', '.'], { cwd: repoRoot })
  }

  test('discovers pages under a Holocron docs.json with name and schema', () => {
    const repoRoot = createRepo()
    fs.writeFileSync(path.join(repoRoot, 'docs.json'), JSON.stringify({
      $schema: 'https://holocron.so/docs.json',
      name: 'Acme',
    }))
    writePage(repoRoot)
    track(repoRoot)

    expect(discoverMaintainPages(repoRoot).map((page) => page.path)).toMatchInlineSnapshot(`
      [
        "index.mdx",
      ]
    `)
  })

  test('ignores docs.json without a name or Holocron schema', () => {
    const repoRoot = createRepo()
    fs.writeFileSync(path.join(repoRoot, 'docs.json'), JSON.stringify({
      $schema: 'https://mintlify.com/docs.json',
      name: 'Mintlify site',
    }))
    fs.mkdirSync(path.join(repoRoot, 'other'), { recursive: true })
    fs.writeFileSync(path.join(repoRoot, 'other/docs.json'), JSON.stringify({
      $schema: 'https://holocron.so/docs.json',
    }))
    fs.writeFileSync(path.join(repoRoot, 'other/index.mdx'), '---\ntitle: Other\n---\n')
    writePage(repoRoot)
    track(repoRoot)

    expect(discoverMaintainPages(repoRoot)).toMatchInlineSnapshot(`
      []
    `)
  })

  test('accepts docs.jsonc with a Holocron schema query string', () => {
    const repoRoot = createRepo()
    fs.writeFileSync(path.join(repoRoot, 'docs.jsonc'), `{
      // Holocron site
      "$schema": "https://holocron.so/docs.json?v=1",
      "name": "Acme",
    }`)
    writePage(repoRoot)
    track(repoRoot)

    expect(discoverMaintainPages(repoRoot).map((page) => ({ path: page.path, siteRoot: page.siteRoot }))).toMatchInlineSnapshot(`
      [
        {
          "path": "index.mdx",
          "siteRoot": ".",
        },
      ]
    `)
  })
})
