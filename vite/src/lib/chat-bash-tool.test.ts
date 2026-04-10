/**
 * Tests for Holocron's chat bash tool and remote SKILL.md loading.
 */

import http from 'node:http'
import { afterEach, describe, expect, test } from 'vitest'
import { createChatBashTool, normalizeSkillUrl } from './chat-bash-tool.ts'

type BashTool = {
  description: string
  execute: (input: { command: string }) => Promise<{
    stdout: string
    stderr: string
    exitCode: number
  }>
}

const servers = new Set<http.Server>()

afterEach(async () => {
  await Promise.all([...servers].map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })))
  servers.clear()
})

async function startServer(routes: Record<string, { status?: number; body: string }>) {
  const hits = new Map<string, number>()
  const server = http.createServer((request, response) => {
    const path = request.url || '/'
    hits.set(path, (hits.get(path) ?? 0) + 1)
    const route = routes[path]
    response.statusCode = route?.status ?? 200
    response.setHeader('content-type', 'text/markdown; charset=utf-8')
    response.end(route?.body ?? 'not found')
  })
  servers.add(server)

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Missing test server address')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    hits,
  }
}

describe('normalizeSkillUrl', () => {
  test('converts github blob URLs to raw URLs', () => {
    expect(normalizeSkillUrl('https://github.com/remorses/spiceflow/blob/main/SKILL.md')).toMatchInlineSnapshot(
      '"https://raw.githubusercontent.com/remorses/spiceflow/main/SKILL.md"',
    )
  })
})

describe('createChatBashTool', () => {
  test('loads remote skills into the virtual filesystem and description xml', async () => {
    const { baseUrl } = await startServer({
      '/skill.md': {
        body: [
          '---',
          'name: test-skill',
          'description: Helps with testing.',
          '---',
          '',
          '# Test Skill',
        ].join('\n'),
      },
    })

    const bash = await createChatBashTool({
      files: { '/docs/index.mdx': '# Hello' },
      skillUrls: [`${baseUrl}/skill.md`],
    }) as unknown as BashTool

    expect(bash.description).toContain('<available_skills>')
    expect(bash.description).toContain('/docs/skills/test-skill/SKILL.md')

    expect(await bash.execute({ command: 'cat /docs/skills/test-skill/SKILL.md' })).toEqual({
      stdout: '---\nname: test-skill\ndescription: Helps with testing.\n---\n\n# Test Skill',
      stderr: '',
      exitCode: 0,
    })
  })

  test('throws on non-ok responses', async () => {
    const { baseUrl } = await startServer({
      '/missing.md': {
        status: 404,
        body: 'not found',
      },
    })

    await expect(createChatBashTool({
      files: {},
      skillUrls: [`${baseUrl}/missing.md`],
    })).rejects.toThrow(`Failed to fetch skill from ${baseUrl}/missing.md: 404 Not Found`)
  })

  test('throws when remote markdown has invalid frontmatter', async () => {
    const { baseUrl } = await startServer({
      '/bad.md': {
        body: [
          '---',
          'name: ',
          '---',
          '',
          '# Missing description',
        ].join('\n'),
      },
    })

    await expect(createChatBashTool({
      files: {},
      skillUrls: [`${baseUrl}/bad.md`],
    })).rejects.toThrow(`Invalid skill frontmatter from ${baseUrl}/bad.md: expected string name and description`)
  })

  test('reuses the global skill cache across calls', async () => {
    const { baseUrl, hits } = await startServer({
      '/cached.md': {
        body: [
          '---',
          'name: cached-skill',
          'description: Cached skill description.',
          '---',
        ].join('\n'),
      },
    })

    const url = `${baseUrl}/cached.md`
    await createChatBashTool({ files: {}, skillUrls: [url] })
    await createChatBashTool({ files: {}, skillUrls: [url] })

    expect(hits.get('/cached.md')).toBe(1)
  })
})
