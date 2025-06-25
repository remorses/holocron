import { compileSchema } from 'json-schema-library'
import { describe, expect, test } from 'vitest'
import { getTypeForNameInSchema } from './render-form-tool'

describe('compileSchema with union in array', () => {
    const schema = {
        type: 'object',
        properties: {
            container: {
                type: 'array',
                items: {
                    anyOf: [
                        {
                            type: 'object',
                            properties: {
                                email: { type: 'string' },
                                type: { const: 'email' },
                            },
                            required: ['email', 'type'],
                        },
                        {
                            type: 'object',
                            properties: {
                                sms: { type: 'string' },
                                type: { const: 'sms' },
                            },
                            required: ['sms', 'type'],
                        },
                        {
                            type: 'object',
                            properties: {
                                push: { type: 'boolean' },
                                type: { const: 'push' },
                            },
                            required: ['push', 'type'],
                        },
                    ],
                },
            },
        },
        required: ['container'],
    }

    const compiled = compileSchema(schema)

    test('should resolve pointer to field existing in only some unions: sms', () => {
        expect(getTypeForNameInSchema('container.items.0.sms', compiled))
            .toMatchInlineSnapshot(`
          {
            "type": "string",
          }
        `)
    })
    test('should resolve pointer to field existing in only some unions: email', () => {
        expect(getTypeForNameInSchema('container.items.0.email', compiled))
            .toMatchInlineSnapshot(`
          {
            "type": "string",
          }
        `)
    })

    test('should resolve pointer to field existing in only some unions: push', () => {
        expect(getTypeForNameInSchema('container.items.0.push', compiled))
            .toMatchInlineSnapshot(`
          {
            "type": "boolean",
          }
        `)
    })

    test('should resolve pointer to discriminant field always present: type', () => {
        expect(getTypeForNameInSchema('container.items.0.type', compiled))
            .toMatchInlineSnapshot(`
              {
                "const": "push",
              }
            `)
    })

    test('should resolve pointer to a non-existent field', () => {
        expect(
            getTypeForNameInSchema('container.items.0.notarealfield', compiled),
        ).toBeUndefined()
    })
})
