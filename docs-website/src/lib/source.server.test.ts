import { describe, test, expect } from 'vitest'
import { getFilesFromFilesInDraft } from './source.server'
import type { FilesInDraft } from './docs-state'

describe('getFilesFromFilesInDraft', () => {
  test('converts filesInDraft to VirtualFile array', () => {
    const filesInDraft: FilesInDraft = {
      'docs/index.md': {
        content: '# Welcome',
        githubPath: 'docs/index.md',
      },
      'docs/api.mdx': {
        content: '# API Docs',
        githubPath: 'docs/api.mdx',
      },
      'docs/_meta.json': {
        content: '{"title": "Docs"}',
        githubPath: 'docs/_meta.json',
      },
    }

    const result = getFilesFromFilesInDraft(filesInDraft)

    expect(result).toHaveLength(3)
    expect(result).toContainEqual({
      path: 'docs/index.md',
      data: {},
      type: 'page',
    })
    expect(result).toContainEqual({
      path: 'docs/api.mdx',
      data: {},
      type: 'page',
    })
    expect(result).toContainEqual({
      path: 'docs/_meta.json',
      data: {},
      type: 'meta',
    })
  })

  test('skips deleted files', () => {
    const filesInDraft: FilesInDraft = {
      'docs/index.md': {
        content: '# Welcome',
        githubPath: 'docs/index.md',
      },
      'docs/deleted.md': {
        content: null,
        githubPath: 'docs/deleted.md',
      },
    }

    const result = getFilesFromFilesInDraft(filesInDraft)

    expect(result).toHaveLength(1)
    expect(result[0].path).toBe('docs/index.md')
  })

  test('handles githubFolder prefix removal', () => {
    const filesInDraft: FilesInDraft = {
      'my-docs/index.md': {
        content: '# Welcome',
        githubPath: 'my-docs/index.md',
      },
    }

    const result = getFilesFromFilesInDraft(filesInDraft, 'my-docs')

    expect(result).toHaveLength(1)
    expect(result[0].path).toBe('index.md')
  })
})
