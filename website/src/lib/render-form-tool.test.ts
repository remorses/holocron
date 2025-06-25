import { describe, expect, test } from 'vitest'
import { compileSchema } from 'json-schema-library'

describe('compileSchema with dotName', () => {
    const schema = {
        type: 'object',
        properties: {
            user: {
                type: 'object',
                properties: {
                    address: {
                        type: 'object',
                        properties: {
                            city: { type: 'string' },
                        },
                    },
                },
            },
        },
    }
    const root = compileSchema(schema)

    test('should resolve dotName path to node', () => {
        const pointer = '#/user/address/city'

        const { node, error } = root.getNode(pointer)
        expect(error).toMatchInlineSnapshot(`undefined`)
        expect(node?.schema).toMatchInlineSnapshot(`
          {
            "type": "string",
          }
        `)
    })

    test('should return false for invalid dotName path', () => {
        const pointer = '#/user/profile/non-existing'

        const { node, error } = root.getNode(pointer)
        expect(error).toMatchInlineSnapshot(`undefined`)
        expect(node?.schema).toMatchInlineSnapshot(`undefined`)
    })
})
