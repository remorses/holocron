/**
 * Tests for Holocron's Pi tools and remote SKILL.md loading.
 */

import http from 'node:http'
import type { AgentTool } from '@mariozechner/pi-agent-core'
import { afterEach, describe, expect, test } from 'vitest'
import { createChatPiTools, normalizeSkillUrl } from './chat-bash-tool.ts'

type TestTool = AgentTool<any>

function getTool(tools: TestTool[], name: string) {
  const found = tools.find((tool) => tool.name === name)
  if (!found) throw new Error(`Missing tool: ${name}`)
  return found
}

function text(result: Awaited<ReturnType<TestTool['execute']>>) {
  return result.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
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

    const tools = await createChatPiTools({
      files: { '/docs/index.mdx': '# Hello' },
      skillUrls: [`${baseUrl}/skill.md`],
    })

    const bash = getTool(tools, 'bash')
    expect(bash.description).toContain('<available_skills>')
    expect(bash.description).toContain('/docs/skills/test-skill/SKILL.md')

    expect(text(await bash.execute('1', { command: 'cat /docs/skills/test-skill/SKILL.md' }))).toMatchInlineSnapshot(`
      "---
      name: test-skill
      description: Helps with testing.
      ---

      # Test Skill"
    `)
  })

  test('exposes Pi read write edit ls and bash tools over just-bash', async () => {
    const tools = await createChatPiTools({
      files: { '/docs/index.mdx': '# Hello\n\nOld text' },
    })

    const read = getTool(tools, 'read')
    const write = getTool(tools, 'write')
    const edit = getTool(tools, 'edit')
    const ls = getTool(tools, 'ls')
    const bash = getTool(tools, 'bash')

    expect(text(await read.execute('1', { path: 'index.mdx' }))).toMatchInlineSnapshot(`
      "# Hello

      Old text"
    `)

    expect(text(await write.execute('2', { path: 'guide.mdx', content: '# Guide' }))).toMatchInlineSnapshot(
      '"Successfully wrote 7 bytes to guide.mdx"',
    )
    expect(text(await edit.execute('3', { path: 'index.mdx', oldText: 'Old text', newText: 'New text' }))).toContain('Successfully replaced text')
    expect(text(await ls.execute('4', { path: '.' }))).toMatchInlineSnapshot(`
      "guide.mdx
      index.mdx"
    `)
    expect(text(await bash.execute('5', { command: 'grep -rn "New text" /docs' }))).toMatchInlineSnapshot(`
      "/docs/index.mdx:3:New text
      "
    `)
  })

  test('throws on non-ok responses', async () => {
    const { baseUrl } = await startServer({
      '/missing.md': {
        status: 404,
        body: 'not found',
      },
    })

    await expect(createChatPiTools({
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

    await expect(createChatPiTools({
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
    await createChatPiTools({ files: {}, skillUrls: [url] })
    await createChatPiTools({ files: {}, skillUrls: [url] })

    expect(hits.get('/cached.md')).toBe(1)
  })
})
