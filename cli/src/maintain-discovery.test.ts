// Tests prompt reference extraction and changed-source matching for maintain.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import childProcess from 'node:child_process'
import { afterEach, describe, expect, test } from 'vitest'
import {
  discoverMaintainPages,
  extractPromptReferences,
  getChangedFiles,
  getChangedPatches,
  getGenerationPrompt,
  getWorkingTreeChanges,
  hasMissingLocalReferences,
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

  test('keeps missing local references so the page can be updated', () => {
    const repoRoot = createRepo()
    const pagePath = path.join(repoRoot, 'docs/guides/configuration.mdx')
    fs.writeFileSync(pagePath, '---\ntitle: Configuration\n---\n')
    fs.unlinkSync(path.join(repoRoot, 'src/config.ts'))

    const references = extractPromptReferences({
      prompt: 'Write this page from @/src/config.ts and @/src/gone/.',
      pagePath,
      repoRoot,
    })
    expect(references).toMatchInlineSnapshot(`
      {
        "local": [
          {
            "kind": "file",
            "path": "src/config.ts",
          },
          {
            "kind": "directory",
            "path": "src/gone",
          },
        ],
        "urls": [],
      }
    `)
    expect(hasMissingLocalReferences(repoRoot, references)).toBe(true)
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

  test('keeps valid pages when another page prompt is invalid', () => {
    const repoRoot = createRepo()
    fs.writeFileSync(path.join(repoRoot, 'docs.json'), JSON.stringify({
      $schema: 'https://holocron.so/docs.json',
      name: 'Acme',
    }))
    writePage(repoRoot)
    fs.writeFileSync(path.join(repoRoot, 'docs/guides/bad.mdx'), '---\ntitle: Bad\nprompt: Write from @/../secret.ts.\n---\n')
    track(repoRoot)

    expect(discoverMaintainPages(repoRoot).map((page) => ({
      path: page.path,
      promptError: page.promptError,
      local: page.references.local.map((reference) => reference.path),
    })).sort((a, b) => a.path.localeCompare(b.path))).toMatchInlineSnapshot(`
      [
        {
          "local": [],
          "path": "docs/guides/bad.mdx",
          "promptError": "Prompt reference escapes the repository: /../secret.ts",
        },
        {
          "local": [
            "src/config.ts",
          ],
          "path": "index.mdx",
          "promptError": undefined,
        },
      ]
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

describe('website page generation prompts', () => {
  const repoRoot = path.resolve(import.meta.dirname, '../..')
  const pagesDir = path.join(repoRoot, 'website/src/pages')

  function listMdxFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const next = path.join(dir, entry.name)
      if (entry.isDirectory()) return listMdxFiles(next)
      return entry.name.endsWith('.mdx') ? [next] : []
    })
  }

  test('every website MDX page has a generation prompt with real references', () => {
    const failures: string[] = []
    for (const absolutePath of listMdxFiles(pagesDir)) {
      const rel = path.relative(pagesDir, absolutePath).split(path.sep).join('/')
      const prompt = getGenerationPrompt(fs.readFileSync(absolutePath, 'utf8'))
      if (!prompt) {
        failures.push(`${rel}: missing prompt`)
        continue
      }
      if (/\n[ \t]*\n/.test(prompt)) failures.push(`${rel}: empty line in prompt`)
      try {
        const references = extractPromptReferences({ prompt, pagePath: absolutePath, repoRoot })
        if (references.local.length === 0 && references.urls.length === 0) {
          failures.push(`${rel}: no @/ or @https:// references`)
        }
      } catch (error) {
        failures.push(`${rel}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    expect(failures).toEqual([])
  })
})

describe('maintain git path lists', () => {
  function git(repoRoot: string, args: string[]) {
    return childProcess.execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
  }

  function commitAll(repoRoot: string, message: string) {
    git(repoRoot, ['add', '.'])
    git(repoRoot, [
      '-c', 'user.name=Holocron', '-c', 'user.email=maintain@example.com',
      'commit', '-m', message,
    ])
  }

  test('lists deleted files in the changed range', () => {
    const repoRoot = createRepo()
    git(repoRoot, ['init'])
    commitAll(repoRoot, 'initial')
    const from = git(repoRoot, ['rev-parse', 'HEAD']).trim()
    fs.unlinkSync(path.join(repoRoot, 'src/config.ts'))
    commitAll(repoRoot, 'delete config')
    const to = git(repoRoot, ['rev-parse', 'HEAD']).trim()

    expect(getChangedFiles(repoRoot, { from, to }).sort()).toMatchInlineSnapshot(`
      [
        "src/config.ts",
      ]
    `)
  })

  test('keeps rename and untracked paths intact', () => {
    const repoRoot = createRepo()
    git(repoRoot, ['init'])
    commitAll(repoRoot, 'initial')
    git(repoRoot, ['mv', 'src/config.ts', 'src/settings.ts'])
    fs.writeFileSync(path.join(repoRoot, 'src/new file.ts'), 'export {}\n')

    expect(getWorkingTreeChanges(repoRoot).sort()).toMatchInlineSnapshot(`
      [
        "src/new file.ts",
        "src/settings.ts",
      ]
    `)
  })
})

describe('maintain submodule file paths', () => {
  function git(cwd: string, args: string[]) {
    return childProcess.execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, GIT_ALLOW_PROTOCOL: 'file' },
    })
  }

  function configureGit(cwd: string) {
    git(cwd, ['config', 'user.name', 'Holocron'])
    git(cwd, ['config', 'user.email', 'maintain@example.com'])
  }

  function commitAll(cwd: string, message: string) {
    git(cwd, ['add', '.'])
    git(cwd, ['commit', '-m', message])
  }

  function createSubmoduleRepo() {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-maintain-sub-'))
    tempDirs.push(fixtureRoot)
    const submoduleSource = path.join(fixtureRoot, 'lib-source')
    const parentRepo = path.join(fixtureRoot, 'parent')

    fs.mkdirSync(path.join(submoduleSource, 'src'), { recursive: true })
    git(submoduleSource, ['init', '-b', 'main'])
    configureGit(submoduleSource)
    fs.writeFileSync(path.join(submoduleSource, 'src/widget.ts'), 'export const widget = 1\n')
    fs.writeFileSync(path.join(submoduleSource, 'src/other.ts'), 'export const other = 1\n')
    commitAll(submoduleSource, 'initial submodule')

    fs.mkdirSync(path.join(parentRepo, 'src'), { recursive: true })
    git(parentRepo, ['init', '-b', 'main'])
    configureGit(parentRepo)
    fs.writeFileSync(path.join(parentRepo, 'src/root.ts'), 'export const root = 1\n')
    fs.mkdirSync(path.join(parentRepo, 'docs'), { recursive: true })
    fs.writeFileSync(path.join(parentRepo, 'docs/widget.mdx'), '---\ntitle: Widget\n---\n')
    commitAll(parentRepo, 'initial parent')
    git(parentRepo, ['-c', 'protocol.file.allow=always', 'submodule', 'add', submoduleSource, 'vendor/lib'])
    commitAll(parentRepo, 'add submodule')
    return parentRepo
  }

  test('lists dirty inner submodule files instead of the gitlink', () => {
    const repoRoot = createSubmoduleRepo()
    fs.appendFileSync(path.join(repoRoot, 'vendor/lib/src/widget.ts'), 'export const dirty = true\n')

    expect(getChangedFiles(repoRoot).sort()).toMatchInlineSnapshot(`
      [
        "vendor/lib/src/widget.ts",
      ]
    `)
    expect(getWorkingTreeChanges(repoRoot).sort()).toMatchInlineSnapshot(`
      [
        "vendor/lib/src/widget.ts",
      ]
    `)

    const pagePath = path.join(repoRoot, 'docs/widget.mdx')
    const references = extractPromptReferences({
      prompt: 'Write from @/vendor/lib/src/widget.ts and @/vendor/lib/src/other.ts.',
      pagePath,
      repoRoot,
    })
    expect(matchChangedReferences({
      references,
      changedFiles: getChangedFiles(repoRoot),
      changedUrls: [],
    })).toMatchInlineSnapshot(`
      [
        "vendor/lib/src/widget.ts",
      ]
    `)
  })

  test('lists inner files when a range moves the submodule pointer', () => {
    const repoRoot = createSubmoduleRepo()
    const from = git(repoRoot, ['rev-parse', 'HEAD']).trim()
    fs.appendFileSync(path.join(repoRoot, 'vendor/lib/src/widget.ts'), 'export const next = 2\n')
    git(path.join(repoRoot, 'vendor/lib'), ['add', 'src/widget.ts'])
    git(path.join(repoRoot, 'vendor/lib'), ['commit', '-m', 'change widget'])
    git(repoRoot, ['add', 'vendor/lib'])
    git(repoRoot, ['commit', '-m', 'bump submodule'])
    const to = git(repoRoot, ['rev-parse', 'HEAD']).trim()

    expect(getChangedFiles(repoRoot, { from, to }).sort()).toMatchInlineSnapshot(`
      [
        "vendor/lib/src/widget.ts",
      ]
    `)
    expect(getChangedPatches(repoRoot, { from, to }, getChangedFiles(repoRoot, { from, to }))).toContain('a/vendor/lib/src/widget.ts')
  })

  test('does not throw when a submodule is not initialized', () => {
    const repoRoot = createSubmoduleRepo()
    git(repoRoot, ['submodule', 'deinit', '-f', 'vendor/lib'])

    expect(getChangedFiles(repoRoot)).toEqual([])
    expect(getWorkingTreeChanges(repoRoot).sort()).toMatchInlineSnapshot(`
      []
    `)
  })
})
