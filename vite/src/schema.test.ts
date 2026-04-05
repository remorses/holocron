import { describe, test, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { holocronConfigSchema } from './schema.ts'
import { parseJsonc } from './lib/jsonc.ts'

/* ── Validation of existing example configs ──────────────────────────── */

describe('holocronConfigSchema validation', () => {
  test('accepts example/holocron.jsonc', () => {
    const file = path.join(import.meta.dirname, '..', '..', 'example', 'holocron.jsonc')
    if (!fs.existsSync(file)) return
    const raw = fs.readFileSync(file, 'utf-8')
    const data = parseJsonc(raw)
    const result = holocronConfigSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('accepts integration-tests/holocron.jsonc', () => {
    const file = path.join(import.meta.dirname, '..', '..', 'integration-tests', 'holocron.jsonc')
    if (!fs.existsSync(file)) return
    const raw = fs.readFileSync(file, 'utf-8')
    const data = parseJsonc(raw)
    const result = holocronConfigSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('accepts minimal config', () => {
    const result = holocronConfigSchema.safeParse({ name: 'Test' })
    expect(result.success).toBe(true)
  })

  test('rejects empty name', () => {
    const result = holocronConfigSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  test('rejects invalid hex color', () => {
    const result = holocronConfigSchema.safeParse({
      name: 'X',
      colors: { primary: 'red' },
    })
    expect(result.success).toBe(false)
  })

  test('accepts valid hex color', () => {
    const result = holocronConfigSchema.safeParse({
      name: 'X',
      colors: { primary: '#ff0000' },
    })
    expect(result.success).toBe(true)
  })

  test('accepts logo as string', () => {
    const result = holocronConfigSchema.safeParse({
      name: 'X',
      logo: '/logo.svg',
    })
    expect(result.success).toBe(true)
  })

  test('accepts logo as object', () => {
    const result = holocronConfigSchema.safeParse({
      name: 'X',
      logo: { light: '/light.svg', dark: '/dark.svg' },
    })
    expect(result.success).toBe(true)
  })

  test('accepts navigation as object with tabs', () => {
    const result = holocronConfigSchema.safeParse({
      name: 'X',
      navigation: {
        tabs: [{ tab: 'Docs', groups: [{ group: 'A', pages: ['intro'] }] }],
      },
    })
    expect(result.success).toBe(true)
  })

  test('accepts navigation with link-only tab', () => {
    const result = holocronConfigSchema.safeParse({
      name: 'X',
      navigation: {
        tabs: [{ tab: 'GitHub', href: 'https://github.com/example' }],
      },
    })
    expect(result.success).toBe(true)
  })

  test('accepts navigation with global.anchors', () => {
    const result = holocronConfigSchema.safeParse({
      name: 'X',
      navigation: {
        tabs: [{ tab: 'Docs', groups: [{ group: 'A', pages: ['intro'] }] }],
        global: { anchors: [{ anchor: 'Blog', href: '/blog' }] },
      },
    })
    expect(result.success).toBe(true)
  })

  test('accepts navigation with nested groups', () => {
    const result = holocronConfigSchema.safeParse({
      name: 'X',
      navigation: {
        tabs: [
          {
            tab: 'Docs',
            groups: [
              {
                group: 'Outer',
                pages: [
                  'intro',
                  { group: 'Inner', pages: ['nested-1', 'nested-2'] },
                ],
              },
            ],
          },
        ],
      },
    })
    expect(result.success).toBe(true)
  })

  test('accepts redirects', () => {
    const result = holocronConfigSchema.safeParse({
      name: 'X',
      redirects: [{ source: '/old', destination: '/new', permanent: true }],
    })
    expect(result.success).toBe(true)
  })

  test('passes through unknown Mintlify fields', () => {
    const result = holocronConfigSchema.safeParse({
      name: 'X',
      theme: 'mint',
      api: { openapi: '/api.json' },
      fonts: { heading: { family: 'Inter' } },
      seo: { indexing: 'all' },
    })
    expect(result.success).toBe(true)
  })

  test('accepts footer.socials with known keys', () => {
    const result = holocronConfigSchema.safeParse({
      name: 'X',
      footer: {
        socials: {
          x: 'https://x.com/test',
          github: 'https://github.com/test',
        },
      },
    })
    expect(result.success).toBe(true)
  })

  test('accepts navbar with typed link', () => {
    const result = holocronConfigSchema.safeParse({
      name: 'X',
      navbar: {
        links: [{ type: 'github', href: 'https://github.com/example' }],
      },
    })
    expect(result.success).toBe(true)
  })
})

/* ── Regen-check: schema.json on disk is in sync with Zod schemas ────── */

describe('schema.json regen-check', () => {
  test('generated schema.json matches what generate-schema.ts would emit', () => {
    const schemaPath = path.join(import.meta.dirname, '..', 'schema.json')
    const onDisk = fs.readFileSync(schemaPath, 'utf-8')

    const generated = z.toJSONSchema(holocronConfigSchema, {
      target: 'draft-7',
      metadata: z.globalRegistry,
      reused: 'inline',
      unrepresentable: 'any',
    })

    // Same clean() logic as scripts/generate-schema.ts
    const clean = (node: unknown): unknown => {
      if (Array.isArray(node)) return node.map(clean)
      if (node === null || typeof node !== 'object') return node
      const obj = node as Record<string, unknown>
      if (
        Array.isArray(obj.allOf) &&
        obj.allOf.length === 1 &&
        obj.allOf[0] &&
        typeof obj.allOf[0] === 'object' &&
        Object.keys(obj).length === 1
      ) {
        return clean(obj.allOf[0])
      }
      const result: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'id') continue
        result[key] = clean(value)
      }
      return result
    }

    const cleaned = clean(generated) as Record<string, unknown>
    const expected =
      JSON.stringify(
        { $schema: 'http://json-schema.org/draft-07/schema#', ...cleaned },
        null,
        2,
      ) + '\n'

    if (onDisk !== expected) {
      throw new Error(
        'schema.json on disk is out of sync with src/schema.ts. Run: pnpm -F @holocron.so/vite generate-schema',
      )
    }
  })
})
