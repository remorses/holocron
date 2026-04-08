import { describe, expect, test } from 'vitest'
import { parseCodeMeta } from './code-meta.ts'

describe('parseCodeMeta', () => {
  test('parses Mintlify filename syntax and brace expressions', () => {
    expect(parseCodeMeta('helloWorld.ts theme={null} copy=true')).toMatchInlineSnapshot(`
      {
        "attributes": {
          "copy": true,
          "theme": null,
        },
        "title": "helloWorld.ts",
      }
    `)
  })

  test('parses Mermaid booleans from brace expressions', () => {
    expect(parseCodeMeta('placement="top-left" actions={false}')).toMatchInlineSnapshot(`
      {
        "attributes": {
          "actions": false,
          "placement": "top-left",
        },
        "title": undefined,
      }
    `)
  })
})
