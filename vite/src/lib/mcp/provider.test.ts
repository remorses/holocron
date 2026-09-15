import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { processVirtualTabs } from '../virtual-tab-provider.ts'
import { mcpProvider } from './provider.ts'
import type { ConfigNavTab } from '../../config.ts'

const DEFS = JSON.stringify({
  tools: [
    {
      name: 'analytics_languages',
      description: 'Top languages by visitors',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
  resources: [
    {
      name: 'issues',
      uri: 'strada://issues',
      description: 'Issue groups',
    },
  ],
}, null, 2)

let dir: string

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-mcp-'))
  fs.writeFileSync(path.join(dir, 'mcp-tools.json'), DEFS)
})

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('mcp provider', () => {
  test('generated tool and resource pages force default layout so compact sites keep the right aside', async () => {
    const config = {
      navigation: {
        tabs: [
          { tab: 'MCP', mcp: 'mcp-tools.json' } as ConfigNavTab,
        ],
      },
    }
    const mdxContent: Record<string, string> = {}
    await processVirtualTabs({
      config,
      projectRoot: dir,
      pagesDir: dir,
      publicDir: path.join(dir, 'public'),
      mdxContent,
      providers: [mcpProvider],
    })

    expect(mdxContent['mcp/analytics-languages']).toContain('mode: "default"')
    expect(mdxContent['mcp/resources/issues']).toContain('mode: "default"')
  })
})
