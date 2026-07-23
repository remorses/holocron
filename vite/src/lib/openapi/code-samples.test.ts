import { describe, expect, test } from 'vitest'
import {
  codeSampleFenceBlocks,
  extractCodeSamples,
  fenceMarker,
  fenceTitle,
  toFenceLang,
} from './code-samples.ts'

describe('toFenceLang', () => {
  test('lowercases and aliases common SDK langs', () => {
    expect(toFenceLang('TypeScript')).toBe('typescript')
    expect(toFenceLang('JavaScript')).toBe('javascript')
    expect(toFenceLang('Shell')).toBe('bash')
    expect(toFenceLang('curl')).toBe('bash')
    expect(toFenceLang('py')).toBe('python')
    expect(toFenceLang('ts')).toBe('typescript')
    expect(toFenceLang('Go')).toBe('go')
  })

  test('falls back to text for unsafe lang tokens', () => {
    expect(toFenceLang('typescript\n## Injected')).toBe('text')
    expect(toFenceLang('js" onclick')).toBe('text')
    expect(toFenceLang('')).toBe('text')
  })
})

describe('fenceMarker', () => {
  test('uses 3 backticks by default', () => {
    expect(fenceMarker('await client.list()')).toBe('```')
  })

  test('lengthens past nested fences in source', () => {
    expect(fenceMarker('const x = `\n```js\nalert(1)\n```\n`')).toBe('````')
  })
})

describe('extractCodeSamples', () => {
  test('reads x-codeSamples in order', () => {
    const samples = extractCodeSamples({
      'x-codeSamples': [
        {
          lang: 'TypeScript',
          label: 'SDK',
          source: 'await client.users.list()\n',
        },
        {
          lang: 'python',
          source: 'client.users.list()',
        },
      ],
    })
    expect(samples).toMatchInlineSnapshot(`
      [
        {
          "label": "SDK",
          "lang": "typescript",
          "source": "await client.users.list()",
        },
        {
          "label": "python",
          "lang": "python",
          "source": "client.users.list()",
        },
      ]
    `)
  })

  test('skips invalid entries', () => {
    const samples = extractCodeSamples({
      'x-codeSamples': [
        { lang: 'ts', source: 'ok()' },
        { lang: 'ts' },
        { source: 'no lang' },
        { lang: 'ts', source: { $ref: './snippet.ts' } },
        null,
        'nope',
        { lang: '  ', source: 'x' },
        { lang: 'bash', source: '   \n  ' },
      ],
    })
    expect(samples).toEqual([{ lang: 'typescript', label: 'ts', source: 'ok()' }])
  })

  test('returns empty when missing', () => {
    expect(extractCodeSamples(undefined)).toEqual([])
    expect(extractCodeSamples({})).toEqual([])
    expect(extractCodeSamples({ 'x-codeSamples': 'nope' })).toEqual([])
  })
})

describe('codeSampleFenceBlocks', () => {
  test('emits titled fences with lines=false', () => {
    const blocks = codeSampleFenceBlocks([
      { lang: 'typescript', label: 'TypeScript', source: 'await client.list()' },
      { lang: 'python', label: 'weird "name"', source: 'client.list()' },
    ])
    expect(blocks.join('\n')).toMatchInlineSnapshot(`
      "\`\`\`typescript title="TypeScript" lines=false
      await client.list()
      \`\`\`
      \`\`\`python title="weird \\"name\\"" lines=false
      client.list()
      \`\`\`"
    `)
  })

  test('uses a longer fence when source contains triple backticks', () => {
    const source = 'const readme = `\n```js\nalert(1)\n```\n`'
    const blocks = codeSampleFenceBlocks([
      { lang: 'typescript', label: 'TS', source },
    ])
    expect(blocks[0]).toBe('````typescript title="TS" lines=false')
    expect(blocks[1]).toBe(source)
    expect(blocks[2]).toBe('````')
  })
})

describe('fenceTitle', () => {
  test('escapes quotes and backticks', () => {
    expect(fenceTitle('a "b" `c`')).toBe('a \\"b\\" \'c\'')
  })
})
