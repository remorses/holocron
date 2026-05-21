import { describe, expect, test } from 'vitest'
import { parseCodeMeta, metaBool } from './code-meta.ts'

describe('parseCodeMeta', () => {
  test('bare words become title, key=value become attributes', () => {
    expect(parseCodeMeta('helloWorld.ts theme={null} copy=true')).toMatchInlineSnapshot(`
      {
        "attributes": {
          "copy": "true",
          "theme": "null",
        },
        "title": "helloWorld.ts",
      }
    `)
  })

  test('all key=value, no title', () => {
    expect(parseCodeMeta('placement="top-left" actions={false}')).toMatchInlineSnapshot(`
      {
        "attributes": {
          "actions": "false",
          "placement": "top-left",
        },
        "title": undefined,
      }
    `)
  })

  test('bare words are title, not flags', () => {
    expect(parseCodeMeta('bleed')).toMatchInlineSnapshot(`
      {
        "attributes": {},
        "title": "bleed",
      }
    `)
  })

  test('multi-word bare title with key=value flags', () => {
    expect(parseCodeMeta('My Config File bleed=true lines=true')).toMatchInlineSnapshot(`
      {
        "attributes": {
          "bleed": "true",
          "lines": "true",
        },
        "title": "My Config File",
      }
    `)
  })

  test('lines={false} keeps string value for consumer to interpret', () => {
    expect(parseCodeMeta('lines={false}')).toMatchInlineSnapshot(`
      {
        "attributes": {
          "lines": "false",
        },
        "title": undefined,
      }
    `)
  })

  test('explicit title="..." takes priority over bare words', () => {
    expect(parseCodeMeta('title="My Config" bleed=true')).toMatchInlineSnapshot(`
      {
        "attributes": {
          "bleed": "true",
        },
        "title": "My Config",
      }
    `)
  })

  test('explicit title="..." overrides bare-word title', () => {
    expect(parseCodeMeta('Bare Title title="Explicit Title" lines=true')).toMatchInlineSnapshot(`
      {
        "attributes": {
          "lines": "true",
        },
        "title": "Explicit Title",
      }
    `)
  })
})

describe('metaBool', () => {
  test('interprets "true" and "false" strings', () => {
    expect(metaBool('true')).toBe(true)
    expect(metaBool('false')).toBe(false)
  })

  test('returns undefined for non-boolean strings', () => {
    expect(metaBool('null')).toBeUndefined()
    expect(metaBool('hello')).toBeUndefined()
    expect(metaBool(undefined)).toBeUndefined()
  })
})
