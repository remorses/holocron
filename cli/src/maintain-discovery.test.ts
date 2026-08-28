// Tests prompt reference extraction and changed-source matching for maintain.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import childProcess from 'node:child_process'
import { afterEach, describe, expect, test } from 'vitest'
import {
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
        "urls": [
          "https://github.com/example/project/releases",
        ],
      }
    `)
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
})
